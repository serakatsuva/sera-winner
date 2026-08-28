# Winner Football · GoalIQ AI

Application de sélection et d'analyse de matchs de football avec :

- Winner comme source de rencontres via le connecteur tiers AlyBet
- analyse IA avec **GPT-5.6 Sol**
- recherche web OpenAI pour vérifier les statistiques récentes disponibles
- probabilités : **2+ buts, 3+ buts, 1H > 2H, 2H > 1H**
- score de **confiance** et score de **qualité des données**
- résumé et facteurs clés par match
- Top 5 / Top 10 / Top 20 / Tous
- filtres 10–50 %, 51–70 %, 71–100 %
- recherche équipe / championnat
- date et heure de dernière analyse IA

## Architecture GitHub Pages sécurisée

```text
Winner/AlyBet
   ↓
GitHub Action (chaque heure)
   ↓
OpenAI Responses API — GPT-5.6 Sol + web search
   ↓
data/predictions.json
   ↓
GitHub Pages
```

La clé OpenAI n'est **jamais** incluse dans `index.html` ni dans le dépôt. Elle doit être enregistrée comme secret GitHub Actions.

## Activer l'analyse IA

Dans le dépôt GitHub :

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. `New repository secret`
5. Nom : `OPENAI_API_KEY`
6. Valeur : votre clé API OpenAI

Ensuite ouvrir `Actions` → **Update GoalIQ AI predictions** → **Run workflow**.

Le workflow est aussi planifié automatiquement chaque heure (`15 * * * *`). Il analyse au maximum 20 matchs et met à jour `data/predictions.json`.

## Modèle

Le modèle par défaut est `gpt-5.6-sol`. Il peut être remplacé côté serveur ou workflow via `OPENAI_MODEL`.

Le moteur demande au modèle de réduire la confiance lorsque les statistiques trouvées sont insuffisantes, contradictoires, ambiguës ou obsolètes. Les probabilités sont des estimations et non des garanties.

## Mode serveur local

```bash
npm install
OPENAI_API_KEY=... npm start
```

Endpoints disponibles :

- `GET /api/winner`
- `POST /api/analyze-batch`
- `GET /api/health`

## Sources et limites

AlyBet est un connecteur tiers et non une API officielle Winner.bet. Le connecteur est volontairement isolé pour pouvoir être remplacé plus tard par une source plus robuste.
