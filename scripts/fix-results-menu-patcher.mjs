import fs from 'node:fs/promises';
const file='scripts/patch-results-menu.mjs';
let s=await fs.readFile(file,'utf8');
s=s.replace('class=\\"${r.exact_score_success===true?', 'class=\\"\\${r.exact_score_success===true?');
await fs.writeFile(file,s);
console.log('Fixed nested template interpolation in results menu patcher.');
