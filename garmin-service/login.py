"""Initialisation/renouvellement interactif des jetons sur le serveur privé.
Ne pas exécuter pendant un import. Ne transmet aucun secret à APP-SPORT.
"""
from getpass import getpass
import logging
import os
from pathlib import Path
from garminconnect import Garmin

logging.disable(logging.CRITICAL)
email = os.getenv('GARMIN_EMAIL') or input('Adresse Garmin : ')
password = os.getenv('GARMIN_PASSWORD') or getpass('Mot de passe Garmin : ')
store = Path(os.getenv('GARMINTOKENS', '/data/tokens')).expanduser()
store.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(store, 0o700)
try:
    account = Garmin(email, password, prompt_mfa=lambda: getpass('Code Garmin de double authentification : '))
    previous = os.environ.pop('GARMINTOKENS', None)
    try:
        account.login()  # Sans ancien jeton : connexion interactive voulue ici.
    finally:
        if previous is not None:
            os.environ['GARMINTOKENS'] = previous
    account.garth.dump(str(store))
    for token in store.iterdir():
        if token.is_file():
            os.chmod(token, 0o600)
    print('Connexion Garmin établie. Jetons enregistrés sur le serveur privé.')
except Exception:
    raise SystemExit('Connexion non établie. Vérifier les identifiants, le code Garmin ou réessayer plus tard.') from None
