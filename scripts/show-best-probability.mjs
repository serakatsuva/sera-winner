import fs from 'node:fs/promises';

const path='index.html';
let html=await fs.readFile(path,'utf8');

const old=/function bestAngle\(m\)\{const total=scoreTotal\(m\),MIN=60;const choices=\[\];if\(m\.p2!=null&&Number\(m\.p2\)>=MIN&&\(total==null\|\|total>=2\)\)choices\.push\(\[tr\('goals2'\),m\.p2\]\);if\(m\.p3!=null&&Number\(m\.p3\)>=MIN&&\(total==null\|\|total>=3\)\)choices\.push\(\[tr\('goals3'\),m\.p3\]\);if\(m\.p1h!=null&&Number\(m\.p1h\)>=MIN\)choices\.push\(\['1H > 2H',m\.p1h\]\);if\(m\.p2h!=null&&Number\(m\.p2h\)>=MIN\)choices\.push\(\['2H > 1H',m\.p2h\]\);choices\.sort\(\(a,b\)=>Number\(b\[1\]\)-Number\(a\[1\]\)\);return choices\[0\]\|\|\[tr\('noStrongAngle'\),'—'\]\}/;
const replacement="function bestAngle(m){const choices=[[tr('goals2'),m.p2],[tr('goals3'),m.p3],['1H > 2H',m.p1h],['2H > 1H',m.p2h]].filter(x=>x[1]!=null&&Number.isFinite(Number(x[1]))).sort((a,b)=>Number(b[1])-Number(a[1]));return choices[0]||[tr('analysisGoals'),'—']}";
if(!old.test(html)) throw new Error('bestAngle function not found');
html=html.replace(old,replacement);

html=html.replaceAll('Aucun angle suffisamment fiable','Probabilité principale');
html=html.replaceAll('No sufficiently reliable angle','Main probability');
html=html.replaceAll('Ninguna opción suficientemente fiable','Probabilidad principal');

await fs.writeFile(path,html);
console.log('Recommendation cards now always show the strongest of the four probabilities.');