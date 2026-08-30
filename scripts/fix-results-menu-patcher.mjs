import fs from 'node:fs/promises';
const file='scripts/patch-results-menu.mjs';
let s=await fs.readFile(file,'utf8');
const bad = "${r.exact_score_success===true?'hit':r.exact_score_success===false?'miss':'pendingResult'}";
const good = "\\${r.exact_score_success===true?'hit':r.exact_score_success===false?'miss':'pendingResult'}";
s=s.split(bad).join(good);
await fs.writeFile(file,s);
console.log('Fixed nested template interpolation in results menu patcher.');
