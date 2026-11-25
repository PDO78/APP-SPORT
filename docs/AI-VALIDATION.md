# État de validation — feature/ai-vision

## Vérifications exécutées

| Vérification | Résultat | Portée réelle |
|---|---|---|
| `npm test` | 55 tests réussis | Inclut les tests existants et les tests IA/auth/quota. Les réponses OpenAI sont simulées. |
| `npm run test:browser` | Réussi | Chromium avec affichage tactile 390 × 844, vrai Worker/Durable Object local, fournisseur IA simulé. Navigation, consentement, JSON avant reprise, correction, TCX, annulation, erreurs, extraction vidéo et analyse groupée. |
| `npm run worker:check` | Réussi | Compilation Wrangler avec `--dry-run`, aucun déploiement. |
| `npm run sync:mobile` | Réussi | Copie/construction des ressources et synchronisation Capacitor ; pas de compilation signée iOS/Android. |
| TCX | Inchangé | `tcx.js` SHA-256 `461b4b56c029d720902852f88f51778b113b4ec2a63202e5eae02bb6c3c85e7b` ; `fit.js` et `session.js` également inchangés. |
| Quotas | Réussis en runtime local | Requêtes concurrentes, limites par nombre d’images et persistance après redémarrage du runtime. |

Les valeurs attendues ne sont pas dans le moteur ou le prompt. Les exemples chiffrés des tests sont des fixtures simulées ou des assertions de référence ; ils ne sont jamais envoyés au modèle comme valeurs attendues.

## Tests réels obligatoires : bloqués, pas réussis

| Test | État | Prérequis manquant |
|---|---|---|
| IMG_0205.jpeg — Heubozen | **Non exécuté** | Photo visible dans le chat ; fichier JPEG original pas accessible dans le workspace. |
| IMG_0204.mp4 — tapis | **Non exécuté** | Vraie vidéo reçue et examinée ; appel OpenAI encore non exécuté. |
| Appel réel Responses API | **Non exécuté** | Pas de Worker déployé/configuré, ni de liaison OpenAI disponible pour cet essai. |
| Safari iPhone / Android physique | **Non exécuté** | Les tests de navigateur sont réalisés dans Chromium mobile simulé, pas sur les téléphones réels. |

Le lancement de `npm run test:vision:real -- /workspace/attachments` a quitté avec le code **2**, en listant explicitement les deux fichiers et les trois variables de test manquants. Aucun fournisseur n’a été appelé et aucune lecture des deux médias n’a été revendiquée. L’ancien JPEG du rameur, portant d’autres données, n’a pas été substitué à IMG_0205.jpeg.

La documentation [AI-VISION.md](AI-VISION.md) décrit la configuration sécurisée et la procédure. La référence des libellés/unités du tapis sera rédigée après inspection indépendante des images de sa vraie vidéo : c’est un artefact de test, pas une tâche imposée à l’utilisateur pour reconnaître sa séance et pas une consigne transmise à l’IA.

## Publication

Cette phase est limitée à `feature/ai-vision`. Aucun Worker n’a été déployé, aucune fusion vers `main` et aucune mise à jour de `gh-pages` ne font partie de cette validation. `backendURL` reste vide en attente de configuration sécurisée. La fiabilité de reconnaissance n’est pas déclarée validée avant les essais réels.

## Vidéo réelle reçue le 25 novembre 2026

`IMG_0204(2).mp4`, 20 433 091 octets, durée 32,233 s, SHA-256 `13e05a418027fd200ceb3ec633f01bbc0fd2f863ba1130f6e3b4d0e95622be00`.

Inspection visuelle indépendante des images extraites :

| Affichage | Libellé visible | Interprétation permise |
|---|---|---|
| 138 | CALS | Calories affichées ; aucune moyenne à supposer. |
| 81 | BPM | Fréquence cardiaque affichée ; pas de mention de moyenne. |
| 15:19 | TIME | Durée affichée. |
| 1.356 | KM | Distance de 1,356 km, soit 1 356 m. La décimale doit être préservée. |

Le vrai décodage dans Chromium mobile a révélé une régression : les tremblements empêchaient la sélection d'écrans stables et le repli retenait uniquement « done ». Correction : si aucun écran stable n'est trouvé, conserver la première image et les images les plus nettes par intervalle temporel (12 images maximum), avec avertissement de résultat potentiellement incomplet. Ce repli couvre la durée ; il ne prétend pas identifier chaque changement d'écran.

Commande reproductible : `node tests/vision/extract-real.mjs /chemin/IMG_0204.mp4`. Ce test n'appelle aucun fournisseur et ne simule aucune lecture : il enregistre les vraies images et leur rapport dans `real-vision-results/extraction/`, ignoré par Git. Sur ce fichier : 12 images extraites, vérification visuelle des quatre affichages. Un test automatisé supplémentaire vérifie le repli temporel. Les médias privés ne sont pas committés.

**La lecture de la vidéo par la Responses API n'est toujours pas validée** : Worker et accès OpenAI non configurés. La photo affichée dans le chat correspond visuellement à la séance attendue (15:21, 2312 m, 126 kcal, 377 coups, niveau 6, PAUSE), mais ne remplace pas le test automatisé du fichier JPEG original.
