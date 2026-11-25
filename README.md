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

**État des tests réels : non exécutés.** Les deux nouveaux fichiers et une configuration Worker/OpenAI utilisable ne sont pas encore disponibles. Les anciens médias du rameur ne remplacent pas les fichiers demandés. Les quatre valeurs du tapis ne sont associées à aucun libellé/unité par supposition : leur référence devra être vérifiée sur la vidéo réelle.

Cette phase se développe sur `feature/ai-vision`. Aucune fusion dans `main` ni publication automatique. La base Capacitor iOS/Android est conservée, mais aucun binaire natif n’est compilé ou distribué par cette phase. Les essais sur appareils physiques restent nécessaires après configuration du backend.
