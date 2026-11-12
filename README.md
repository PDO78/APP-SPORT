# APP-SPORT

Application en français destinée aux smartphones : Safari iPhone et Chrome Android. Photo ou vidéo d’un écran de tapis, rameur ou elliptique → OCR local → vérification/correction → fichier TCX. La navigation et la saisie manuelle restent disponibles.

**Pour le test sur téléphone : [TEST-SMARTPHONE.md](TEST-SMARTPHONE.md).** Aucun PC n’est nécessaire à l’utilisation. Le site doit être publié sur HTTPS avant utilisation ; aucun déploiement automatique n’est ajouté.

## Parcours et limites

Choisir l’équipement, photographier ou sélectionner des photos. Pour une vidéo, utiliser le lecteur pour mettre en pause sur chaque écran puis capturer des images (12 maximum). Les images sélectionnées sont analysées avec Tesseract.js. Les valeurs associées à des libellés et unités explicites sont proposées ; les données absentes ou contradictoires restent vides. Chaque valeur et l’heure réelle de début doivent être vérifiées avant l’export. Un bouton permet de commencer une autre séance sans mélanger tapis et rameur.

Les photos ne quittent pas le téléphone. Aucun mot de passe n’est demandé et aucun service OCR externe n’est utilisé. Les fichiers versionnés Tesseract.js 5.1.1, core 5.1.1 et le modèle anglais sont inclus dans `vendor/ocr`, avec notices et empreintes SHA-256. Le moteur reconnaît des caractères latins ; le parseur prend en charge des libellés français et anglais. Il ne peut pas attribuer une signification à des chiffres isolés ni garantir la lecture de segments LCD ou d’écrans reflétants.

Exemples : TIME 30:00, Durée 30 min, Distance 5000 m, Calories 250, FC 120, SPM 24, Allure 2:00, Watts 110, RPM 60, Niveau 8, Vitesse 10 km/h, Inclinaison 3 %. Les libellés et valeurs peuvent être sur deux lignes consécutives. Aucun chiffre absent n’est remplacé par zéro. Les calories, requises par le format TCX, doivent être connues pour exporter. Ne renseigner la FC moyenne que si elle est connue comme moyenne.

Le TCX contient un résumé de séance et les mesures spécifiques dans les notes. Aucune trace GPS ni série temporelle n’est inventée. Le partage vers Fichiers et le téléchargement ont un repli explicite. Garmin/Strava peuvent exiger un import depuis leur site web, accessible depuis le téléphone ; l’application ne peut pas forcer leur application native à accepter le fichier. Aucun import automatique Garmin ou Strava n’est implémenté.

Les valeurs et images restent en mémoire : enregistrer le TCX et garder les médias originaux avant de fermer ou recharger la page. HEIC et codecs vidéo dépendent du navigateur et du téléphone ; utiliser JPEG/PNG si nécessaire. Connexion Internet recommandée pendant le test ; aucun mode hors connexion n’est promis.

## Développement et validation

Le site statique fonctionne directement à partir de la racine du dépôt sur GitHub Pages, sans compilation. `.nojekyll` évite un traitement Jekyll des ressources.

Pour les développeurs : Node 22 ou ultérieur, `npm ci`, puis `npm test`. Les 14 tests couvrent l’extraction OCR, les règles TCX et la politique du coffre natif. `npm run test:browser` nécessite Playwright et Chromium (configurable par `CHROMIUM_PATH`, valeur par défaut `/usr/bin/chromium`). Ce test démarre son propre serveur, utilise un sous-chemin comme GitHub Pages, exécute réellement l’OCR et vérifie les exports tapis/rameur et les erreurs. `TEST_WEBKIT=1 npm run test:browser` active les mêmes tests WebKit si le navigateur est installé. L’installation WebKit a été bloquée par la politique réseau de l’environnement : Safari physique reste à tester.

`npm run vendor:ocr` recopie les artefacts depuis les paquets verrouillés et régénère `vendor/ocr/SHA256.json`. Les licences et versions sont conservées dans le dépôt. Aucun script ne pousse, ne fusionne ni ne déploie le projet.

## Base native conservée pour une étape ultérieure

Les dossiers `android`, `ios` et `mobile` constituent une base Capacitor 8, sans incidence sur l’utilisation web smartphone. Le navigateur ne charge pas le coffre natif et n’y stocke aucun secret. Ces projets ne sont pas requis pour le test dans le navigateur.

`npm run sync:mobile` construit puis synchronise les ressources natives. Pour une future distribution, il faudra compiler et signer avec les outils Android ou macOS/Xcode, puis tester sur appareil. Aucun APK/IPA n’est produit ou publié ici. Le coffre utilise Keychain iOS sans synchronisation iCloud et Keystore Android ; sauvegarde Android désactivée. Il refuse le navigateur et expire les entrées après 7 jours, à chaque lecture, au démarrage et au retour au premier plan. Une application fermée ne garantit pas l’effacement exactement à l’échéance. Les tests du coffre utilisent un adaptateur simulé et ne valident pas le trousseau matériel. Aucun formulaire d’identifiants ni intégration d’authentification Garmin/Strava n’est activé.
