# Winner Football · GoalIQ Live V3

Application de sélection et d'analyse de matchs de football avec :
- Top 5 / Top 10 / Top 20 / Tous
- filtres de probabilité 10–50 %, 51–70 %, 71–100 %
- filtre par métrique : confiance, 2+ buts, 3+ buts, 1H > 2H, 2H > 1H
- recherche par équipe / championnat
- date et heure de dernière mise à jour
- connecteur Winner via AlyBet (tiers)
- fallback automatique en mode démo

## GitHub Pages
Le fichier `index.html` est compatible avec GitHub Pages. Sur `github.io`, il tente directement le flux AlyBet. Si le navigateur bloque CORS ou si aucun match Winner n'est disponible, l'application bascule automatiquement sur les données de démonstration.

## Mode serveur recommandé
Pour un connecteur plus robuste :

```bash
npm install
npm start
```

Puis ouvrir `http://localhost:3000`.

Le serveur expose :
- `/api/winner`
- `/api/health`

## Architecture
Winner.bet → connecteur tiers AlyBet → Winner Football GoalIQ → filtres / classement.

> AlyBet n'est pas une API officielle Winner.bet. Le connecteur doit rester remplaçable.
