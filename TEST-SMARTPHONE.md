# Test smartphone — branche IA, phase 1

Cette version se teste dans Safari iPhone ou Chrome Android depuis un site HTTPS de préproduction. Elle conserve la navigation existante et l’export. Le site de production n’est pas mis à jour automatiquement par cette branche.

1. Configurer le Worker et l’URL publique selon [docs/AI-VISION.md](docs/AI-VISION.md). Ne saisir aucune clé API dans le navigateur ni GitHub.
2. Choisir l’équipement puis « Automatique ». Se connecter avec le compte **APP-SPORT** provisionné pour ce service, pas ses identifiants Garmin. Autoriser explicitement l’envoi des images à l’IA.
3. Choisir une photo de l’écran complet ou une vidéo. Pour une photo, lancer l’analyse. Pour une vidéo, attendre la sélection automatique des images puis leur analyse groupée ; aucun recadrage n’est requis.
4. Examiner d’abord les lectures et le JSON retourné : libellés, unités, état de l’appareil, valeurs instantanées, moyennes, cumulées et sources. Un zéro instantané en pause reste visible mais n’est pas repris comme moyenne. Les données absentes/illisibles restent nulles, les nombres non attribués sont signalés.
5. Utiliser « Reprendre les valeurs vérifiées dans le formulaire ». C’est seulement à ce moment que les conversions nécessaires au formulaire existant sont faites. Corriger les champs si nécessaire, renseigner la date réelle de début puis suivre la confirmation/export habituelle. Aucun calcul ou export automatique ne précède cette revue.
6. Pour une autre séance, enregistrer d’abord le fichier puis utiliser « Nouvelle séance ». Les médias restent sur le téléphone et en mémoire de page ; garder les originaux pour les tests. L’envoi des images au Worker/OpenAI est explicite et ne constitue pas un transfert vers Garmin.

## Tests réels demandés

- **IMG_0205.jpeg**, rameur Heubozen : confronter la lecture à la photo réelle. Durée 15:21, distance 2312 m, calories 126 kcal, total 377 coups, résistance 6, FC indisponible, état PAUSE ; cadence instantanée 0, puissance instantanée 0, allure instantanée 0:00. Aucun de ces trois zéros ne doit devenir une moyenne.
- **IMG_0204.mp4**, tapis : retrouver 138, 81, 15:19 et 1356, puis vérifier leurs vrais libellés et unités sur les images de la vidéo. Aucune association ne doit être supposée à partir des nombres seuls.

Ces deux fichiers ne sont pas encore disponibles dans l’environnement : **aucun test réel réussi n’est annoncé**. Les tests du protocole utilisent des simulations explicitement identifiées ; la vidéo réelle et la photo réelle sont obligatoires avant validation de la fiabilité.
