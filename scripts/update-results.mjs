import fs from 'node:fs/promises';
import path from 'node:path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RESULTS_MODEL = process.env.RESULTS_MODEL || 'gpt-5.6-luna';
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const RESULTS_PATH = path.join(DATA_DIR, 'results.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');

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
    for (const source of sources) if (source?.url) urls.add(source.url);
  }
  return [...urls].slice(0, 100);
}

async function callOpenAI(body) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const response = await res.json();
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${response?.error?.message || JSON.stringify(response)}`);
  return response;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function predictionSnapshots() {
  const snapshots = [];
  const current = await readJson(path.join(DATA_DIR, 'predictions.json'), null);
  if (current?.matches?.length) snapshots.push(current);
  try {
    const files = (await fs.readdir(HISTORY_DIR)).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 3);
    for (const file of files) {
      const snap = await readJson(path.join(HISTORY_DIR, file), null);
      if (snap?.matches?.length) snapshots.push(snap);
    }
  } catch {}
  return snapshots;
}

function bestMetric(m) {
  const candidates = [
    ['p2', '2+ buts', Number(m.p2)],
    ['p3', '3+ buts', Number(m.p3)],
    ['p1h', '1H > 2H', Number(m.p1h)],
    ['p2h', '2H > 1H', Number(m.p2h)]
  ].filter(x => Number.isFinite(x[2]));
  candidates.sort((a,b)=>b[2]-a[2]);
  return candidates[0] || [null, '—', null];
}

function top8Ranks(matches) {
  const deep = matches.filter(m => m.analysis_tier === 'sol_deep').sort((a,b)=>Number(b.confidence||0)-Number(a.confidence||0)).slice(0,8);
  return new Map(deep.map((m,i)=>[String(m.id), i+1]));
}

function metricSuccess(metric, fh, fa, hh, ha) {
  const total = fh + fa;
  if (metric === 'p2') return total >= 2;
  if (metric === 'p3') return total >= 3;
  if (!Number.isFinite(hh) || !Number.isFinite(ha)) return null;
  const first = hh + ha;
  const second = total - first;
  if (metric === 'p1h') return first > second;
  if (metric === 'p2h') return second > first;
  return null;
}

const schema = {
  type:'object',
  properties:{
    matches:{
      type:'array',
      items:{
        type:'object',
        properties:{
          id:{type:'string'},
          final_verified:{type:'boolean'},
          home_score:{type:['integer','null'],minimum:0},
          away_score:{type:['integer','null'],minimum:0},
          halftime_home:{type:['integer','null'],minimum:0},
          halftime_away:{type:['integer','null'],minimum:0},
          source_note:{type:'string'}
        },
        required:['id','final_verified','home_score','away_score','halftime_home','halftime_away','source_note'],
        additionalProperties:false
      }
    }
  },
  required:['matches'],
  additionalProperties:false
};

async function verifyFinals(fixtures) {
  const response = await callOpenAI({
    model: RESULTS_MODEL,
    reasoning:{effort:'low'},
    tools:[{type:'web_search_preview',search_context_size:'low'}],
    tool_choice:'auto',
    include:['web_search_call.action.sources'],
    store:false,
    instructions:`Verify final football results for every supplied fixture using current trustworthy web sources. Only set final_verified=true when the match is finished and the final score is clearly confirmed. Provide halftime score when reliably available; otherwise null. Never guess scores. If postponed, abandoned, not started, or uncertain, final_verified=false.`,
    input:JSON.stringify({checked_at:new Date().toISOString(),fixtures}),
    text:{format:{type:'json_schema',name:'sera_winner_final_results',strict:true,schema}}
  });
  return { data: JSON.parse(extractOutputText(response)).matches || [], sources: collectWebSources(response) };
}

async function main() {
  await fs.mkdir(DATA_DIR,{recursive:true});
  await fs.mkdir(HISTORY_DIR,{recursive:true});
  const existing = await readJson(RESULTS_PATH,{updated_at:null,results:[]});
  const byId = new Map((existing.results||[]).map(r=>[String(r.id),r]));
  const snaps = await predictionSnapshots();
  const now = Date.now();
  const candidates = [];
  const seen = new Set();

  for (const snap of snaps) {
    const ranks = top8Ranks(snap.matches||[]);
    for (const m of snap.matches||[]) {
      const id = String(m.id);
      if (seen.has(id) || byId.get(id)?.final_verified) continue;
      seen.add(id);
      const kickoff = Date.parse(m.kickoff_iso || '') || (Number(m.start_time) ? Number(m.start_time)*1000 : NaN);
      if (!Number.isFinite(kickoff) || now < kickoff + 2*60*60*1000) continue;
      const [metric_key, metric_label, metric_probability] = bestMetric(m);
      candidates.push({
        id, league:m.league, home:m.home, away:m.away, kickoff_iso:m.kickoff_iso || new Date(kickoff).toISOString(),
        predicted_score:m.predicted_score || null, p2:m.p2,p3:m.p3,p1h:m.p1h,p2h:m.p2h,
        confidence:m.confidence,data_quality:m.data_quality,analysis_tier:m.analysis_tier,
        recommendation_rank:ranks.get(id)||null, metric_key, metric_label, metric_probability
      });
    }
  }

  if (!candidates.length) {
    console.log('No newly finished predicted matches to verify.');
    return;
  }

  const verified = await verifyFinals(candidates.slice(0,120));
  const sourceSet = verified.sources || [];
  const predById = new Map(candidates.map(x=>[x.id,x]));

  for (const v of verified.data) {
    const p = predById.get(String(v.id));
    if (!p || !v.final_verified || !Number.isFinite(Number(v.home_score)) || !Number.isFinite(Number(v.away_score))) continue;
    const hs=Number(v.home_score), as=Number(v.away_score);
    const hh=v.halftime_home==null?null:Number(v.halftime_home), ha=v.halftime_away==null?null:Number(v.halftime_away);
    const actual=`${hs}-${as}`;
    const predicted=String(p.predicted_score||'').replace(/\s/g,'');
    const exact = /^\d+[-:]\d+$/.test(predicted) ? predicted.replace(':','-')===actual : null;
    byId.set(String(v.id), {
      ...p,
      final_verified:true,
      actual_home:hs,
      actual_away:as,
      actual_score:actual,
      halftime_home:hh,
      halftime_away:ha,
      exact_score_success:exact,
      main_prediction_success:metricSuccess(p.metric_key,hs,as,hh,ha),
      verified_at:new Date().toISOString(),
      source_note:v.source_note || '',
      web_sources:sourceSet.slice(0,20)
    });
  }

  const results=[...byId.values()].sort((a,b)=>Date.parse(b.kickoff_iso||0)-Date.parse(a.kickoff_iso||0));
  await fs.writeFile(RESULTS_PATH,JSON.stringify({updated_at:new Date().toISOString(),results_count:results.length,results},null,2));
  console.log(`Stored ${results.length} verified prediction results.`);
}

main().catch(err=>{console.error(err);process.exit(1)});
