import fs from 'node:fs/promises';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Patch target not found: ${label}`);
  return text.replace(from, to);
}

// 1) Strengthen AI prompting + post-processing in prediction engine.
const updaterPath='scripts/update-predictions.mjs';
let updater=await fs.readFile(updaterPath,'utf8');

updater=replaceOnce(updater,
"predicted_score is the single most plausible exact score, and score_confidence must be conservative. confidence is the reliability of the overall assessment, not the probability a bet wins.",
"predicted_score is the single most plausible exact score, and score_confidence must be conservative. Enforce mathematical and semantic consistency: p3 must never exceed p2; if the predicted score totals fewer than 2 goals, do not simultaneously make 2+ goals a strong (>60%) proposition unless the exact-score confidence is explicitly low; if it totals fewer than 3 goals, do not make 3+ goals a strong (>60%) proposition unless exact-score confidence is explicitly low. confidence is the reliability of the overall assessment, not the probability a bet wins.",
'screen prompt');

updater=replaceOnce(updater,
"Do a fast screening estimate for p2, p3, p1h, p2h, predicted_score, score_confidence and overall confidence.",
"Do a fast screening estimate for p2, p3, p1h, p2h, predicted_score, score_confidence and overall confidence. Enforce consistency: p3 <= p2; a low-scoring predicted score must not coexist with a strong goals-over probability unless the exact-score confidence is reduced accordingly.",
'discovery prompt');

updater=replaceOnce(updater,
"Do not preserve a high screening confidence if deeper evidence does not justify it. Never fabricate statistics.",
"Do not preserve a high screening confidence if deeper evidence does not justify it. Enforce consistency between the exact score and goal probabilities: p3 <= p2; if predicted_score totals 0-1 goals and p2 is above 60, lower score_confidence substantially unless evidence strongly supports a broad outcome distribution; if predicted_score totals fewer than 3 goals and p3 is above 60, likewise lower score_confidence. Never fabricate statistics.",
'deep prompt');

updater=replaceOnce(updater,
"function selectTopByConfidence(matches, count) {",
`function parseScoreTotal(score){const m=String(score||'').match(/(\\d+)\\s*[-:]\\s*(\\d+)/);return m?Number(m[1])+Number(m[2]):null}\nfunction enforceConsistency(m){const out={...m};const p2=Number(out.p2),p3=Number(out.p3);if(Number.isFinite(p2)&&Number.isFinite(p3)&&p3>p2)out.p3=Math.max(0,Math.min(100,Math.round(p2)));const total=parseScoreTotal(out.predicted_score);if(total!=null){let sc=Number(out.score_confidence);if(Number.isFinite(sc)){if(total<2&&Number(out.p2)>=60)sc=Math.min(sc,35);if(total<3&&Number(out.p3)>=60)sc=Math.min(sc,35);if(total>=2&&Number(out.p2)<45)sc=Math.min(sc,35);if(total>=3&&Number(out.p3)<45)sc=Math.min(sc,35);out.score_confidence=Math.max(0,Math.min(100,Math.round(sc)))}}return out}\n\nfunction selectTopByConfidence(matches, count) {`,
'consistency function');

updater=replaceOnce(updater,
"  const topForDeep = selectTopByConfidence(matches, DEEP_MATCHES);",
"  matches = matches.map(enforceConsistency);\n\n  const topForDeep = selectTopByConfidence(matches, DEEP_MATCHES);",
'pre deep normalize');

updater=replaceOnce(updater,
"  const payload = {\n    ok: true,",
"  matches = matches.map(enforceConsistency);\n\n  const payload = {\n    ok: true,",
'post deep normalize');

await fs.writeFile(updaterPath,updater);

// 2) Make the recommendation UI refuse weak/incoherent angles.
const indexPath='index.html';
let html=await fs.readFile(indexPath,'utf8');
html=replaceOnce(html,
"function bestAngle(m){const choices=[[tr('goals2'),m.p2],[tr('goals3'),m.p3],['1H > 2H',m.p1h],['2H > 1H',m.p2h]].filter(x=>x[1]!=null).sort((a,b)=>Number(b[1])-Number(a[1]));return choices[0]||[tr('analysisGoals'),'—']}",
"function scoreTotal(m){const x=String(m.predicted_score||'').match(/(\\d+)\\s*[-:]\\s*(\\d+)/);return x?Number(x[1])+Number(x[2]):null}function bestAngle(m){const total=scoreTotal(m),MIN=60;const choices=[];if(m.p2!=null&&Number(m.p2)>=MIN&&(total==null||total>=2))choices.push([tr('goals2'),m.p2]);if(m.p3!=null&&Number(m.p3)>=MIN&&(total==null||total>=3))choices.push([tr('goals3'),m.p3]);if(m.p1h!=null&&Number(m.p1h)>=MIN)choices.push(['1H > 2H',m.p1h]);if(m.p2h!=null&&Number(m.p2h)>=MIN)choices.push(['2H > 1H',m.p2h]);choices.sort((a,b)=>Number(b[1])-Number(a[1]));return choices[0]||[tr('noStrongAngle'),'—']}",
'best angle logic');

html=replaceOnce(html,"analysisGoals:'Analyse buts',kickoff:'Coup d’envoi'","analysisGoals:'Analyse buts',noStrongAngle:'Aucun angle suffisamment fiable',kickoff:'Coup d’envoi'",'fr no angle');
html=replaceOnce(html,"analysisGoals:'Goals analysis',kickoff:'Kick-off'","analysisGoals:'Goals analysis',noStrongAngle:'No sufficiently reliable angle',kickoff:'Kick-off'",'en no angle');
html=replaceOnce(html,"analysisGoals:'Análisis de goles',kickoff:'Inicio'","analysisGoals:'Análisis de goles',noStrongAngle:'Ninguna opción suficientemente fiable',kickoff:'Inicio'",'es no angle');

await fs.writeFile(indexPath,html);
console.log('Consistency rules applied to prediction engine and recommendation UI.');