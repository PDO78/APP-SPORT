"""Passerelle personnelle APP-SPORT. Création uniquement ; aucune suppression Garmin.

Réutilise GARMIN_EMAIL, GARMIN_PASSWORD et GARMINTOKENS du service fourni.
Ne jamais monter les anciennes routes de remplacement dans cette application.
"""
import base64
import hashlib
import hmac
import io
import json
import logging
import math
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import uuid
from collections import deque
from contextlib import closing, contextmanager
from datetime import datetime, timezone

import fitdecode
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from garminconnect import Garmin
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="APP-SPORT — passerelle Garmin personnelle", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_origins=[s.strip() for s in os.getenv('ALLOWED_ORIGINS', 'https://pdo78.github.io').split(',') if s.strip()], allow_methods=['GET', 'POST'], allow_headers=['Authorization', 'Content-Type'], allow_credentials=False)
lock = threading.Lock()
rate_lock = threading.Lock()
attempts = deque()
MAX_BODY = 800_000
# Les exceptions de cette bibliothèque peuvent contenir des réponses privées.
logging.getLogger('garminconnect').disabled = True
logging.getLogger('garth').disabled = True


@app.middleware('http')
async def private_response(request, call_next):
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


def authenticate(request):
    key = os.getenv('APP_SPORT_API_KEY', '')
    if len(key) < 32:
        raise HTTPException(503, 'Clé du service absente ou trop courte (32 caractères minimum).')
    supplied = request.headers.get('authorization', '')
    if not hmac.compare_digest(supplied.encode(), ('Bearer ' + key).encode()):
        raise HTTPException(401, 'Clé d’accès au service invalide.')
    with rate_lock:
        now = time.monotonic()
        while attempts and attempts[0] < now - 60:
            attempts.popleft()
        if len(attempts) >= 20:
            raise HTTPException(429, 'Trop de requêtes. Patiente une minute.')
        attempts.append(now)


@contextmanager
def database():
    path = Path(os.getenv('APP_SPORT_DB', '/data/app-sport.sqlite3'))
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with closing(sqlite3.connect(path, timeout=10)) as db, db:
        os.chmod(path, 0o600)
        db.execute('CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, digest TEXT UNIQUE NOT NULL, status TEXT NOT NULL, activity_id TEXT, created REAL NOT NULL, message TEXT NOT NULL)')
        yield db


def client():
    email, password = os.getenv('GARMIN_EMAIL'), os.getenv('GARMIN_PASSWORD')
    if not email or not password:
        raise HTTPException(503, 'Compte Garmin non configuré sur le serveur.')
    try:
        def no_interactive_mfa():
            raise RuntimeError('Connexion interactive requise sur le serveur.')
        account = Garmin(email, password, prompt_mfa=no_interactive_mfa)
        account.garth.configure(timeout=20, retries=0)
        store = Path(os.getenv('GARMINTOKENS', '/data/tokens')).expanduser()
        account.login(str(store))
        store.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(store, 0o700)
        account.garth.dump(str(store))
        for token in store.iterdir():
            if token.is_file():
                os.chmod(token, 0o600)
        return account
    except Exception:
        # Ne jamais transmettre les exceptions Garmin (jetons, URL, données privées).
        raise HTTPException(503, 'Connexion Garmin indisponible. Vérifie la connexion du service, la double authentification ou les limites Garmin.') from None


def inspect_fit(raw):
    if not 16 <= len(raw) <= 512_000 or raw[8:12] != b'.FIT':
        raise HTTPException(422, 'Fichier FIT invalide ou trop volumineux.')
    try:
        sessions = []
        with fitdecode.FitReader(io.BytesIO(raw), check_crc=fitdecode.CrcCheck.RAISE) as reader:
            for frame in reader:
                if isinstance(frame, fitdecode.FitDataMessage) and frame.name == 'session':
                    sessions.append({f.name: f.value for f in frame.fields})
        if len(sessions) != 1:
            raise ValueError()
        result = sessions[0]
        if (result.get('sport'), result.get('sub_sport')) not in [('rowing', 'indoor_rowing'), ('running', 'treadmill'), ('fitness_equipment', 'elliptical')]:
            raise ValueError()
        for field in ['total_timer_time', 'total_distance', 'total_calories']:
            value = result.get(field)
            if not isinstance(value, (float, int)) or not math.isfinite(value) or value < 0:
                raise ValueError()
        if not 1 <= result['total_timer_time'] <= 7 * 86400 or not result.get('start_time'):
            raise ValueError()
        return result
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, 'Résumé FIT non valide : vérifier les données et le type d’équipement.') from None


def public(row):
    return dict(zip(['request_id', 'status', 'activity_id', 'message'], row))


def lookup(db, request_id):
    return db.execute('SELECT id,status,activity_id,message FROM imports WHERE id=?', (request_id,)).fetchone()


def set_result(request_id, status, message, activity_id=None):
    with database() as db:
        db.execute('UPDATE imports SET status=?,message=?,activity_id=? WHERE id=?', (status, message, activity_id, request_id))
    return {'request_id': request_id, 'status': status, 'activity_id': activity_id, 'message': message}


def upload(raw, request_id, summary):
    # SQLite protège aussi les doublons entre processus/redémarrages. Aucune
    # relance automatique d'un envoi incertain, y compris après arrêt du service.
    digest = hashlib.sha256(raw).hexdigest()
    with database() as db:
        db.execute('BEGIN IMMEDIATE')
        existing = lookup(db, request_id)
        if existing:
            stored = db.execute('SELECT digest FROM imports WHERE id=?', (request_id,)).fetchone()[0]
            if stored != digest:
                raise HTTPException(409, 'Cette référence appartient à une autre séance.')
            return public(existing)
        same = db.execute('SELECT id,status,activity_id,message FROM imports WHERE digest=?', (digest,)).fetchone()
        if same:
            return public(same)
        count = db.execute('SELECT count(*) FROM imports WHERE created>?', (time.time() - 86400,)).fetchone()[0]
        if count >= 20:
            raise HTTPException(429, 'Limite de 20 nouveaux envois par 24 heures atteinte.')
        db.execute('INSERT INTO imports VALUES (?,?,?,NULL,?,?)', (request_id, digest, 'pending', time.time(), 'Envoi réservé. Si le service a été interrompu, vérifier Garmin avant tout nouvel import.'))
    # Une seule connexion Garmin à la fois : le dossier de jetons est partagé.
    if not lock.acquire(blocking=False):
        with database() as db:
            db.execute('DELETE FROM imports WHERE id=?', (request_id,))
        raise HTTPException(409, 'Un autre envoi est en cours. Réessaie après sa fin.')
    try:
        try:
            account = client()
        except HTTPException:
            with database() as db:
                db.execute('DELETE FROM imports WHERE id=?', (request_id,))
            raise
        try:
            with tempfile.TemporaryDirectory(prefix='app-sport-') as folder:
                filename = Path(folder) / 'seance.fit'
                filename.write_bytes(raw)
                os.chmod(filename, 0o600)
                result = account.upload_activity(str(filename))
            successes = result.get('detailedImportResult', {}).get('successes', [])
            if len(successes) != 1 or not successes[0].get('internalId'):
                return set_result(request_id, 'uncertain', 'Garmin n’a pas confirmé un identifiant unique. Vérifie ton compte ; aucun nouvel envoi automatique ne sera tenté.')
            activity_id = str(successes[0]['internalId'])
            if not activity_id.isascii() or not activity_id.isdigit() or len(activity_id) > 30:
                return set_result(request_id, 'uncertain', 'Garmin a retourné un identifiant invalide. Vérifie ton compte avant toute autre tentative.')
            activity = account.get_activity(activity_id)
            if str(activity.get('activityId')) != activity_id:
                return set_result(request_id, 'uncertain', 'La réponse Garmin ne correspond pas à l’identifiant importé. Vérifie ton compte.', activity_id)
            # Seul l'identifiant renvoyé par CET import est vérifié, jamais la
            # dernière activité ou une simple correspondance de date.
            for expected, actual, tolerance in [('total_distance', 'distance', .11), ('total_timer_time', 'duration', 1.1), ('total_calories', 'calories', 1)]:
                value = activity.get(actual)
                if not isinstance(value, (int, float)) or not math.isfinite(value) or abs(summary[expected] - value) > tolerance:
                    return set_result(request_id, 'uncertain', 'Activité envoyée, mais ses valeurs ne sont pas confirmées. Vérifie Garmin ; aucune activité n’a été supprimée.', activity_id)
            expected_type = {'rowing': 'indoor_rowing', 'running': 'treadmill_running', 'fitness_equipment': 'elliptical'}[summary['sport']]
            if activity.get('activityType', {}).get('typeKey') != expected_type:
                return set_result(request_id, 'uncertain', 'Activité envoyée, mais son type doit être vérifié dans Garmin.', activity_id)
            try:
                actual_start = datetime.fromisoformat(activity['startTimeGMT'].replace('Z', '+00:00'))
                if actual_start.tzinfo is None:
                    actual_start = actual_start.replace(tzinfo=timezone.utc)
                if abs((actual_start - summary['start_time']).total_seconds()) > 1.1:
                    raise ValueError()
            except Exception:
                return set_result(request_id, 'uncertain', 'Activité envoyée, mais sa date de début doit être vérifiée dans Garmin.', activity_id)
            return set_result(request_id, 'verified', 'Séance importée et valeurs vérifiées dans Garmin.', activity_id)
        except Exception:
            return set_result(request_id, 'uncertain', 'Réponse Garmin interrompue ou illisible. Vérifie ton compte avant toute autre tentative ; aucun renvoi automatique ne sera fait.')
    finally:
        lock.release()


@app.get('/v1/status')
def status(request: Request):
    authenticate(request)
    if not os.getenv('GARMIN_EMAIL') or not os.getenv('GARMIN_PASSWORD'):
        raise HTTPException(503, 'Compte Garmin non configuré sur le serveur.')
    return {'mode': 'personal', 'message': 'Service personnel accessible. L’import utilisera le compte Garmin configuré sur ce serveur. La connexion Garmin sera vérifiée lors de l’envoi.'}


@app.get('/v1/imports/{request_id}')
def import_status(request_id: str, request: Request):
    authenticate(request)
    with database() as db:
        row = lookup(db, request_id)
    if not row:
        raise HTTPException(404, 'Aucun envoi trouvé pour cette référence.')
    return public(row)


@app.post('/v1/imports')
async def import_workout(request: Request):
    authenticate(request)
    if request.headers.get('content-type', '').split(';')[0] != 'application/json':
        raise HTTPException(415, 'JSON requis.')
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_BODY:
            raise HTTPException(413, 'Fichier trop volumineux.')
    try:
        data = json.loads(body)
        if set(data) != {'request_id', 'fit_base64', 'confirmed'} or data['confirmed'] is not True:
            raise ValueError()
        request_id = str(uuid.UUID(data['request_id']))
        raw = base64.b64decode(data['fit_base64'], validate=True)
    except Exception:
        raise HTTPException(422, 'Séance ou confirmation invalide.') from None
    summary = inspect_fit(raw)
    result = await run_in_threadpool(upload, raw, request_id, summary)
    return JSONResponse(result, status_code=200 if result['status'] == 'verified' else 202)
