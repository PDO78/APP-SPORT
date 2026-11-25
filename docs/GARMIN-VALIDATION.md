# Validation de la liaison Garmin — 25 novembre 2026

| Vérification exécutée | Résultat | Portée |
|---|---|---|
| `npm test` | 55 tests réussis | Régressions des données, exports, reconnaissance et sécurité IA ; fournisseur IA simulé. |
| Tests Python `tests/garmin/service_test.py` | 17 tests réussis | Vrai FastAPI/SQLite, vrais FIT et CRC. Garmin simulé. Authentification, limites, CORS, confidentialité, vérification de chaque mesure, absence de suppression, déduplication et concurrence. |
| `npm run test:garmin:browser` | Réussi | Chromium mobile tactile 390 × 844, vrai serveur Python, vrais fichiers FIT. Rameur et tapis, confirmation, doublons, TCX, réponse réseau perdue après réception, vérification de l’état et reprise après rechargement sans renvoi. Garmin simulé. |
| `npm run test:browser` | Réussi | Navigation, reconnaissance IA/revue/correction, vidéo et export TCX toujours fonctionnels avec fournisseur IA simulé. |
| `npm run build:mobile` | Réussi | Nouveaux scripts Garmin inclus dans les ressources mobiles ; pas de binaire signé. |
| Docker Compose | Configuration valide | Vérification avec une copie temporaire de `.env.example`, aucun secret utilisateur. |
| Image Docker | Construite et testée | Import FastAPI et création SQLite avec UID 10001, racine en lecture seule et réseau désactivé. |
| Exports | Inchangés | Aucune modification de `tcx.js`, `fit.js` ou `session.js` par rapport à `main`. |

Le premier build Docker a échoué sur le certificat du proxy réseau de l’environnement. Le build de vérification a ensuite injecté le bundle CA de confiance de l’environnement via un secret BuildKit et un Dockerfile temporaire, uniquement pour l’étape pip. La vérification TLS n’a pas été désactivée et aucun certificat interne n’est ajouté au code ni à l’image finale. Le Dockerfile livré utilise normalement les certificats publics de l’image Python.

## Ce qui n’a pas été testé ou effectué

- Aucun appel au compte Garmin réel et aucune activité créée, remplacée ou supprimée.
- Aucune validation réelle de MFA ou renouvellement Garmin : ces chemins utilisent des doubles de test et nécessitent un essai sur le service privé.
- Aucun essai physique Safari iPhone/Chrome Android : Chromium mobile est une simulation du format tactile, pas une preuve sur ces appareils.
- Aucun déploiement du serveur Python, de GitHub Pages ou de Worker. L’origine publique dans `garmin-config.js` est vide.
- Pas de connexion multiutilisateur : le compte Garmin reste celui du serveur personnel.
- Les tests réels OpenAI de la phase reconnaissance restent indépendants et ne deviennent pas réussis grâce à cette liaison.

La branche de travail reste `feature/ai-vision`. `main` et `gh-pages` ne sont pas modifiées. Les secrets, jetons, bases SQLite et données privées ne sont pas inclus dans Git. Voir [la configuration du service](GARMIN-SERVICE.md).
