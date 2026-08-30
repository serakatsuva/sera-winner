import fs from 'node:fs/promises';

const file='index.html';
let s=await fs.readFile(file,'utf8');

// Expand summary grid for the richer performance dashboard.
s=s.replace(/\.resultSummary\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,
  '.resultSummary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))');

const marker='const mainKnown=list.filter(x=>x.main_prediction_success!==null&&x.main_prediction_success!==undefined),mainHits=mainKnown.filter(x=>x.main_prediction_success===true).length;';
if(!s.includes(marker)){
  console.log('Performance summary already updated or expected marker not found.');
  await fs.writeFile(file,s);
  process.exit(0);
}

const replacement=`const mainKnown=list.filter(x=>x.main_prediction_success!==null&&x.main_prediction_success!==undefined),mainHits=mainKnown.filter(x=>x.main_prediction_success===true).length;
const exactKnown=list.filter(x=>x.exact_score_success!==null&&x.exact_score_success!==undefined),exactHits=exactKnown.filter(x=>x.exact_score_success===true).length;
const topPredicted=list.filter(x=>x.recommendation_rank&&Number(x.recommendation_rank)<=8),topKnown=topPredicted.filter(x=>x.main_prediction_success!==null&&x.main_prediction_success!==undefined),topHits=topKnown.filter(x=>x.main_prediction_success===true).length;
const high71=list.filter(x=>Number(x.metric_probability)>=71&&x.main_prediction_success!==null&&x.main_prediction_success!==undefined),high71Hits=high71.filter(x=>x.main_prediction_success===true).length;
const high80=list.filter(x=>Number(x.metric_probability)>=80&&x.main_prediction_success!==null&&x.main_prediction_success!==undefined),high80Hits=high80.filter(x=>x.main_prediction_success===true).length;
const rate=(a,b)=>b?Math.round(a*100/b):0;
sum.innerHTML='<div class="resultStat"><b>'+topHits+'/'+topKnown.length+'</b><span>TOP 8 réussis · '+topKnown.length+'/8 vérifiés · '+rate(topHits,topKnown.length)+'%</span></div>'+
'<div class="resultStat"><b>'+high71Hits+'/'+high71.length+'</b><span>Probabilité ≥71% réussie · '+rate(high71Hits,high71.length)+'%</span></div>'+
'<div class="resultStat"><b>'+high80Hits+'/'+high80.length+'</b><span>Probabilité ≥80% réussie · '+rate(high80Hits,high80.length)+'%</span></div>'+
'<div class="resultStat"><b>'+mainHits+'/'+mainKnown.length+'</b><span>Tous pronostics réussis · '+rate(mainHits,mainKnown.length)+'%</span></div>'+
'<div class="resultStat"><b>'+exactHits+'/'+exactKnown.length+'</b><span>Scores exacts · '+rate(exactHits,exactKnown.length)+'%</span></div>';`;

const start=s.indexOf(marker);
const endToken='box.innerHTML=';
const end=s.indexOf(endToken,start);
if(end<0) throw new Error('Could not find result card rendering marker.');
const before=s.slice(0,start);
const after=s.slice(end);
s=before+replacement+after;

// Auto-refresh the results view in the browser every five minutes when open.
if(!s.includes('setInterval(()=>{if(document.getElementById(\'resultsPanel\')?.classList.contains(\'active\'))loadResults()},300000)')){
  s=s.replace('setInterval(loadPredictions,60000);',"setInterval(loadPredictions,60000);setInterval(()=>{if(document.getElementById('resultsPanel')?.classList.contains('active'))loadResults()},300000);");
}

await fs.writeFile(file,s);
console.log('Enhanced automatic performance summary applied.');
