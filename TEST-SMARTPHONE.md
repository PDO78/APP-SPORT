# Test réel sur smartphone — tapis et rameur

Cette version s’utilise dans Safari iPhone ou Chrome Android, sans PC et sans installation native. Elle doit être publiée sur un site HTTPS avant le test. Une branche GitHub ou une Pull Request n’est pas un site exécutable. Aucun déploiement n’est lancé par les scripts du projet.

## Avant la salle

1. Ouvrir l’URL de la version publiée sur le téléphone et vérifier la mention « Version smartphone • vidéo découpée et analysée automatiquement ».
2. Garder une connexion Internet pendant le test. Le moteur et le modèle OCR représentent environ 11 Mo au total dans le site ; seuls les fichiers utiles au navigateur sont chargés. Aucun service OCR externe ne reçoit les photos.
3. Faire un essai photo d’un texte simple (« TIME 30:00 », « DISTANCE 5 km », « CALORIES 250 ») pour vérifier le chargement du moteur et la lecture du fichier.
4. Ne pas compter sur l’import automatique Garmin : cette version crée un TCX et guide vers l’import manuel. Aucun identifiant n’est demandé par APP-SPORT.

## À la fin du tapis

1. Photographier les écrans récapitulatifs avant leur disparition. Inclure les libellés et unités, éviter les reflets. Garder aussi les photos/vidéos originales dans Photos/Galerie : les images de l’application ne survivent pas à un rechargement.
2. Dans APP-SPORT, choisir Tapis → Automatique. Prendre une photo ou choisir plusieurs photos. Pour une vidéo, filmer ou sélectionner le récapitulatif : attendre le découpage des écrans et l’analyse OCR automatiques. Il n’y a ni zone à tracer ni image à capturer à la main. Un bouton permet d’annuler ou de relancer le traitement.
3. Pour des photos, lancer l’analyse ; pour une vidéo, attendre son analyse automatique. Vérifier toutes les valeurs et renseigner l’heure réelle de début. Laisser la FC vide si seule une FC instantanée est connue. Les valeurs non reconnues ou contradictoires restent à saisir ; aucune estimation n’est faite. Les calories sont requises par le format TCX : ne pas en inventer si elles sont inconnues.
4. Cocher la confirmation. Choisir FIT ou TCX puis utiliser « Enregistrer le fichier » ou « Partager » puis enregistrer dans Fichiers/Téléchargements. Un partage accepté ne confirme pas un import Garmin. Vérifier que le fichier est effectivement présent avant de changer de séance.

## Puis le rameur

1. Cliquer « Nouvelle séance » et confirmer après enregistrement du TCX du tapis.
2. Choisir Rameur → Automatique. Reprendre le même parcours avec les écrans récapitulatifs du rameur. Ne pas mélanger les images des deux appareils ni les valeurs intermédiaires de la vidéo.
3. Vérifier notamment distance en m/km, durée, calories, cadence, puissance et allure par 500 m. Les libellés non reconnus nécessitent une saisie manuelle ; un écran avec chiffres seuls ne permet pas d’identifier automatiquement les mesures.
4. Enregistrer le second TCX. Les noms de fichiers incluent l’équipement et l’heure de début ; ils ne s’écrasent pas pour deux séances différentes.

## Import depuis le téléphone

L’import automatique Garmin/Strava n’est pas configuré dans cette version. Choisir la plateforme et enregistrer le fichier, puis effectuer l’import MANUEL sur son site. Le bouton « Copier l’adresse d’import manuel » permet de coller l’adresse dans Safari ou Chrome si le lien ouvre seulement l’application native. Se connecter exclusivement sur le site de la plateforme. Si son interface mobile masque l’import, essayer « Version pour ordinateur » dans le menu du navigateur du téléphone. La disponibilité de l’import et l’acceptation du TCX par Garmin/Strava restent à confirmer avec un vrai compte ; le bouton de partage ne peut pas forcer une application destinataire à accepter un TCX.

## Si quelque chose ne marche pas

- OCR trop long : annuler et essayer une seule photo plus nette ; la saisie manuelle reste disponible.
- HEIC/vidéo illisible : choisir une photo JPEG/PNG ou une vidéo compatible avec le téléphone. Ne pas attendre la disparition du récapitulatif pour enregistrer une photo dans la galerie.
- Donnée absente : recopier la valeur affichée, ne pas l’estimer.
- Téléchargement invisible : essayer le partage vers Fichiers ou le lien « Réessayer l’enregistrement ».
- Éviter de fermer/recharger la page avant export. Les valeurs et images ne sont pas sauvegardées automatiquement.

## Validation déjà effectuée

Tests automatisés : extraction des équipements et des unités, conflits et données absentes, politique du coffre natif, validité des données TCX ; parcours tactile Chromium avec OCR réellement exécuté sur images synthétiques tapis/rameur, lecture du XML exporté, partage simulé, séparation des séances, vidéo synthétique, annulation et échec du moteur. Le test bloque toute requête vers un domaine externe.

La photo réelle du rameur reçue ensuite dans un ZIP a été validée dans Chromium avec le test dédié `test:photo`. La vidéo réelle du tapis reste à fournir. Le téléchargement de WebKit pour tester le moteur Safari a été bloqué par la politique réseau du cloud (HTTP 403 sur les domaines de téléchargement Playwright). Safari iPhone, le partage système réel, les codecs physiques et l’import dans les comptes Garmin/Strava ne sont donc pas déclarés validés.

## Nouveaux essais ciblés

- Après « Utiliser la vidéo », vérifier le nom et l’état affichés sous le lecteur. Le découpage puis l’analyse démarrent automatiquement. Si Safari attend une interaction pour charger le fichier, appuyer une fois sur Lecture, sans définir de zone. Si un message de codec apparaît, conserver la vidéo originale pour diagnostic ; ne pas supprimer l’enregistrement.
- Pour le rameur, essayer « Lire une zone » sous la photo, encadrer uniquement les chiffres puis choisir la durée, distance en mètres ou autre champ. Ajouter une zone par valeur, analyser puis vérifier.
- Pour Garmin, sélectionner le format FIT, enregistrer le fichier et le choisir sur la page d’import Garmin Connect. En cas de refus, conserver le message exact et le fichier. L’acceptation par un compte réel n’est pas validée par les tests automatisés.

## Valeurs visibles sur l'aperçu du rameur fourni le 13 novembre

Transcription visuelle : durée 10 min 08 s, distance 1 449 m, calories 78, total 232 coups, niveau 6. L'écran est en pause, la FC n'est pas renseignée et les zéros de cadence/puissance ne sont pas des moyennes de la séance. Renseigner le début réel de séance séparément avant tout export. Ces valeurs, d’abord transcrites visuellement, sont maintenant également retrouvées par le test automatisé sur le JPEG fourni dans le ZIP.
