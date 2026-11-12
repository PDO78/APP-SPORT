# Test réel sur smartphone — tapis et rameur

Cette version s’utilise dans Safari iPhone ou Chrome Android, sans PC et sans installation native. Elle doit être publiée sur un site HTTPS avant le test. Une branche GitHub ou une Pull Request n’est pas un site exécutable. Aucun déploiement n’est lancé par les scripts du projet.

## Avant la salle

1. Ouvrir l’URL de la version publiée sur le téléphone et vérifier la mention « Version de test smartphone • tapis et rameur ».
2. Garder une connexion Internet pendant le test. Le moteur et le modèle OCR représentent environ 11 Mo au total dans le site ; seuls les fichiers utiles au navigateur sont chargés. Aucun service OCR externe ne reçoit les photos.
3. Faire un essai photo d’un texte simple (« TIME 30:00 », « DISTANCE 5 km », « CALORIES 250 ») pour vérifier le chargement du moteur et la lecture du fichier.
4. Ne pas compter sur l’import automatique Garmin : cette version crée un TCX et guide vers l’import manuel. Aucun identifiant n’est demandé par APP-SPORT.

## À la fin du tapis

1. Photographier les écrans récapitulatifs avant leur disparition. Inclure les libellés et unités, éviter les reflets. Garder aussi les photos/vidéos originales dans Photos/Galerie : les images de l’application ne survivent pas à un rechargement.
2. Dans APP-SPORT, choisir Tapis → Automatique. Prendre une photo ou choisir plusieurs photos. Pour une vidéo, mettre en pause sur chaque écran net, cliquer « Capturer cette image », répéter et cocher les images à analyser (12 maximum).
3. Analyser, vérifier toutes les valeurs et renseigner l’heure réelle de début. Laisser la FC vide si seule une FC instantanée est connue. Les valeurs non reconnues ou contradictoires restent à saisir ; aucune estimation n’est faite. Les calories sont requises par le format TCX : ne pas en inventer si elles sont inconnues.
4. Cocher la confirmation. Utiliser « Enregistrer le TCX » ou « Partager le TCX » puis enregistrer dans Fichiers/Téléchargements. Un partage accepté ne confirme pas un import Garmin. Vérifier que le fichier est effectivement présent avant de changer de séance.

## Puis le rameur

1. Cliquer « Nouvelle séance » et confirmer après enregistrement du TCX du tapis.
2. Choisir Rameur → Automatique. Reprendre le même parcours avec les écrans récapitulatifs du rameur. Ne pas mélanger les images des deux appareils ni les valeurs intermédiaires de la vidéo.
3. Vérifier notamment distance en m/km, durée, calories, cadence, puissance et allure par 500 m. Les libellés non reconnus nécessitent une saisie manuelle ; un écran avec chiffres seuls ne permet pas d’identifier automatiquement les mesures.
4. Enregistrer le second TCX. Les noms de fichiers incluent l’équipement et l’heure de début ; ils ne s’écrasent pas pour deux séances différentes.

## Import depuis le téléphone

Choisir Garmin Connect ou Strava, enregistrer le fichier puis ouvrir le lien d’import. Se connecter exclusivement sur le site de la plateforme. Si son interface mobile masque l’import, essayer « Version pour ordinateur » dans le menu du navigateur du téléphone. La disponibilité de l’import et l’acceptation du TCX par Garmin/Strava restent à confirmer avec un vrai compte ; le bouton de partage ne peut pas forcer une application destinataire à accepter un TCX.

## Si quelque chose ne marche pas

- OCR trop long : annuler et essayer une seule photo plus nette ; la saisie manuelle reste disponible.
- HEIC/vidéo illisible : choisir une photo JPEG/PNG ou une vidéo compatible avec le téléphone. Ne pas attendre la disparition du récapitulatif pour enregistrer une photo dans la galerie.
- Donnée absente : recopier la valeur affichée, ne pas l’estimer.
- Téléchargement invisible : essayer le partage vers Fichiers ou le lien « Réessayer l’enregistrement ».
- Éviter de fermer/recharger la page avant export. Les valeurs et images ne sont pas sauvegardées automatiquement.

## Validation déjà effectuée

Tests automatisés : extraction des équipements et des unités, conflits et données absentes, politique du coffre natif, validité des données TCX ; parcours tactile Chromium avec OCR réellement exécuté sur images synthétiques tapis/rameur, lecture du XML exporté, partage simulé, séparation des séances, vidéo synthétique, annulation et échec du moteur. Le test bloque toute requête vers un domaine externe.

Ce n’est pas encore une validation sur vos écrans sportifs réels. Le téléchargement de WebKit pour tester le moteur Safari a été bloqué par la politique réseau du cloud (HTTP 403 sur les domaines de téléchargement Playwright). Safari iPhone, le partage système réel, les codecs physiques et l’import dans les comptes Garmin/Strava ne sont donc pas déclarés validés.
