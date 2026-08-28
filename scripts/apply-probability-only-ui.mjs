import fs from 'node:fs/promises';

const file='index.html';
let html=await fs.readFile(file,'utf8');

function mustReplace(from,to,label){
  if(!html.includes(from)) throw new Error(`Patch target not found: ${label}`);
  html=html.replace(from,to);
}

// Remove exact-score filter from the metric selector.
html=html.replace(/<option value="score_confidence"[^>]*>[^<]*<\/option>/,'');

// Replace the recommendation renderer so the purple box shows the strongest of the 4 core probabilities, never an exact score.
const recStart=html.indexOf('function renderRecommendations(){');
const renderStart=html.indexOf('function render(){',recStart);
if(recStart<0||renderStart<0) throw new Error('Recommendation renderer not found');
const newRec=`function renderRecommendations(){const box=document.getElementById('recommendations');let list=deepPool().filter(m=>(m.confidence??0)>=50).sort((a,b)=>(Number(b.confidence||0)-Number(a.confidence||0))||Number(a.deep_rank||999)-Number(b.deep_rank||999)).slice(0,REC_LIMIT);if(!list.length){box.innerHTML=\`<div class="empty">\${esc(tr('noRecommendation'))}</div>\`;return}box.innerHTML=list.map((m,i)=>{const angle=bestAngle(m),hasAngle=angle[1]!=='—'&&angle[1]!=null;return \`<div class="recItem"><div class="recTop"><div><div class="recLeague">#\${i+1} · \${esc(m.league||tr('league'))}</div><div class="recTeams">\${esc(m.home)} vs \${esc(m.away)}</div><div class="recTime">🕒 \${esc(tr('kickoff'))}: <b>\${esc(fmtKickoff(m))}</b></div></div><div class="recScore"><b>\${hasAngle?pct(angle[1]):'—'}</b><small>\${esc(hasAngle?angle[0]:tr('noStrongAngle'))}</small></div></div><div class="recBottom"><div class="recAngle">\${esc(tr('dataQuality'))}: <b>\${pct(m.data_quality)}</b><br>\${esc(tr('analysisReliability'))}: <b>\${pct(m.confidence)}</b></div><div class="confidencePill">\${esc(tr('global'))} \${pct(m.confidence)}</div></div></div>\`}).join('')}\n`;
html=html.slice(0,recStart)+newRec+html.slice(renderStart);

// Remove exact score and score-confidence tiles from normal match cards.
html=html.replace(/<div class="metric scoreMetric"><strong>\$\{esc\(m\.predicted_score\|\|'—'\)\}<\/strong><small>\$\{esc\(tr\('scoreProbable'\)\)\}<\/small><\/div><div class="metric scoreMetric"><strong>\$\{pct\(m\.score_confidence\)\}<\/strong><small>\$\{esc\(tr\('scoreConfShort'\)\)\}<\/small><\/div>/g,'');

// Wording: the app now presents the 4 core probabilities, not an exact score.
html=html.replace('probabilités football · score probable','probabilités football · pronostic principal');
html=html.replace('football probabilities · predicted score','football probabilities · main prediction');
html=html.replace('probabilidades de fútbol · marcador probable','probabilidades de fútbol · pronóstico principal');

html=html.replace("modalScore:'un <b>score probable</b> et les niveaux de confiance.'","modalScore:'le <b>pronostic principal</b> retenu parmi les 4 probabilités et les niveaux de confiance.'");
html=html.replace("modalScore:'a <b>predicted score</b> and confidence levels.'","modalScore:'the <b>main prediction</b> selected from the 4 probabilities and confidence levels.'");
html=html.replace("modalScore:'un <b>marcador probable</b> y niveles de confianza.'","modalScore:'el <b>pronóstico principal</b> elegido entre las 4 probabilidades y los niveles de confianza.'");

html=html.replace("recommendIntro:'Sélection de 8 matchs maximum parmi les matchs approfondis par Sol, classés selon le niveau de confiance.'","recommendIntro:'Sélection de 8 matchs maximum parmi les analyses Sol. Chaque carte affiche le pronostic principal parmi les 4 probabilités.'");
html=html.replace("recommendIntro:'Up to 8 matches selected from the Sol deep-analysis pool, ranked by confidence level.'","recommendIntro:'Up to 8 matches from the Sol deep-analysis pool. Each card shows the main pick among the 4 probabilities.'");
html=html.replace("recommendIntro:'Hasta 8 partidos seleccionados entre los analizados en profundidad por Sol, ordenados por nivel de confianza.'","recommendIntro:'Hasta 8 partidos del análisis profundo de Sol. Cada tarjeta muestra el pronóstico principal entre las 4 probabilidades.'");

// Add a label for analysis reliability in all languages.
html=html.replace("noStrongAngle:'Aucun angle suffisamment fiable',kickoff:'Coup d’envoi'","noStrongAngle:'Aucun angle suffisamment fiable',analysisReliability:'Fiabilité analyse',kickoff:'Coup d’envoi'");
html=html.replace("noStrongAngle:'No sufficiently reliable angle',kickoff:'Kick-off'","noStrongAngle:'No sufficiently reliable angle',analysisReliability:'Analysis reliability',kickoff:'Kick-off'");
html=html.replace("noStrongAngle:'Ninguna opción suficientemente fiable',kickoff:'Inicio'","noStrongAngle:'Ninguna opción suficientemente fiable',analysisReliability:'Fiabilidad del análisis',kickoff:'Inicio'");

// Footer no longer references exact-score confidence.
html=html.replace(/footerNote:'<b>Note:<\/b>[^']*'/,"footerNote:'<b>Note :</b> les pourcentages sont des estimations probabilistes issues des données disponibles et d’une analyse IA, pas des garanties. Les quatre pronostics principaux sont 2+ buts, 3+ buts, 1H > 2H et 2H > 1H.'");
html=html.replace(/footerNote:'<b>Note:<\/b>[^']*'/,"footerNote:'<b>Note:</b> percentages are probabilistic estimates based on available data and AI analysis, not guarantees. The four core predictions are 2+ goals, 3+ goals, 1H > 2H and 2H > 1H.'");

await fs.writeFile(file,html);
console.log('Exact score removed from UI; recommendations now display the strongest of the 4 core probabilities.');
