const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ALYBET_URL = 'https://alybet.io/api/v2/odds?bookmaker=winner';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-sol';
const CACHE_MS = 60000;
let cache = { ts: 0, data: null, error: null };

app.use(express.json({ limit: '1mb' }));

function extractOutputText(response) {
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  throw new Error('OpenAI returned no output_text.');
}

function collectWebSources(response) {
  const urls = new Set();
  for (const item of response.output || []) {
    if (item.type !== 'web_search_call') continue;
    for (const source of item.action?.sources || item.results || []) {
      if (source?.url) urls.add(source.url);
    }
  }
  return [...urls].slice(0, 30);
}

async function fetchWinner() {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_MS) return cache;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(ALYBET_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'WinnerFootball-GoalIQ/4.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AlyBet HTTP ${res.status}`);
    const raw = await res.json();
    const matches = (raw.matches || [])
      .filter(m => String(m.bookmaker || '').toLowerCase().includes('winner'))
      .map(m => ({
        id: String(m.id ?? `${m.home}-${m.away}-${m.start_time}`),
        sport: m.sport || 'football',
        league: m.league || 'Unknown',
        home: m.home,
        away: m.away,
        start_time: m.start_time,
        updated: m.updated,
        odds: m.odds || {},
        source: 'AlyBet → Winner'
      }));
    cache = {
      ts: now,
      data: {
        matches,
        matches_count: matches.length,
        version: raw.version ?? null,
        source: 'AlyBet third-party connector for Winner'
      },
      error: null
    };
  } catch (err) {
    cache = { ts: now, data: null, error: String(err.message || err) };
  }
  return cache;
}

const predictionSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          p2: { type: 'integer', minimum: 0, maximum: 100 },
          p3: { type: 'integer', minimum: 0, maximum: 100 },
          p1h: { type: 'integer', minimum: 0, maximum: 100 },
          p2h: { type: 'integer', minimum: 0, maximum: 100 },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          data_quality: { type: 'integer', minimum: 0, maximum: 100 },
          summary: { type: 'string' },
          factors: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: { type: 'string' }
          }
        },
        required: ['id','p2','p3','p1h','p2h','confidence','data_quality','summary','factors'],
        additionalProperties: false
      }
    }
  },
  required: ['matches'],
  additionalProperties: false
};

async function analyzeWithOpenAI(matches) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured on the server.');
  }
  const limited = matches.slice(0, 20).map(m => ({
    id: String(m.id ?? `${m.home}-${m.away}-${m.start_time}`),
    league: m.league || 'Unknown',
    home: m.home,
    away: m.away,
    start_time: m.start_time || null,
    odds: m.odds || {}
  }));

  const instructions = `You are GoalIQ, a football match analysis engine. Analyze every supplied fixture using current web research plus the supplied bookmaker data. Verify recent evidence where available: last 5-10 matches, goals scored/conceded, home/away form, first-half versus second-half scoring, relevant H2H, credible xG, absences/team news, schedule congestion, competition context, and market odds only as a secondary signal. Never invent statistics. If evidence is sparse, contradictory, outdated, or team identity is uncertain, lower data_quality and confidence. confidence measures reliability of the overall assessment, not the probability that a wager wins. p2 = probability of at least 2 total goals; p3 = probability of at least 3 total goals; p1h = probability first half has more goals than second half; p2h = probability second half has more goals than first half. Keep summary concise and evidence-based. Return one result for every supplied id.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: 'medium' },
      tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
      tool_choice: 'auto',
      include: ['web_search_call.action.sources'],
      store: false,
      instructions,
      input: JSON.stringify({ generated_at: new Date().toISOString(), fixtures: limited }),
      text: {
        format: {
          type: 'json_schema',
          name: 'goaliq_predictions',
          strict: true,
          schema: predictionSchema
        }
      }
    })
  });

  const raw = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI API ${response.status}: ${raw?.error?.message || JSON.stringify(raw)}`);
  }
  return {
    predictions: JSON.parse(extractOutputText(raw)).matches || [],
    web_sources: collectWebSources(raw),
    response_id: raw.id || null,
    model: raw.model || OPENAI_MODEL,
    usage: raw.usage || null
  };
}

app.get('/api/winner', async (req, res) => {
  const result = await fetchWinner();
  if (!result.data) {
    return res.status(502).json({ ok: false, error: result.error, note: 'Connecteur Winner indisponible; fallback démo.' });
  }
  res.json({ ok: true, ...result.data, fetched_at: new Date(result.ts).toISOString() });
});

app.post('/api/analyze-batch', async (req, res) => {
  try {
    const matches = Array.isArray(req.body?.matches) ? req.body.matches : [];
    if (!matches.length) return res.status(400).json({ ok: false, error: 'matches[] is required.' });
    const ai = await analyzeWithOpenAI(matches);
    const byId = new Map(ai.predictions.map(p => [String(p.id), p]));
    const merged = matches.slice(0, 20).map(m => ({ ...m, ...(byId.get(String(m.id)) || {}) }));
    res.json({
      ok: true,
      analyzed_at: new Date().toISOString(),
      model: ai.model,
      matches: merged,
      web_sources: ai.web_sources,
      response_id: ai.response_id,
      usage: ai.usage
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.get('/api/health', (req, res) => res.json({
  ok: true,
  service: 'Winner Football GoalIQ',
  ai_model: OPENAI_MODEL,
  openai_configured: Boolean(process.env.OPENAI_API_KEY),
  cache_age_sec: cache.ts ? Math.round((Date.now() - cache.ts) / 1000) : null
}));

app.use(express.static(path.join(__dirname)));
app.listen(PORT, () => console.log(`Winner Football GoalIQ: http://localhost:${PORT}`));
