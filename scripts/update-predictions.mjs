import fs from 'node:fs/promises';
import path from 'node:path';

const WINNER_URL = 'https://alybet.io/api/v2/odds?bookmaker=winner';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-sol';
const MAX_MATCHES = Math.min(20, Number(process.env.MAX_MATCHES || 20));

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is missing. Add it as a GitHub Actions repository secret.');
}

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
    const sources = item.action?.sources || item.results || [];
    for (const source of sources) {
      if (source?.url) urls.add(source.url);
    }
  }
  return [...urls].slice(0, 30);
}

async function fetchWinnerMatches() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(WINNER_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'WinnerFootball-GoalIQ-AI/4.0'
      },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Winner connector HTTP ${res.status}`);
    const raw = await res.json();
    const nowSec = Math.floor(Date.now() / 1000);
    return (raw.matches || [])
      .filter(m => String(m.bookmaker || '').toLowerCase().includes('winner'))
      .filter(m => !m.start_time || Number(m.start_time) >= nowSec - 7200)
      .map(m => ({
        id: String(m.id ?? `${m.home}-${m.away}-${m.start_time}`),
        sport: m.sport || 'football',
        league: m.league || 'Unknown',
        home: m.home,
        away: m.away,
        start_time: m.start_time || null,
        odds: m.odds || {},
        source: 'AlyBet → Winner'
      }))
      .filter(m => m.home && m.away)
      .sort((a, b) => Number(a.start_time || 0) - Number(b.start_time || 0))
      .slice(0, MAX_MATCHES);
  } finally {
    clearTimeout(timeout);
  }
}

const schema = {
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

async function analyzeMatches(matches) {
  const instructions = `You are GoalIQ, a football match analysis engine. Analyze each supplied fixture using current web research plus the bookmaker data supplied. Before assigning probabilities, verify recent evidence where available: last 5-10 matches, goals scored/conceded, home/away form, first-half vs second-half scoring patterns, head-to-head only when relevant, xG if credible, absences/team news, schedule congestion, competition context, and market odds as a secondary signal. Do not fabricate statistics. If evidence is sparse, contradictory, outdated, or teams are ambiguous, lower data_quality and confidence. confidence is the reliability of the overall GoalIQ assessment, not the probability that a bet wins. Probabilities must be calibrated estimates, not guarantees. p2 = probability of at least 2 total goals; p3 = probability of at least 3 total goals; p1h = probability first half has more goals than second half; p2h = probability second half has more goals than first half. Keep summary concise and evidence-based. Return one result for every supplied id.`;

  const body = {
    model: OPENAI_MODEL,
    reasoning: { effort: 'medium' },
    tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
    tool_choice: 'auto',
    include: ['web_search_call.action.sources'],
    store: false,
    instructions,
    input: JSON.stringify({
      generated_at: new Date().toISOString(),
      fixtures: matches
    }),
    text: {
      format: {
        type: 'json_schema',
        name: 'goaliq_predictions',
        strict: true,
        schema
      }
    }
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const response = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI API ${res.status}: ${response?.error?.message || JSON.stringify(response)}`);
  }

  const parsed = JSON.parse(extractOutputText(response));
  return {
    results: parsed.matches || [],
    sources: collectWebSources(response),
    response_id: response.id || null,
    usage: response.usage || null
  };
}

async function main() {
  const outputPath = path.join(process.cwd(), 'data', 'predictions.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const matches = await fetchWinnerMatches();
  if (!matches.length) {
    const payload = {
      ok: false,
      status: 'no_winner_matches',
      updated_at: new Date().toISOString(),
      model: OPENAI_MODEL,
      source: 'AlyBet → Winner',
      matches: [],
      note: 'No Winner fixtures were returned by the connector at this update.'
    };
    await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
    console.log('No Winner fixtures returned; wrote empty status file.');
    return;
  }

  const ai = await analyzeMatches(matches);
  const byId = new Map(ai.results.map(r => [String(r.id), r]));
  const merged = matches.map(match => ({ ...match, ...(byId.get(String(match.id)) || {}) }));

  const payload = {
    ok: true,
    status: 'ai_analyzed',
    updated_at: new Date().toISOString(),
    model: OPENAI_MODEL,
    source: 'Winner fixtures via AlyBet + OpenAI web research',
    matches_count: merged.length,
    matches: merged,
    web_sources: ai.sources,
    openai_response_id: ai.response_id,
    usage: ai.usage
  };

  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${merged.length} AI-analyzed fixtures to ${outputPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
