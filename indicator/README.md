# Sera Indicator — Deriv Signals

Version GitHub Pages de Sera Indicator dédiée aux indices synthétiques Deriv.

## Règle produit

- L’application affiche uniquement des signaux `BUY`, `SELL` ou `ATTENDRE`.
- Elle ne demande aucune connexion au compte de trading.
- Elle ne peut ouvrir, modifier ou fermer aucune position.
- L’exécution éventuelle reste manuelle sur la plateforme Deriv.

## Analyse

- Source : bougies publiques Deriv en H1 et H4 via WebSocket.
- Le moteur technique calcule EMA, RSI, ATR, BOS/CHoCH, liquidité, FVG, retest, order block et risque de spike.
- `gpt-5.6-luna` contrôle les setups et `gpt-5.6-sol` approfondit les meilleurs.
- Un BUY/SELL n’est publié que si la technique et OpenAI confirment le même sens avec une confiance IA d’au moins 75 %.
- Sans analyse récente, tous les instruments restent honnêtement sur `ATTENDRE`.

## Automatisation

Le workflow récupère automatiquement les données de 11 indices Deriv, exécute le moteur H1/H4, puis demande la validation OpenAI chaque heure.

La clé `OPENAI_API_KEY` reste exclusivement dans GitHub Secrets et n’est jamais envoyée au navigateur.
