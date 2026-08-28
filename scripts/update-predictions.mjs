import fs from 'node:fs/promises';
import path from 'node:path';

const WINNER_URL = 'https://alybet.io/api/v2/odds?bookmaker=winner';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SCREENING_MODEL = process.env.SCREENING_MODEL || 'gpt-5.6-luna';
const DEEP_MODEL = process.env.DEEP_MODEL || 'gpt-5.6-sol';
const MAX_MATCHES = Math.min(300, Math.max(1, Number(process.env.MAX_MATCHES || 300)));
const DEEP_MATCHES = Math.min(20, Math.max(1, Number(process.env.DEEP_MATCHES || 20)));

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
  return [...urls].slice(0, 100);
}

function mergeSources(...lists) {
  return [...new Set(lists.flat().filter(Boolean))].slice(0, 150);
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
        'User-Agent': 'SeraWinner-AI/7.0'
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
          predicted_score: { type: 'string' },
          score_confidence: { type: 'integer', minimum: 0, maximum: 100 },
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
        required: ['id','p2','p3','p1h','p2h','predicted_score','score_confidence','confidence','data_quality','summary','factors'],
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
          predicted_score: { type: 'string' },
          score_confidence: { type: 'integer', minimum: 0, maximum: 100 },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          data_quality: { type: 'integer', minimum: 0, maximum: 100 },
          summary: { type: 'string' },
          source_note: { type: 'string' },
          factors: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: { type: 'string' }
          }
        },
        required: ['id','league','home','away','kickoff_iso','p2','p3','p1h','p2h','predicted_score','score_confidence','confidence','data_quality','summary','source_note','factors'],
        additionalProperties: false
      }
    }
  },
  required: ['matches'],
  additionalProperties: false
};

async function screenKnownMatches(matches) {
  const instructions = `You are the high-volume screening layer of Sera Winner. Quickly assess every supplied real football fixture. Use current web research selectively and bookmaker data when supplied. Produce conservative baseline probabilities and a reliability confidence score. p2 = probability of at least 2 total goals; p3 = probability of at least 3 total goals; p1h = probability first half has more goals than second half; p2h = probability second half has more goals than first half. predicted_score is the single most plausible exact score, and score_confidence must be conservative. Enforce mathematical and semantic consistency: p3 must never exceed p2; if the predicted score totals fewer than 2 goals, do not simultaneously make 2+ goals a strong (>60%) proposition unless the exact-score confidence is explicitly low; if it totals fewer than 3 goals, do not make 3+ goals a strong (>60%) proposition unless exact-score confidence is explicitly low. confidence is the reliability of the overall assessment, not the probability a bet wins. Do not fabricate statistics. Return one result for every supplied id. Keep summaries and factors concise because this is a screening pass; the highest-confidence matches will be researched deeply by a second model.`;

  const response = await callOpenAI({
    model: SCREENING_MODEL,
    reasoning: { effort: 'low' },
    tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
    tool_choice: 'auto',
    include: ['web_search_call.action.sources'],
    store: false,
    instructions,
    input: JSON.stringify({ generated_at: new Date().toISOString(), fixtures: matches }),
    text: {
      format: {
        type: 'json_schema',
        name: 'sera_winner_screening',
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

async function discoverAndScreenWinnerMatches() {
  const instructions = `You are the high-volume screening layer of Sera Winner in the DRC. Use current web search to identify up to ${MAX_MATCHES} REAL football fixtures that are current/upcoming within roughly the next 24 hours and are offered by or relevant to Winner.bet. Prefer direct Winner.bet evidence. Exclude virtual football, Winner Leagues, simulated reality, eSoccer, already-finished fixtures, and ambiguous teams. If Winner.bet's live fixture list cannot be directly verified, use authoritative current football schedules as fallback and say so in source_note. In that fallback case cap data_quality at 60, confidence at 65, and score_confidence at 45. Never invent Winner odds. Do a fast screening estimate for p2, p3, p1h, p2h, predicted_score, score_confidence and overall confidence. Enforce consistency: p3 <= p2; a low-scoring predicted score must not coexist with a strong goals-over probability unless the exact-score confidence is reduced accordingly. Do not spend deep research on every match; the 20 highest-confidence fixtures will be researched by GPT-5.6 Sol afterward. Keep summaries concise. Return kickoff_iso when known.`;

  const response = await callOpenAI({
    model: SCREENING_MODEL,
    reasoning: { effort: 'low' },
    tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
    tool_choice: 'auto',
    include: ['web_search_call.action.sources'],
    store: false,
    instructions,
    input: `Current time: ${new Date().toISOString()}. Find and screen current Winner football fixtures.`,
    text: {
      format: {
        type: 'json_schema',
        name: 'sera_winner_direct_screening',
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
      id: String(m.id || `web-${i + 1}`),
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

async function deeplyAnalyzeMatches(matches) {
  const instructions = `You are the deep-analysis layer of Sera Winner. These fixtures were selected because they had the highest overall confidence in a first-pass screening. Deeply research EACH supplied fixture using current web sources. Check recent 5-10 match form, goals scored/conceded, home/away form, first-half vs second-half scoring patterns, relevant H2H, credible xG where available, injuries/absences/team news, schedule congestion, competition context, and market odds only as a secondary signal. Recalculate p2, p3, p1h, p2h, predicted_score, score_confidence, confidence and data_quality from the stronger evidence. Do not preserve a high screening confidence if deeper evidence does not justify it. Enforce consistency between the exact score and goal probabilities: p3 <= p2; if predicted_score totals 0-1 goals and p2 is above 60, lower score_confidence substantially unless evidence strongly supports a broad outcome distribution; if predicted_score totals fewer than 3 goals and p3 is above 60, likewise lower score_confidence. Never fabricate statistics. confidence is reliability of the overall assessment, not chance of a winning bet. Return one result for every supplied id.`;

  const response = await callOpenAI({
    model: DEEP_MODEL,
    reasoning: { effort: 'medium' },
    tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
    tool_choice: 'auto',
    include: ['web_search_call.action.sources'],
    store: false,
    instructions,
    input: JSON.stringify({ generated_at: new Date().toISOString(), selected_by: 'highest screening confidence', fixtures: matches }),
    text: {
      format: {
        type: 'json_schema',
        name: 'sera_winner_deep_top20',
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

function parseScoreTotal(score){const m=String(score||'').match(/(\d+)\s*[-:]\s*(\d+)/);return m?Number(m[1])+Number(m[2]):null}
function enforceConsistency(m){const out={...m};const p2=Number(out.p2),p3=Number(out.p3);if(Number.isFinite(p2)&&Number.isFinite(p3)&&p3>p2)out.p3=Math.max(0,Math.min(100,Math.round(p2)));const total=parseScoreTotal(out.predicted_score);if(total!=null){let sc=Number(out.score_confidence);if(Number.isFinite(sc)){if(total<2&&Number(out.p2)>=60)sc=Math.min(sc,35);if(total<3&&Number(out.p3)>=60)sc=Math.min(sc,35);if(total>=2&&Number(out.p2)<45)sc=Math.min(sc,35);if(total>=3&&Number(out.p3)<45)sc=Math.min(sc,35);out.score_confidence=Math.max(0,Math.min(100,Math.round(sc)))}}return out}

function selectTopByConfidence(matches, count) {
  return [...matches]
    .filter(m => Number.isFinite(Number(m.confidence)))
    .sort((a, b) => Number(b.confidence) - Number(a.confidence))
    .slice(0, Math.min(count, matches.length));
}

async function main() {
  const outputPath = path.join(process.cwd(), 'data', 'predictions.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  let matches = [];
  let sourceMode = 'AlyBet → Winner';
  let screening;

  try {
    matches = await fetchWinnerMatches();
    if (!matches.length) throw new Error('Winner connector returned zero matches');
    screening = await screenKnownMatches(matches);
    const byId = new Map(screening.results.map(r => [String(r.id), r]));
    matches = matches.map(match => ({
      ...match,
      ...(byId.get(String(match.id)) || {}),
      analysis_tier: 'luna_screening'
    }));
  } catch (connectorError) {
    console.warn(`Primary Winner connector unavailable: ${connectorError.message}`);
    console.log(`Falling back to ${SCREENING_MODEL} web discovery + screening.`);
    const direct = await discoverAndScreenWinnerMatches();
    matches = direct.matches.map(m => ({ ...m, analysis_tier: 'luna_screening' }));
    screening = direct;
    sourceMode = 'OpenAI web discovery for Winner fixtures';
  }

  if (!matches.length) {
    const payload = {
      ok: false,
      status: 'no_winner_matches',
      updated_at: new Date().toISOString(),
      model: `${SCREENING_MODEL} + ${DEEP_MODEL}`,
      screening_model: SCREENING_MODEL,
      deep_model: DEEP_MODEL,
      source: sourceMode,
      matches: [],
      web_sources: screening?.sources || [],
      note: 'No verifiable current Winner football fixtures were found during this update.'
    };
    await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
    console.log('No verifiable Winner fixtures found; wrote empty status file.');
    return;
  }

  matches = matches.map(enforceConsistency);

  const topForDeep = selectTopByConfidence(matches, DEEP_MATCHES);
  const screeningConfidence = new Map(topForDeep.map((m, i) => [String(m.id), { confidence: Number(m.confidence), rank: i + 1 }]));

  let deep = { results: [], sources: [], response_id: null, usage: null };
  if (topForDeep.length) {
    console.log(`Deep-analyzing top ${topForDeep.length} matches with ${DEEP_MODEL}, selected strictly by screening confidence.`);
    deep = await deeplyAnalyzeMatches(topForDeep);
    const deepById = new Map(deep.results.map(r => [String(r.id), r]));

    matches = matches.map(match => {
      const selected = screeningConfidence.get(String(match.id));
      const result = deepById.get(String(match.id));
      if (!selected) return match;
      return {
        ...match,
        ...(result || {}),
        analysis_tier: 'sol_deep',
        deep_rank: selected.rank,
        screening_confidence: selected.confidence,
        deep_selected_by: 'confidence'
      };
    });
  }

  matches = matches.map(enforceConsistency);

  const payload = {
    ok: true,
    status: 'ai_analyzed',
    updated_at: new Date().toISOString(),
    model: `${SCREENING_MODEL} + ${DEEP_MODEL}`,
    screening_model: SCREENING_MODEL,
    deep_model: DEEP_MODEL,
    max_matches: MAX_MATCHES,
    deep_matches_target: DEEP_MATCHES,
    deep_matches_count: topForDeep.length,
    deep_selection: 'Top 20 by screening confidence',
    source: sourceMode,
    matches_count: matches.length,
    matches,
    web_sources: mergeSources(screening?.sources || [], deep?.sources || []),
    openai_response_ids: {
      screening: screening?.response_id || null,
      deep: deep?.response_id || null
    },
    usage: {
      screening: screening?.usage || null,
      deep: deep?.usage || null
    }
  };

  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${matches.length} fixtures; ${topForDeep.length} received deep ${DEEP_MODEL} analysis.`);
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
      model: `${SCREENING_MODEL} + ${DEEP_MODEL}`,
      screening_model: SCREENING_MODEL,
      deep_model: DEEP_MODEL,
      matches: [],
      note: String(err.message || err)
    }, null, 2));
  } catch {}
  process.exit(1);
});
