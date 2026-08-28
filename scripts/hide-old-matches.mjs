import fs from 'node:fs/promises';

const file = 'index.html';
let html = await fs.readFile(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!html.includes(from)) throw new Error(`Patch target not found: ${label}`);
  html = html.replace(from, to);
}

replaceOnce(
  "function inTime(m){if(timeBand==='all')return true;if(!m.start_time)return false;const h=new Date(Number(m.start_time)*1000).getHours();if(timeBand==='morning')return h>=5&&h<12;if(timeBand==='afternoon')return h>=12&&h<18;if(timeBand==='evening')return h>=18||h<5;return true}",
  "function isCurrentMatch(m){if(!m.start_time)return true;const kickoff=Number(m.start_time)*1000;if(!Number.isFinite(kickoff))return true;return Date.now()<kickoff+(2*60*60*1000)}\nfunction inTime(m){if(timeBand==='all')return true;if(!m.start_time)return false;const h=new Date(Number(m.start_time)*1000).getHours();if(timeBand==='morning')return h>=5&&h<12;if(timeBand==='afternoon')return h>=12&&h<18;if(timeBand==='evening')return h>=18||h<5;return true}",
  'current match predicate'
);

replaceOnce(
  "const leagues=[...new Set(matches.map(m=>m.league).filter(Boolean))]",
  "const leagues=[...new Set(matches.filter(isCurrentMatch).map(m=>m.league).filter(Boolean))]",
  'league filter current matches'
);

replaceOnce(
  "const teams=[...new Set(matches.filter(m=>m.league===league).flatMap(m=>[m.home,m.away]).filter(Boolean))]",
  "const teams=[...new Set(matches.filter(m=>isCurrentMatch(m)&&m.league===league).flatMap(m=>[m.home,m.away]).filter(Boolean))]",
  'team filter current matches'
);

replaceOnce(
  "function deepPool(){const deep=matches.filter(m=>m.analysis_tier==='sol_deep'||m.deep_rank);return deep.length?deep:matches}",
  "function deepPool(){const current=matches.filter(isCurrentMatch);const deep=current.filter(m=>m.analysis_tier==='sol_deep'||m.deep_rank);return deep.length?deep:current}",
  'recommendation pool current matches'
);

replaceOnce(
  "let list=matches.filter(m=>(!league||m.league===league)&&(!team||m.home===team||m.away===team)&&inBand(m[metric])&&inTime(m));",
  "let list=matches.filter(m=>isCurrentMatch(m)&&(!league||m.league===league)&&(!team||m.home===team||m.away===team)&&inBand(m[metric])&&inTime(m));",
  'main results current matches'
);

replaceOnce(
  "document.getElementById('matchCount').textContent=matches.length;",
  "document.getElementById('matchCount').textContent=matches.filter(isCurrentMatch).length;",
  'visible match count'
);

replaceOnce(
  "setInterval(loadPredictions,60000);",
  "setInterval(loadPredictions,60000);setInterval(()=>{populateFilters();updateStatusUI();render()},30000);",
  'automatic expiry refresh'
);

await fs.writeFile(file, html);
console.log('Matches now expire from the UI two hours after kickoff.');
