# Sera Indicator Swing Predictor

Version GitHub Pages de Sera Indicator, ajoutée sans modifier l'application Sera Winner à la racine.

## Fonctionnement

- GitHub Actions récupère les bougies Deriv H1 et H4 de 11 indices.
- Le moteur technique calcule tendance EMA, RSI, ATR, BOS/CHoCH, liquidité, FVG, retest, order block et risque de spike.
- `gpt-5.6-luna` contrôle les 11 setups.
- `gpt-5.6-sol` approfondit jusqu'à 5 setups techniques présélectionnés.
- Un BUY/SELL n'est publié que si la technique et OpenAI confirment le même sens avec une confiance IA d'au moins 75 %.
- Weltrade et Headway sont visibles, mais restent sur ATTENDRE tant que leurs flux MT5 officiels ne sont pas connectés.

## Secret requis

Le workflow utilise uniquement le secret GitHub existant `OPENAI_API_KEY`. La clé n'est jamais incluse dans les fichiers publics ni envoyée au navigateur.

## Exécution

Le workflow `Sera Indicator — Deriv H1 H4 + OpenAI` s'exécute chaque heure et peut aussi être lancé manuellement depuis l'onglet Actions.

Le trading direct est volontairement verrouillé sur cette version GitHub jusqu'à la validation d'un callback Deriv adapté à l'adresse GitHub Pages.
