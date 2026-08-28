import fs from 'node:fs/promises';

const file='index.html';
let html=await fs.readFile(file,'utf8');
function replaceOnce(from,to,label){if(!html.includes(from))throw new Error(`Patch target not found: ${label}`);html=html.replace(from,to)}

replaceOnce(
".recTeams{font-size:12px;font-weight:800;line-height:1.3;margin-top:3px}",
".recTeams{font-size:12px;font-weight:800;line-height:1.3;margin-top:3px}.recTime{font-size:10px;color:#8fb6df;margin-top:4px;display:flex;align-items:center;gap:4px}",
'recommendation time css');

replaceOnce(
"analysisGoals:'Analyse buts'",
"analysisGoals:'Analyse buts',kickoff:'Coup d’envoi'",
'fr kickoff');
replaceOnce(
"analysisGoals:'Goals analysis'",
"analysisGoals:'Goals analysis',kickoff:'Kick-off'",
'en kickoff');
replaceOnce(
"analysisGoals:'Análisis de goles'",
"analysisGoals:'Análisis de goles',kickoff:'Inicio'",
'es kickoff');

replaceOnce(
"function bestAngle(m){",
"function fmtKickoff(m){if(m.start_time){try{return new Date(Number(m.start_time)*1000).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})}catch{}}return m.time||'—'}\nfunction bestAngle(m){",
'kickoff formatter');

replaceOnce(
"<div class=\"recTeams\">${esc(m.home)} vs ${esc(m.away)}</div></div><div class=\"recScore\">",
"<div class=\"recTeams\">${esc(m.home)} vs ${esc(m.away)}</div><div class=\"recTime\">🕒 ${esc(tr('kickoff'))}: <b>${esc(fmtKickoff(m))}</b></div></div><div class=\"recScore\">",
'recommendation time markup');

await fs.writeFile(file,html);
console.log('Added kickoff time to recommended predictions');
