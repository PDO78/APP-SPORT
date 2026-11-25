# Connexion au service Garmin personnel

## Fonctionnement livré

Le navigateur smartphone génère le **même FIT que l’export existant**, après contrôle des champs et confirmation. Il l’envoie à la passerelle Python. Celle-ci reprend les conventions de votre `app.py` : bibliothèque non officielle `garminconnect`, `GARMIN_EMAIL`, `GARMIN_PASSWORD`, `GARMINTOKENS`. Elle crée une nouvelle activité avec `upload_activity`, puis vérifie l’identifiant renvoyé, le type, la date UTC, la durée, la distance et les calories.

**Cette version utilise un seul compte Garmin, celui du serveur.** La clé saisie dans APP-SPORT autorise l’utilisation de ce compte personnel ; elle ne connecte pas le compte Garmin d’un autre utilisateur. Aucun formulaire de mot de passe Garmin n’est présenté comme une connexion multiutilisateur. Une telle évolution nécessiterait des sessions et des dossiers de jetons séparés par utilisateur, avec double authentification.

La passerelle est livrée à part dans `garmin-service/`. Le fichier original transmis n’est ni exécuté ni remplacé automatiquement. Aucune des anciennes routes de suppression/remplacement n’est montée. L’application ne corrige pas une activité de montre existante : si elle existe déjà, un nouvel import peut créer un doublon. Une confirmation explicite le rappelle. Rameur intérieur, tapis et elliptique sont acceptés.

## Installation sur la machine qui héberge déjà Garmin

Ces opérations se font une fois sur le serveur Docker. Ensuite, l’utilisation quotidienne se fait uniquement depuis Safari iPhone ou Chrome Android. GitHub Pages héberge toujours les fichiers statiques ; il ne peut pas exécuter Python.

Depuis `garmin-service/` :

```sh
cp .env.example .env
chmod 600 .env
mkdir -p data/tokens
```

Renseigner **localement** `.env` avec le compte déjà utilisé par votre service et une clé **distincte de `ROWING_API_KEY`** : `APP_SPORT_API_KEY`, au moins 32 caractères aléatoires (par exemple 32 octets générés avec `secrets.token_urlsafe(32)`). Aucun secret ne va dans `garmin-config.js`, GitHub, le chat ou une capture.

Le conteneur tourne en UID/GID 10001. Préparer les permissions du **nouveau** dossier `data` pour cet utilisateur (sur ce dossier dédié uniquement : `sudo chown -R 10001:10001 ./data`, puis droits 700 pour les dossiers et 600 pour les fichiers). Copier les jetons existants dans `data/tokens/` avec permissions privées (dossier 700, fichiers 600), ou initialiser de nouveaux jetons ci-dessous. Ne pas modifier les permissions des données originales ni partager le même dossier de jetons en écriture entre les deux services : cela évite les conflits de renouvellement. Une copie de jetons expirés ne prouve pas que la connexion fonctionne.

```sh
docker compose build
docker compose up -d
```

Si une connexion interactive ou un code Garmin est nécessaire, la réaliser **sur le serveur**, imports arrêtés :

```sh
docker compose stop
docker compose run --rm -it garmin-app-sport python login.py
docker compose up -d
```

La connexion HTTP n’attend jamais un code MFA dans une console : si la session est invalide, elle renvoie une erreur explicite sans envoyer le fichier. Les jetons chargés/renouvelés sont enregistrés côté serveur avec permissions privées. Les identifiants du compte restent dans l’environnement privé du service, comme dans votre version existante ; ils ne sont pas chiffrés par cette application. Protéger le disque et les sauvegardes du serveur.

**Un seul worker/conteneur pour ce compte et ces jetons.** Ne pas augmenter le nombre de workers ni exposer l’ancien service de remplacement.

## Accès depuis le téléphone

Le port 8766 est publié uniquement sur `127.0.0.1` de la machine Docker. Il faut lui donner une adresse **HTTPS** joignable depuis le téléphone via votre reverse proxy. Exemple pour Caddy installé sur l’hôte, après configuration DNS d’un sous-domaine que vous contrôlez :

```caddyfile
garmin.votre-domaine.fr {
    reverse_proxy 127.0.0.1:8766
}
```

Ne pas publier directement le port HTTP sur Internet. Configurer au niveau du proxy une limitation des connexions et tentatives d’authentification ; la clé aléatoire et l’authentification restent obligatoires. Ne pas journaliser les en-têtes Authorization ni les corps. Si le proxy est lui-même dans Docker, utiliser une liaison réseau privée appropriée plutôt que son propre localhost.

Dans `garmin-config.js`, mettre seulement l’origine publique :

```js
window.APP_SPORT_GARMIN_CONFIG={backendURL:'https://garmin.votre-domaine.fr'};
```

`ALLOWED_ORIGINS` contient l’origine exacte du frontend (`https://pdo78.github.io`, sans `/APP-SPORT`). Pour une prévisualisation, ajouter son origine exacte séparée par une virgule, sans wildcard. Le navigateur refuse les backends HTTP, sauf localhost pour les tests. Aucune URL de serveur n’est configurée par défaut : le code livré ne prétend pas être déjà connecté.

Dans le formulaire de séance : choisir Garmin, saisir la clé du service, se connecter, vérifier/corriger toutes les valeurs, renseigner le vrai début, cocher la vérification puis appuyer sur **Envoyer la séance vérifiée à Garmin**. Le statut « service accessible » ne certifie pas une connexion Garmin : celle-ci est vérifiée au moment de l’envoi.

La clé reste en mémoire, est effacée du champ après saisie et disparaît à la déconnexion ou au rechargement. Aucun mot de passe Garmin n’est stocké dans le téléphone. Seuls une référence aléatoire d’envoi et l’origine du backend peuvent être conservées dans `sessionStorage` pour retrouver l’état après rechargement, sans clé ni fichier.

## API et prévention des doublons

Toutes les routes nécessitent `Authorization: Bearer <APP_SPORT_API_KEY>`, avec réponses `no-store` et CORS limité.

| Route | Fonction |
|---|---|
| `GET /v1/status` | Disponibilité/configuration du service personnel, sans appel Garmin. |
| `POST /v1/imports` | JSON `{request_id: UUID, fit_base64: string, confirmed: true}` ; maximum 800 000 octets de JSON / 512 000 octets FIT. |
| `GET /v1/imports/{request_id}` | État persistant de cet envoi, sans réimport. |

Le serveur vérifie le CRC FIT, un seul résumé et un type sportif autorisé. Les exports TCX et FIT existants ne sont pas modifiés. Le TCX et l’import manuel Strava/Garmin restent disponibles.

SQLite conserve le UUID, le SHA-256 du fichier, l’état et l’identifiant Garmin. La réservation est atomique avant tout appel d’upload. Même fichier, même résultat : y compris avec un autre UUID ou après redémarrage. Une même référence avec un fichier différent est refusée. Limites : 20 requêtes authentifiées/minute et 20 nouveaux envois/24 h. Le dossier de données doit être persistant et sauvegardé ; effacer SQLite efface la mémoire anti-doublon.

- `verified` (HTTP 200) : un identifiant unique a été renvoyé par cet import et ses mesures ont été relues dans Garmin. Le lien de l’activité est affiché.
- `pending` (HTTP 202) : réservation/envoi en cours, ou processus interrompu. Vérifier Garmin et l’état ; aucun nouvel upload automatique.
- `uncertain` (HTTP 202) : délai dépassé, résultat incomplet ou mesures/type/date non confirmés. **Ce n’est pas une réussite.** Aucun renvoi automatique et aucune suppression d’activité. Un administrateur doit résoudre un état incertain avant toute reprise exceptionnelle.

Si la réponse réseau se perd, « Vérifier l’état » consulte le UUID existant. Le navigateur ne reposte pas automatiquement. Si le backend retourne un UUID de déduplication différent, celui-ci devient la référence de suivi. « Terminer le suivi » efface le suivi du téléphone, pas la protection du serveur. Ne pas changer une valeur pour contourner un état incertain : cela pourrait créer un doublon. La déduplication par fichier ne détecte pas une activité antérieure créée par la montre, un autre outil ou un fichier différent.

## Tests et limites

```sh
python3 -m venv /tmp/app-sport-garmin-venv
/tmp/app-sport-garmin-venv/bin/pip install -r garmin-service/requirements.txt httpx==0.28.1
/tmp/app-sport-garmin-venv/bin/python -m unittest discover -s tests/garmin -p '*_test.py' -v
GARMIN_TEST_PYTHON=/tmp/app-sport-garmin-venv/bin/python npm run test:garmin:browser
npm test
npm run test:browser
```

Le test navigateur utilise Chromium mobile, le vrai FastAPI, SQLite et de vrais FIT produits par l’encodeur existant. Seul Garmin est simulé. Les tests couvrent rameur/tapis, authentification, consentement, CRC, contrôles de valeurs, CORS, déduplication concurrente/persistante, réponse incertaine, suivi après rechargement, absence de secret dans le stockage et conservation de l’export TCX. Ils ne prouvent pas l’acceptation par Garmin ni le fonctionnement sur un iPhone physique.

**Aucun import réel sur votre compte, aucun déploiement et aucune fusion dans main n’ont été effectués.** Pour le test réel, il reste à installer la passerelle privée, configurer son HTTPS et l’origine publique du frontend. La bibliothèque Garmin est non officielle ; son accès peut changer ou être limité. L’intégration IA reste indépendante et nécessite toujours son propre backend/configuration OpenAI.

Résultats détaillés des vérifications exécutées : [GARMIN-VALIDATION.md](GARMIN-VALIDATION.md).
