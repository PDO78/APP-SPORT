# APP-SPORT

Application statique en français, compatible avec un déploiement GitHub Pages sans compilation. Aucun identifiant Garmin demandé. Les médias restent dans le navigateur ; Tesseract.js 5.1.1, son moteur et le modèle anglais (libellés sportifs français et anglais pris en charge par l’extraction) sont téléchargés depuis jsDelivr. Une connexion est nécessaire au premier usage.

## Utilisation

Choisir l’équipement puis le mode automatique. Photographier un écran ou sélectionner des photos. Pour une vidéo, utiliser les contrôles du lecteur, mettre en pause puis capturer chaque écran utile. Cocher les images à analyser (12 maximum), lancer l’analyse, vérifier et corriger le formulaire. La date proposée correspond à l’heure actuelle : corriger la date de la séance. Les images peuvent être effacées après l’analyse.

L’extraction exige des libellés et, pour distance et vitesse, des unités explicites : TIME 30:00, Durée 30 min, Distance 5000 m, Calories 250, FC 120, SPM 24, Allure 2:00, Watts 110, RPM 60, Niveau 8, Vitesse 10 km/h, Inclinaison 3 %. Sans libellé ou en cas de valeurs contradictoires, le champ reste vide et un message invite à la saisie. Les écrans à chiffres seuls ou segments LCD mal éclairés peuvent nécessiter une saisie manuelle. Les images de plusieurs séances ne doivent pas être mélangées. Les données spécifiques sont conservées dans les notes TCX ; elles ne constituent pas une série temporelle mesurée. L’OCR ne reconnaît pas la date de séance. Les calories sont obligatoires pour l’export TCX : aucune valeur manquante n’est remplacée par zéro.

Utiliser une photo nette JPEG/PNG et une vidéo dans un format que le navigateur sait lire. HEIC et certains codecs vidéo dépendent du téléphone ; un message indique les fichiers illisibles. Safari iPhone et Chrome Android disposent des parcours de capture via les sélecteurs natifs, du lecteur vidéo playsinline et du téléchargement. Une validation sur appareils physiques reste nécessaire, particulièrement pour les codecs, la mémoire et le partage du TCX.

## Développement et tests

Démarrer `python3 -m http.server 8000 --bind 127.0.0.1` depuis le dépôt.

- `node --test tests/ocr.test.cjs` : extraction, équipements, valeurs absentes et conflits.
- `node tests/browser.cjs` : nécessite Playwright et Chromium `/usr/bin/chromium`. Navigation mobile, véritable OCR d’une image synthétique, correction et téléchargement TCX. Les téléchargements HTTPS sont relayés par curl dans ce test pour respecter le proxy et la confiance TLS du cloud.

Aucune publication automatique. Tester des photographies représentatives des appareils avant d’évaluer la précision réelle de reconnaissance.
