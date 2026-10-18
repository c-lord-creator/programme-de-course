# Élan 10K

Application web installable sur iPhone pour courir 10 km : programmes de 12 semaines, renforcement musculaire,
synchronisation Strava, suivi du poids, du sommeil et de l'hydratation, et récompenses à chaque palier.

En ligne : https://c-lord-creator.github.io/programme-de-course/

## Fonctionnalités

- **2 programmes de 12 semaines** (« Mon premier 10 km » et « 10 km plus vite »), 4 séances par semaine :
  footing, fractionné, renfo, sortie longue. On peut enchaîner ou recommencer un programme, décaler tout le
  programme d'une semaine ou déplacer une séance.
- **Minuteurs guidés** pour le renfo (maison ou salle, 4 niveaux) et pour le fractionné : annonces vocales,
  bips, vibrations, écran maintenu allumé.
- **Apple Watch / Apple Santé** : import de l'export de l'app Santé (fichier .zip) : courses avec tracé GPS,
  temps au km et fréquence cardiaque, séances de renfo, pesées et nuits de sommeil. Les séances se cochent toutes
  seules et un nouvel import ne crée pas de doublons.
- **Strava** (facultatif, nécessite un abonnement Strava pour créer une clé API) : connexion, synchronisation automatique à l'ouverture, association des activités aux séances
  (courses et séances de renfo), tracé du parcours, allure, fréquence cardiaque, dénivelé, temps au km.
- **Journal** : toutes les activités, kilomètres par semaine, records, estimation du temps sur 10 km.
- **Suivi** : poids (courbe et objectif), mensurations, eau et sommeil au quotidien avec historique.
- **Conseils** : nutrition simple avant / pendant / après, perte de poids sans régime, sommeil, jour de course,
  idées de repas.
- **Récompenses** : paliers modifiables (distance, km cumulés, semaines d'affilée, séances, renfo, kg perdus),
  célébration au déblocage.
- **Calendrier Apple** : export `.ics` des séances et des pesées, avec rappels.
- Thème clair / sombre / automatique, fonctionne hors connexion, sauvegarde et restauration des données.

## Strava

L'app parle directement à l'API Strava depuis le téléphone : aucun serveur n'est nécessaire.
Chaque utilisatrice ou utilisateur crée sa propre application API gratuite sur https://www.strava.com/settings/api
(domaine de rappel : `c-lord-creator.github.io`) et colle son ID client et son secret dans l'app
(Réglages → Strava). Le secret reste sur le téléphone et n'est jamais inclus dans les sauvegardes.

## Lancer en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Aucune dépendance ni étape de build : HTML, CSS et JavaScript (modules ES).
