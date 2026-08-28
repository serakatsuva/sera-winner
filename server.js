const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const ALYBET_URL = 'https://alybet.io/api/v2/odds?bookmaker=winner';
let cache = { ts: 0, data: null, error: null };
const CACHE_MS = 60000;

async function fetchWinner() {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_MS) return cache;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(ALYBET_URL, {headers:{Accept:'application/json','User-Agent':'WinnerFootball-GoalIQ/3.0'}, signal:controller.signal});
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AlyBet HTTP ${res.status}`);
    const raw = await res.json();
    const matches = (raw.matches || []).filter(m => String(m.bookmaker || '').toLowerCase().includes('winner')).map(m => ({id:m.id,sport:m.sport||'football',league:m.league||'Unknown',home:m.home,away:m.away,start_time:m.start_time,updated:m.updated,odds:m.odds||{},source:'AlyBet → Winner'}));
    cache = {ts:now,data:{matches,matches_count:matches.length,version:raw.version??null,source:'AlyBet third-party connector for Winner'},error:null};
  } catch (err) { cache = {ts:now,data:null,error:String(err.message||err)}; }
  return cache;
}

app.get('/api/winner', async (req,res) => {
  const result = await fetchWinner();
  if (!result.data) return res.status(502).json({ok:false,error:result.error,note:'Connecteur Winner indisponible; fallback démo.'});
  res.json({ok:true,...result.data,fetched_at:new Date(result.ts).toISOString()});
});
app.get('/api/health',(req,res)=>res.json({ok:true,service:'Winner Football GoalIQ',cache_age_sec:cache.ts?Math.round((Date.now()-cache.ts)/1000):null}));
app.use(express.static(path.join(__dirname)));
app.listen(PORT,()=>console.log(`Winner Football GoalIQ: http://localhost:${PORT}`));
