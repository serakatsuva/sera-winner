import fs from 'node:fs/promises';

const path='index.html';
let html=await fs.readFile(path,'utf8');

const oldCss='.recScore{text-align:center;min-width:58px;background:#211a32;border:1px solid #493d66;border-radius:10px;padding:6px}.recScore b{display:block;color:#e4caff;font-size:18px}.recScore small{font-size:8px;color:#a99abe}';
const newCss='.recScore{text-align:center;min-width:58px;border-radius:10px;padding:6px;transition:.2s ease}.recScore b{display:block;font-size:18px}.recScore small{font-size:8px}.recScore.low{background:#35181d;border:1px solid #8b3944;box-shadow:0 0 0 1px rgba(255,107,107,.08),0 0 14px rgba(255,107,107,.08)}.recScore.low b{color:#ff9b9b}.recScore.low small{color:#ffc0c0}.recScore.mid{background:#3b3216;border:1px solid #9f863c;box-shadow:0 0 0 1px rgba(243,200,73,.08),0 0 14px rgba(243,200,73,.08)}.recScore.mid b{color:#ffe27a}.recScore.mid small{color:#f5dda0}.recScore.high{background:#103128;border:1px solid #1d6f55;box-shadow:0 0 0 1px rgba(32,212,137,.08),0 0 14px rgba(32,212,137,.1)}.recScore.high b{color:#64efb6}.recScore.high small{color:#b9f7dc}';
if(!html.includes(oldCss)) throw new Error('recScore CSS target not found');
html=html.replace(oldCss,newCss);

if(!html.includes('function probabilityBand(v)')){
  html=html.replace('function deepPool(){',"function probabilityBand(v){const n=Number(v);if(!Number.isFinite(n))return 'low';if(n<=50)return 'low';if(n<=70)return 'mid';return 'high'}\nfunction deepPool(){");
}

const oldBox='<div class="recScore"><b>${hasAngle?pct(angle[1]):\'—\'}</b><small>${esc(hasAngle?angle[0]:tr(\'noStrongAngle\'))}</small></div>';
const newBox='<div class="recScore ${probabilityBand(angle[1])}"><b>${hasAngle?pct(angle[1]):\'—\'}</b><small>${esc(hasAngle?angle[0]:tr(\'noStrongAngle\'))}</small></div>';
if(!html.includes(oldBox)) throw new Error('recommendation probability box target not found');
html=html.replace(oldBox,newBox);

await fs.writeFile(path,html);
console.log('Probability recommendation boxes now use red/yellow/green bands.');
