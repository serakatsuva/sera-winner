import fs from 'node:fs/promises';
import path from 'node:path';

const WINNER_URL = 'https://alybet.io/api/v2/odds?bookmaker=winner';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-sol';
const MAX_MATCHES = Math.min(100, Number(process.env.MAX_MATCHES || 100));

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
  return [...urls].slice(0, 40);
}

async function callOpenAI(body) {
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
  return response;
}

async function fetchWinnerMatches() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(WINNER_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'WinnerFootball-GoalIQ-AI/5.0'
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

const directSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          league: { type: 'string' },
          home: { type: 'string' },
          away: { type: 'string' },
          kickoff_iso: { type: 'string' },
          p2: { type: 'integer', minimum: 0, maximum: 100 },
          p3: { type: 'integer', minimum: 0, maximum: 100 },
          p1h: { type: 'integer', minimum: 0, maximum: 100 },
          p2h: { type: 'integer', minimum: 0, maximum: 100 },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          data_quality: { type: 'integer', minimum: 0, maximum: 100 },
          summary: { type: 'string' },
          source_note: { type: 'string' },
          factors: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: { type: 'string' }
          }
        },
        required: ['id','league','home','away','kickoff_iso','p2','p3','p1h','p2h','confidence','data_quality','summary','source_note','factors'],
        additionalProperties: false
      }
    }
  },
  required: ['matches'],
  additionalProperties: false
};

async function analyzeMatches(matches) {
  const instructions = `You are GoalIQ, a football match analysis engine. Analyze each supplied fixture using current web research plus bookmaker data when supplied. Verify recent evidence where available: last 5-10 matches, goals scored/conceded, home/away form, first-half vs second-half scoring patterns, relevant H2H, credible xG, absences/team news, schedule congestion, competition context, and market odds only as a secondary signal. Do not fabricate statistics. If evidence is sparse, contradictory, outdated, or teams are ambiguous, lower data_quality and confidence. confidence is the reliability of the overall GoalIQ assessment, not the probability that a bet wins. p2 = probability of at least 2 total goals; p3 = probability of at least 3 total goals; p1h = probability first half has more goals than second half; p2h = probability second half has more goals than first half. Return one result for every supplied id.`;

  const response = await callOpenAI({
    model: OPENAI_MODEL,
    reasoning: { effort: 'medium' },
    tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
    tool_choice: 'auto',
    include: ['web_search_call.action.sources'],
    store: false,
    instructions,
    input: JSON.stringify({ generated_at: new Date().toISOString(), fixtures: matches }),
    text: {
      format: {
        type: 'json_schema',
        name: 'goaliq_predictions',
        strict: true,
        schema: predictionSchema
      }
    }
  });

  const parsed = JSON.parse(extractOutputText(response));
  return {
    results: parsed.matches || [],
    sources: collectWebSources(response),
    response_id: response.id || null,
    usage: response.usage || null
  };
}

async function discoverAndAnalyzeWinnerMatches() {
  const instructions = `You are GoalIQ for Winner Football in the DRC. Use current web search to identify up to ${MAX_MATCHES} REAL football fixtures that are currently/upcoming within roughly the next 24 hours and are offered by or relevant to Winner.bet. Prefer direct Winner.bet evidence. Exclude virtual football, Winner Leagues, simulated reality, eSoccer, already-finished fixtures, and ambiguous teams. If Winner.bet's live fixture list cannot be directly verified, you may use authoritative current football schedules as a fallback, but source_note must explicitly say that the Winner listing was not directly verified, and in that fallback case cap data_quality at 60 and confidence at 65. Never invent Winner odds. For each valid fixture, research recent form and goal patterns and estimate p2, p3, p1h and p2h. confidence is reliability of the assessment, not chance of winning. Return kickoff_iso as ISO-8601 when known, otherwise an empty string. Keep summaries concise and evidence-based.`;

  const response = await callOpenAI({
    model: OPENAI_MODEL,
    reasoning: { effort: 'medium' },
    tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
    tool_choice: 'auto',
    include: ['web_search_call.action.sources'],
    store: false,
    instructions,
    input: `Current time: ${new Date().toISOString()}. Find and analyze Winner Football fixtures now.`,
    text: {
      format: {
        type: 'json_schema',
        name: 'goaliq_direct_winner_predictions',
        strict: true,
        schema: directSchema
      }
    }
  });

  const parsed = JSON.parse(extractOutputText(response));
  const matches = (parsed.matches || []).slice(0, MAX_MATCHES).map((m, i) => {
    const ms = m.kickoff_iso ? Date.parse(m.kickoff_iso) : NaN;
    return {
      ...m,
      id: String(m.id || `web-${i+1}`),
      start_time: Number.isFinite(ms) ? Math.floor(ms / 1000) : null,
      odds: {},
      source: m.source_note?.includes('not directly verified')
        ? 'OpenAI web schedule fallback'
        : 'Winner.bet + OpenAI web research'
    };
  });

  return {
    matches,
    sources: collectWebSources(response),
    response_id: response.id || null,
    usage: response.usage || null
  };
}

async function main() {
  const outputPath = path.join(process.cwd(), 'data', 'predictions.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  let matches = [];
  let sourceMode = 'AlyBet → Winner';
  let ai;

  try {
    matches = await fetchWinnerMatches();
    if (!matches.length) throw new Error('Winner connector returned zero matches');
    ai = await analyzeMatches(matches);
    const byId = new Map(ai.results.map(r => [String(r.id), r]));
    matches = matches.map(match => ({ ...match, ...(byId.get(String(match.id)) || {}) }));
  } catch (connectorError) {
    console.warn(`Primary Winner connector unavailable: ${connectorError.message}`);
    console.log('Falling back to GPT-5.6 Sol web discovery + analysis.');
    const direct = await discoverAndAnalyzeWinnerMatches();
    matches = direct.matches;
    ai = direct;
    sourceMode = 'OpenAI web discovery for Winner fixtures';
  }

  if (!matches.length) {
    const payload = {
      ok: false,
      status: 'no_winner_matches',
      updated_at: new Date().toISOString(),
      model: OPENAI_MODEL,
      source: sourceMode,
      matches: [],
      web_sources: ai?.sources || [],
      note: 'No verifiable current Winner football fixtures were found during this update.'
    };
    await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
    console.log('No verifiable Winner fixtures found; wrote empty status file.');
    return;
  }

  const payload = {
    ok: true,
    status: 'ai_analyzed',
    updated_at: new Date().toISOString(),
    model: OPENAI_MODEL,
    source: sourceMode,
    matches_count: matches.length,
    matches,
    web_sources: ai?.sources || [],
    openai_response_id: ai?.response_id || null,
    usage: ai?.usage || null
  };

  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${matches.length} AI-analyzed fixtures to ${outputPath}`);
}

main().catch(async err => {
  console.error(err);
  try {
    const outputPath = path.join(process.cwd(), 'data', 'predictions.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify({
      ok: false,
      status: 'analysis_error',
      updated_at: new Date().toISOString(),
      model: OPENAI_MODEL,
      matches: [],
      note: String(err.message || err)
    }, null, 2));
  } catch {}
  process.exit(1);
});
