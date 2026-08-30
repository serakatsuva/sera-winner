# Sera Indicator — Weltrade Signals

Version GitHub Pages de Sera Indicator dédiée à Weltrade SyntX.

## Règle produit

- L’application affiche uniquement des signaux `BUY`, `SELL` ou `ATTENDRE`.
- Elle ne demande aucune connexion au compte de trading.
- Elle ne peut ouvrir, modifier ou fermer aucune position.
- L’exécution éventuelle reste manuelle dans Weltrade MT5.

## Analyse

- Source obligatoire : bougies officielles Weltrade MT5 en H1 et H4.
- Le moteur technique calcule EMA, RSI, ATR, BOS/CHoCH, liquidité, FVG, retest, order block et risque de spike.
- `gpt-5.6-luna` contrôle les setups et `gpt-5.6-sol` approfondit les meilleurs.
- Un BUY/SELL n’est publié que si la technique et OpenAI confirment le même sens avec une confiance IA d’au moins 75 %.
- Sans données MT5 fraîches, tous les instruments restent honnêtement sur `ATTENDRE`.

## Format du flux MT5

Le workflow lit `indicator/data/weltrade-candles.json`. Le format attendu est documenté dans `weltrade-candles.example.json`. Le champ `exported_at` et au moins 60 bougies H1 et H4 par instrument sont obligatoires.

La clé `OPENAI_API_KEY` reste exclusivement dans GitHub Secrets et n’est jamais envoyée au navigateur.
