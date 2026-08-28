import fs from 'node:fs/promises';

const path='index.html';
let html=await fs.readFile(path,'utf8');

const old="function isCurrentMatch(m){if(!m.start_time)return true;const kickoff=Number(m.start_time)*1000;if(!Number.isFinite(kickoff))return true;return Date.now()<kickoff+(2*60*60*1000)}";
const replacement="function isCurrentMatch(m){if(!m.start_time)return false;const kickoff=Number(m.start_time)*1000;if(!Number.isFinite(kickoff))return false;const d=new Date(kickoff),now=new Date();const sameDay=d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();return sameDay&&Date.now()<kickoff+(2*60*60*1000)}";
if(!html.includes(old)) throw new Error('isCurrentMatch function not found');
html=html.replace(old,replacement);

const oldFmt="function fmtKickoff(m){if(m.start_time){try{return new Date(Number(m.start_time)*1000).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})}catch{}}return m.time||'—'}";
const newFmt="function fmtKickoff(m){if(m.start_time){try{const d=new Date(Number(m.start_time)*1000),now=new Date();const sameDay=d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();const time=d.toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'});return sameDay?time:`${d.toLocaleDateString(locale(),{day:'2-digit',month:'2-digit'})} · ${time}`}catch{}}return m.time||'—'}";
if(html.includes(oldFmt)) html=html.replace(oldFmt,newFmt);

await fs.writeFile(path,html);
console.log('Sera Winner now shows only today matches and removes them two hours after kickoff.');
