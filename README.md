# Élan 10K

Application web (installable sur iPhone) pour passer de 5 km à un premier 10 km en 12 semaines,
avec du renforcement musculaire, le suivi du poids et des récompenses à chaque palier.

## Version 1

- **Programme 12 semaines** : 4 séances par semaine (footing, fractionné, renfo, sortie longue),
  semaines de récupération (S4, S8) et semaine d'affûtage avant le 10 km (S12).
- **Renforcement musculaire** maison ou salle, 4 niveaux, avec **minuteur guidé** (bips, vibrations).
- **Suivi** : séances réalisées (distance, durée, ressenti), courses hors programme,
  poids avec courbe et objectif, mensurations.
- **Motivation** : paliers de distance, de kilomètres cumulés, de régularité (semaines validées
  d'affilée) et de renfo, avec des récompenses modifiables (ex. « Premier 10 km → un nouveau livre »).
- **Calendrier Apple** : export `.ics` des 48 séances et des 12 pesées, avec rappels.
- Fonctionne hors connexion. Les données restent sur le téléphone (export / import de sauvegarde).

## Lancer en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Installer sur iPhone

1. Publier le site (par exemple GitHub Pages : Settings → Pages → branche `main`, dossier `/`).
2. Ouvrir l'adresse dans **Safari** → bouton Partager → **Sur l'écran d'accueil**.
3. Dans l'app : Réglages → **Ajouter au Calendrier** → **Tout ajouter**.

## À venir

- V2 : connexion Strava (les courses cochent automatiquement les séances).
- V3 : sommeil, hydratation, conseils nutrition enrichis.
