# Reconnaissance IA — phase 1

Cette branche conserve les pages, identifiants de navigation, contrôles photo/vidéo, saisie manuelle et exports. **`tcx.js`, `fit.js` et `session.js` ne sont pas modifiés.** Tesseract n’est plus chargé ni utilisé par le parcours principal ; aucun repli OCR silencieux n’est effectué lorsque l’IA est indisponible.

## Architecture et confidentialité

GitHub Pages sert uniquement les fichiers publics. `vision-config.js` contient uniquement l’URL HTTPS du Worker. Le téléphone redimensionne les images, parcourt la vidéo localement et extrait les écrans nets et distincts. Les images sélectionnées sont transmises **ensemble dans un seul appel** au Worker, puis dans un seul appel à `https://api.openai.com/v1/responses`. Le fichier vidéo complet n’est pas téléversé. Aucun recadrage n’est requis pour le parcours principal.

Le Worker utilise `model: gpt-4.1` par défaut, compatible images et Structured Outputs ; le modèle est une variable serveur, jamais un choix envoyé par le client. Il envoie `input_image` avec `detail: high`, `text.format.type: json_schema`, `strict: true`, `store: false` et une limite de sortie. `store: false` ne signifie pas une garantie de rétention zéro chez le fournisseur : consulter les règles du projet OpenAI avant utilisation. Le consentement explicite à l’envoi est demandé sur le téléphone. Le Worker n’enregistre ni médias, ni lectures, ni mot de passe en clair et ne journalise pas les requêtes. Les quotas ne conservent que des compteurs et baux temporaires. Le fournisseur peut néanmoins appliquer ses propres conditions de traitement des données.

La documentation web OpenAI a été bloquée par le réseau du cloud pendant cette implémentation. La forme de la requête a été recoupée avec les types officiels de `openai/openai-node`, `src/resources/responses/responses.ts` et `src/resources/shared.ts` sur GitHub : entrée `input_image`, format JSON Schema et modèle `gpt-4.1`. Un vrai appel API reste indispensable avant de considérer le déploiement opérationnel.

## Configuration Cloudflare — sans clé dans GitHub

Prérequis : Node 22+, compte Cloudflare avec Workers/Durable Objects SQLite, projet OpenAI avec accès au modèle choisi. Une offre Workers permettant la limite CPU configurée (1000 ms) est requise ; la dérivation PBKDF2 ne doit pas être supposée compatible avec un budget CPU gratuit de 10 ms. Le service n’est pas déployé automatiquement.

1. Depuis la racine : `npm ci` puis `npx wrangler login`.
2. Réviser `backend/wrangler.jsonc` : nom du Worker, `ALLOWED_ORIGINS` (origines exactes, **sans chemin ni slash final**, jamais `*`), modèle et quotas. Pour GitHub Pages l’origine est `https://pdo78.github.io`, pas l’URL `/APP-SPORT/`.
3. Créer un compte d’analyse indépendant de Garmin : `node backend/scripts/create-user.mjs monidentifiant`. Cette commande génère une phrase aléatoire forte, son hachage et une clé de session dans `backend/.secrets/`, ignoré par Git. Elle ne remplace aucun fichier existant et n’affiche aucune valeur secrète. Lire `initial-login.txt` uniquement localement, conserver la phrase dans un gestionnaire de mots de passe, puis supprimer cette copie si souhaité. Aucun secret ne doit être transmis dans le chat.
4. Déclarer les secrets Cloudflare, par l’invite sécurisée ou les fichiers locaux :

   ```sh
   npx wrangler secret put OPENAI_API_KEY --config backend/wrangler.jsonc
   npx wrangler secret put SESSION_HMAC_KEY --config backend/wrangler.jsonc < backend/.secrets/session-key.txt
   npx wrangler secret put AUTH_USERS_JSON --config backend/wrangler.jsonc < backend/.secrets/users.json
   ```

   La clé OpenAI doit être saisie uniquement dans l’invite ou le tableau de bord Cloudflare, jamais dans `vision-config.js`, une commande contenant sa valeur, un commit ou GitHub Pages. Utiliser une clé de projet dédiée et des alertes/budgets côté fournisseur. Les quotas ci-dessous bornent les appels et images, pas une facture monétaire garantie.
5. Après revue explicite du déploiement : `npx wrangler deploy --config backend/wrangler.jsonc`. La migration Durable Object crée le stockage partagé. Ne pas déployer cette branche dans `main` automatiquement.
6. Copier seulement l’origine HTTPS obtenue dans `vision-config.js`, par exemple `https://app-sport-vision.VOTRE-SOUS-DOMAINE.workers.dev`. Garder `backendURL: ''` tant que le backend n’est pas configuré : le frontend affiche alors un blocage explicite et garde la saisie manuelle accessible.
7. Ouvrir le site de préproduction dans Safari/Chrome, saisir l’identifiant et la phrase APP-SPORT, confirmer l’envoi des images. Ce ne sont ni des identifiants Garmin ni une clé OpenAI.

Les secrets et variables de cette machine cloud ont été vérifiés : aucune liaison OpenAI/Cloudflare utilisable n’était disponible pendant l’implémentation. Il ne faut pas inventer de clé ou supposer que le Worker est déployé.

## Authentification, quotas et limites

- Comptes provisionnés par l’administrateur ; pas d’inscription publique. PBKDF2-SHA256, sel aléatoire, 100 000 itérations, phrase aléatoire de 192 bits générée par l’outil.
- Jeton HMAC-SHA256 de 15 minutes, signé seulement dans le Worker ; vérification de signature, audience, émetteur, date et version du compte. Retirer le compte ou augmenter `version` invalide ses jetons. Changer la clé invalide toutes les sessions.
- Le jeton n’est conservé qu’en mémoire de la page. Aucun jeton ou clé API n’est inséré dans le DOM ou les URLs. Ni jeton ni phrase secrète ne sont enregistrés dans localStorage ou sessionStorage. La phrase n’existe dans le champ de saisie que pendant la connexion. La phrase de connexion est effacée du champ après soumission. La déconnexion oublie le jeton et annule une analyse en cours ; elle ne garantit pas l’interruption d’un appel déjà parti chez OpenAI, ni l’annulation de sa facturation.
- CORS exact et prévol avec Authorization. CORS n’est pas une authentification ; le jeton est obligatoire pour chaque analyse. Les navigateurs iPhone n’ont pas besoin de cookies tiers.
- Durable Object transactionnel partagé : par défaut 3 analyses/minute/utilisateur, 20/jour/utilisateur, 60 images/jour/utilisateur, 240 images/jour au total, deux analyses simultanées/utilisateur. Compteurs persistants : redémarrer un Worker ne réinitialise pas les quotas. Une tentative fournisseur compte même en cas d’échec et n’est pas remboursée automatiquement. Fenêtres fixes en UTC, délai `Retry-After` sur 429.
- Connexion limitée par IP (10/15 minutes), compte (5/15 minutes) et service (200/jour). Les adresses IP sont hachées avant stockage. Les requêtes d’analyse malformées sont également bornées (20/minute, 200/jour/utilisateur). Les compteurs expirés sont nettoyés quotidiennement.
- 12 JPEG/PNG maximum, 2 Mio compressés par image, 2048 px par côté, 4 millions de pixels/image, 10 Mio pour la requête. Les URLs distantes sont refusées. Le téléphone produit des JPEG de 1600 px maximum ; les signatures et dimensions sont contrôlées au serveur avant tout appel payant.
- Délai fournisseur 80 s, client 110 s ; pas de nouvelle tentative automatique susceptible de doubler les coûts. Aucun endpoint public ne sert de proxy OpenAI anonyme. Les erreurs fournisseur détaillées ne sont pas transmises au navigateur.

`GET /health` indique uniquement que les liaisons semblent présentes : ce n’est pas une preuve de validité de la clé, de disponibilité du modèle ou de réussite d’un test réel.

## Contrat de reconnaissance et revue humaine

`vision-contract.js` définit le JSON strict : équipement, état, lectures classées (`instantaneous`, `average`, `cumulative`, `setting`, `unknown`), valeur transcrite **en chaîne**, unité, libellé réellement lu, texte brut, statut, confiance et images sources. Les nombres sans libellé ou unité fiables restent non attribués, jamais affectés par plausibilité. Absence, tirets, illisibilité et contradictions donnent `null`, pas zéro. Un zéro lisible instantané est conservé et affiché comme tel.

Le JSON et les lectures apparaissent avant toute conversion ou remplacement du formulaire. Le bouton de reprise déclenche seulement ensuite les conversions nécessaires au formulaire existant. Seuls les totaux/réglages/moyennes explicitement classés, de haute confiance et dans une unité connue peuvent remplir les champs correspondants. Une fréquence instantanée ne remplit jamais la FC moyenne. Même si le modèle écrit `average`, une mention explicite AVG/AVERAGE/MOYENNE dans le libellé ou texte cité est exigée par le code avant toute reprise d’une moyenne. Aucune cadence, puissance ou allure instantanée n’est transformée en moyenne. Les conflits et unités non prises en charge restent à corriger manuellement. L’heure réelle de début reste à saisir ; l’IA ne la déduit pas.

Les Structured Outputs garantissent un format, **pas la vérité des lectures**. La confiance déclarée par le modèle n’est pas une garantie statistique. Les tests réels et la vérification de l’utilisateur restent indispensables. Aucun export n’est déclenché par la reconnaissance.

## Tests et statut des deux médias demandés

- `npm run test:vision` : contrat, mapping, authentification et vrai runtime Worker/Durable Object local ; réponses OpenAI **simulées**.
- `npm run test:browser` : interface mobile, connexion/consentement, résultat avant reprise, correction, export TCX inchangé, annulation, erreurs et extraction vidéo groupée. Images et fournisseur **simulés** ; cela ne valide pas les fichiers réels.
- Les tests historiques Tesseract restent des tests historiques et ne doivent jamais être présentés comme une validation OpenAI.
- Les fichiers **IMG_0205.jpeg** et **IMG_0204.mp4** n’étaient pas accessibles. L’ancien JPEG du rameur contient d’autres données et ne les remplace pas. **Aucun des deux tests réels demandés n’est déclaré réussi.**

Pour exécuter les tests réels, transmettre ces deux fichiers (ZIP possible), déployer un Worker de préproduction correctement configuré et autoriser l’origine `http://127.0.0.1:4173` uniquement sur ce Worker de test. Le réseau de la machine de test doit autoriser le nom exact de ce Worker. Fournir localement les variables `APP_SPORT_VISION_URL`, `APP_SPORT_TEST_USER`, `APP_SPORT_TEST_PASSWORD` par un mécanisme sécurisé, puis :

```sh
npm run test:vision:real -- /chemin/des/medias
```

La référence est un artefact de développement rédigé après inspection indépendante des images réelles ; elle n’est jamais envoyée au modèle ni demandée à l’utilisateur dans le parcours normal.

Le test refuse de partir si un fichier ou une configuration manque (code de sortie 2). Il ne possède aucun fournisseur simulé. Les JSON, empreintes SHA-256 et images effectivement transmises sont enregistrés dans `real-vision-results/`, ignoré par Git, pour permettre la vérification.

Pour **IMG_0205.jpeg**, il vérifie les valeurs et catégories demandées, l’état PAUSE et l’absence de FC. Pour **IMG_0204.mp4**, aucune association des quatre nombres à des libellés/unités n’est codée à l’avance. Après le premier appel réel, les images extraites doivent être examinées indépendamment ; un fichier `IMG_0204.reference.json` contenant les lectures vérifiées (`quantity`, `aggregation`, `value`, `unit`, `label`) doit ensuite être fourni. Sans cette référence, même si les quatre nombres sont retrouvés, le test reste **à vérifier** et ne retourne pas « réussi ». On ne demande pas au modèle de valider ses propres libellés.

### Compilation sans accès en écriture au cache utilisateur

```sh
XDG_CONFIG_HOME=/tmp/app-sport-cf-config WRANGLER_LOG_PATH=/tmp/app-sport-wrangler.log WRANGLER_SEND_METRICS=false npm run worker:check
```

Cette commande compile avec `--dry-run` et ne déploie pas le Worker. Le [rapport de validation](AI-VALIDATION.md) distingue les tests techniques simulés des tests réels encore bloqués.
