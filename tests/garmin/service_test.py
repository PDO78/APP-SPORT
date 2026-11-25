"""Vrai FastAPI/SQLite/FIT ; Garmin simulé, aucun accès à un compte réel."""
import base64
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch
import uuid

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('garmin_service', ROOT / 'garmin-service/app.py')
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)


def fixture(equipment='rameur', **changes):
    data = dict(eq=equipment, start='2026-11-25T08:00:00Z', minutes='15.35', distance='2312', unit='m', calories='126', heart='', totalStrokes='377', extra={})
    data.update(changes)
    code = "const r=require('./fit.js').build(JSON.parse(process.argv[1]));process.stdout.write(Buffer.from(r.bytes).toString('base64'));"
    return subprocess.check_output(['node', '-e', code, json.dumps(data)], cwd=ROOT).decode()


class Account:
    def __init__(self):
        self.calls = 0
        self.details = {'activityId': 12345, 'distance': 2312, 'duration': 921, 'calories': 126, 'startTimeGMT': '2026-11-25 08:00:00', 'activityType': {'typeKey': 'indoor_rowing'}}
        self.response = {'detailedImportResult': {'successes': [{'internalId': 12345}]}}
        self.failure = None

    def upload_activity(self, filename):
        self.calls += 1
        self.raw = Path(filename).read_bytes()
        service.inspect_fit(self.raw)
        if self.failure:
            raise self.failure
        return self.response

    def get_activity(self, activity_id):
        assert activity_id == '12345'
        return self.details


class ServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fit = fixture()

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'APP_SPORT_API_KEY': 'test-service-key-' * 3, 'APP_SPORT_DB': self.folder.name + '/test.sqlite', 'GARMIN_EMAIL': 'test@example.invalid', 'GARMIN_PASSWORD': 'not-a-real-password'})
        self.env.start()
        with service.rate_lock:
            service.attempts.clear()
        self.account = Account()
        self.original_client = service.client
        self.provider = patch.object(service, 'client', return_value=self.account)
        self.client_mock = self.provider.start()
        self.web = TestClient(service.app)
        self.headers = {'Authorization': 'Bearer ' + os.environ['APP_SPORT_API_KEY']}

    def tearDown(self):
        self.web.close()
        self.provider.stop()
        self.env.stop()
        self.folder.cleanup()

    def payload(self, fit=None, request_id=None):
        return {'request_id': request_id or str(uuid.uuid4()), 'fit_base64': fit or self.fit, 'confirmed': True}

    def send(self, payload=None):
        return self.web.post('/v1/imports', headers=self.headers, json=payload or self.payload())

    def test_auth_and_no_legacy_routes(self):
        for route in ['/v1/status', '/v1/imports/' + str(uuid.uuid4())]:
            self.assertEqual(self.web.get(route).status_code, 401)
        self.assertEqual(self.web.post('/v1/imports', json=self.payload()).status_code, 401)
        self.assertEqual(self.web.post('/process-and-replace-latest-rowing', headers=self.headers).status_code, 404)
        self.assertEqual(self.account.calls, 0)

    def test_status_does_not_pretend_garmin_login(self):
        response = self.web.get('/v1/status', headers=self.headers)
        self.assertEqual(response.json()['mode'], 'personal')
        self.client_mock.assert_not_called()
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertNotIn('test@example.invalid', response.text)

    def test_real_fit_upload_verified_without_delete(self):
        response = self.send()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['status'], 'verified')
        self.assertEqual(response.json()['activity_id'], '12345')
        self.assertEqual(self.account.calls, 1)
        self.assertEqual(base64.b64encode(self.account.raw).decode(), self.fit)

    def test_same_request_and_same_file_never_uploaded_twice(self):
        payload = self.payload()
        first = self.send(payload).json()
        self.assertEqual(self.send(payload).json(), first)
        self.assertEqual(self.send(self.payload()).json(), first)
        self.assertEqual(self.account.calls, 1)
        status = self.web.get('/v1/imports/' + first['request_id'], headers=self.headers)
        self.assertEqual(status.json(), first)

    def test_request_id_cannot_be_reused_for_another_file(self):
        payload = self.payload()
        self.send(payload)
        payload['fit_base64'] = fixture(distance='2313')
        self.assertEqual(self.send(payload).status_code, 409)
        self.assertEqual(self.account.calls, 1)

    def test_crc_corrupt_confirmation_missing_and_invalid_inputs(self):
        raw = bytearray(base64.b64decode(self.fit));raw[-1] ^= 1
        for change in [{'fit_base64': base64.b64encode(raw).decode()}, {'fit_base64': '!!!!'}, {'confirmed': False}, {'request_id': '../bad'}, {'extra': True}]:
            payload = self.payload();payload.update(change)
            self.assertEqual(self.send(payload).status_code, 422)
        self.assertEqual(self.account.calls, 0)
        self.assertEqual(self.web.post('/v1/imports', headers={**self.headers, 'Content-Type': 'application/json'}, content=b' ' * 800001).status_code, 413)

    def test_treadmill_and_elliptical_supported(self):
        for equipment, kind in [('tapis', 'treadmill_running'), ('elliptique', 'elliptical')]:
            self.account.details['activityType']['typeKey'] = kind
            result = self.send(self.payload(fit=fixture(equipment))).json()
            self.assertEqual(result['status'], 'verified', result)

    def test_garmin_timeout_never_retries_and_survives_new_db_connection(self):
        self.account.failure = RuntimeError('private-token-must-not-leak')
        payload = self.payload()
        response = self.send(payload)
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['status'], 'uncertain')
        self.assertNotIn('private-token', response.text)
        self.assertEqual(self.send(payload).json()['status'], 'uncertain')
        self.assertEqual(self.send(self.payload()).json()['status'], 'uncertain')
        self.assertEqual(self.account.calls, 1)

    def test_only_exact_upload_identifier_and_totals_are_verified(self):
        for field, value in [('distance', 0), ('duration', 800), ('calories', 999), ('startTimeGMT', '2026-11-24 08:00:00'), ('activityType', {'typeKey': 'running'})]:
            with self.subTest(field=field):
                distance = 2312 + self.account.calls
                self.account.details['distance'] = distance
                old = self.account.details[field];self.account.details[field] = value
                result = self.send(self.payload(fit=fixture(distance=str(distance)))).json()
                self.assertEqual(result['status'], 'uncertain')
                self.account.details[field] = old

    def test_empty_upload_success_is_not_success(self):
        self.account.response = {'detailedImportResult': {'successes': [], 'failures': []}}
        response = self.send()
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['status'], 'uncertain')

    def test_wrong_activity_id_is_not_success(self):
        self.account.details['activityId'] = 98765
        self.assertEqual(self.send().json()['status'], 'uncertain')

    def test_daily_limit_prevents_upstream_upload(self):
        with service.database() as db:
            for i in range(20):
                db.execute('INSERT INTO imports VALUES (?,?,?,NULL,?,?)', (str(uuid.uuid4()), 'test-digest-' + str(i), 'verified', service.time.time(), 'test'))
        self.assertEqual(self.send().status_code, 429)
        self.assertEqual(self.account.calls, 0)

    def test_connection_failure_before_upload_can_be_retried_explicitly(self):
        self.client_mock.side_effect = service.HTTPException(503, 'Connexion indisponible.')
        payload = self.payload()
        self.assertEqual(self.send(payload).status_code, 503)
        self.assertEqual(self.web.get('/v1/imports/' + payload['request_id'], headers=self.headers).status_code, 404)
        self.assertEqual(self.account.calls, 0)

    def test_tokens_stay_on_server_and_mfa_does_not_block_http(self):
        store = Path(self.folder.name) / 'tokens'
        with patch.dict(os.environ, {'GARMINTOKENS': str(store)}), patch.object(service, 'Garmin') as constructor:
            account = constructor.return_value
            def dump(folder):
                (Path(folder) / 'oauth-test.json').write_text('test-only-not-a-real-token')
            account.garth.dump.side_effect = dump
            self.assertIs(self.original_client(), account)
            account.garth.configure.assert_called_once_with(timeout=20, retries=0)
            account.login.assert_called_once_with(str(store))
            self.assertEqual(store.stat().st_mode & 0o777, 0o700)
            self.assertEqual((store / 'oauth-test.json').stat().st_mode & 0o777, 0o600)
            with self.assertRaises(RuntimeError):
                constructor.call_args.kwargs['prompt_mfa']()

    def test_concurrent_same_file_reserves_before_upload(self):
        entered, release = threading.Event(), threading.Event()
        original = self.account.upload_activity
        def delayed(filename):
            entered.set();release.wait(5)
            return original(filename)
        self.account.upload_activity = delayed
        with ThreadPoolExecutor(2) as pool:
            first = pool.submit(self.send, self.payload())
            try:
                self.assertTrue(entered.wait(5))
                second = self.send(self.payload())
                self.assertEqual(second.json()['status'], 'pending')
            finally:
                release.set()
            self.assertEqual(first.result().json()['status'], 'verified')
        self.assertEqual(self.account.calls, 1)

    def test_cors_only_allowed_origin(self):
        for origin, expected in [('https://pdo78.github.io', 200), ('https://evil.invalid', 400)]:
            response = self.web.options('/v1/imports', headers={'Origin': origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type'})
            self.assertEqual(response.status_code, expected)
            if expected == 200:
                self.assertEqual(response.headers['access-control-allow-origin'], origin)

    def test_rate_limit_and_short_key(self):
        for _ in range(20):
            self.assertEqual(self.web.get('/v1/status', headers=self.headers).status_code, 200)
        self.assertEqual(self.web.get('/v1/status', headers=self.headers).status_code, 429)
        with patch.dict(os.environ, {'APP_SPORT_API_KEY': 'short'}):
            self.assertEqual(self.web.get('/v1/status', headers=self.headers).status_code, 503)


if __name__ == '__main__':
    unittest.main()
