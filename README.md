# APP-SPORT — reconnaissance IA, phase 1

Application smartphone en français, interface statique compatible GitHub Pages, iPhone et Android. Le parcours principal utilise désormais un modèle multimodal via **OpenAI Responses API**, derrière un **Cloudflare Worker authentifié**. Tesseract n’est plus chargé par ce parcours. Les fichiers de l’ancien moteur sont conservés pour l’historique et certains tests de support ; ils ne constituent pas un repli silencieux.

L’interface et ses pages photo, vidéo, navigation et saisie manuelle sont conservées. La vidéo est parcourue localement pour extraire des images stables et représentatives ; elles sont interprétées **ensemble dans une seule demande**. Le résultat JSON et ses images sources sont affichés avant tout calcul ou reprise du formulaire. Les valeurs instantanées, moyennes, cumulées et réglages restent séparés. Les valeurs absentes/illisibles ou contradictoires restent non renseignées. La correction manuelle reste disponible.

**Les exports ne sont pas modifiés : `tcx.js`, `fit.js` et `session.js` restent identiques à la version de départ.** Aucun export ni transfert Garmin n’est déclenché par la reconnaissance.

## Configuration indispensable

Lire [docs/AI-VISION.md](docs/AI-VISION.md) pour les secrets Cloudflare, comptes APP-SPORT, quotas, modèle, déploiement de préproduction et tests réels. `vision-config.js` ne contient qu’une URL publique de Worker : **aucune clé API ne doit apparaître dans le frontend ou GitHub**.

Par défaut `backendURL` est vide : la reconnaissance IA est explicitement indisponible tant que le backend sécurisé n’est pas configuré. La saisie manuelle et les exports restent utilisables. Le compte d’analyse APP-SPORT est distinct de Garmin. Le jeton temporaire reste uniquement en mémoire et un consentement à l’envoi des images est requis.

## Validation

- `npm ci`, puis `npm test` : tests unitaires existants + protocole IA, authentification et quotas transactionnels dans le runtime Worker local. Le fournisseur IA est **simulé**.
- `npm run test:browser` : parcours mobile, authentification, consentement, revue JSON avant reprise, correction manuelle, export TCX, vidéo groupée, annulation et erreurs. Le fournisseur IA est **simulé**, ces tests ne prouvent pas la reconnaissance des médias réels.
- `npm run worker:check` : compilation Worker sans déploiement (voir les variables de répertoire temporaires dans la documentation si l’environnement interdit les caches utilisateur).
- `npm run test:vision:real -- /chemin/des/medias` : tests avec les vrais `IMG_0205.jpeg` et `IMG_0204.mp4`, un Worker et l’API opérationnels. Aucun mock dans ce programme. Il refuse de partir si un prérequis manque.

**Vidéo réelle reçue et découpée : 12 images vérifiées visuellement.** Libellés observés : 138 CALS, 81 BPM (sans mention de moyenne), 15:19 TIME et 1.356 KM. Un repli temporel corrige la perte des écrans en cas de tremblements. Reproduire avec `node tests/vision/extract-real.mjs /chemin/video.mp4` ; aucun appel IA dans ce test. **Tests réels OpenAI non exécutés** : configuration Worker/OpenAI manquante et photo originale non accessible comme fichier (visible dans le chat). Voir [le rapport détaillé](docs/AI-VALIDATION.md).

Cette phase se développe sur `feature/ai-vision`. Aucune fusion dans `main` ni publication automatique. La base Capacitor iOS/Android est conservée, mais aucun binaire natif n’est compilé ou distribué par cette phase. Les essais sur appareils physiques restent nécessaires après configuration du backend.

## Envoi direct à votre service Garmin personnel

Une passerelle Python/Docker est livrée dans `garmin-service/`, adaptée aux variables et jetons de votre service existant. Elle crée une nouvelle activité FIT après vérification des valeurs, sans supprimer ni remplacer une activité de montre. Rameur, tapis et elliptique sont pris en charge. Une clé d’accès saisie sur le téléphone reste uniquement en mémoire ; les identifiants Garmin restent sur votre serveur. **Cette version est personnelle, avec le compte Garmin du serveur, pas une connexion Garmin multiutilisateur.**

L’envoi dispose d’une déduplication SQLite et d’un suivi après interruption. Une réponse incertaine ne devient jamais une réussite et ne déclenche pas de nouvel envoi. L’export TCX/FIT existant et les imports manuels restent disponibles.

Voir [la configuration et les tests de la passerelle](docs/GARMIN-SERVICE.md). Aucune URL de service n’est configurée par défaut, aucun serveur n’est déployé automatiquement. Les essais utilisent Garmin simulé : aucun import réel n’est revendiqué.
