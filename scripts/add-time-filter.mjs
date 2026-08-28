import fs from 'node:fs/promises';

const file = 'index.html';
let html = await fs.readFile(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!html.includes(from)) throw new Error(`Patch target not found: ${label}`);
  html = html.replace(from, to);
}

replaceOnce(
  ".toolbar{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(320px,1.4fr) minmax(210px,.9fr) minmax(210px,.9fr);gap:12px;align-items:end;margin:16px 0}",
  ".toolbar{display:grid;grid-template-columns:minmax(170px,.8fr) minmax(280px,1.2fr) minmax(170px,.7fr) minmax(190px,.9fr) minmax(190px,.9fr);gap:12px;align-items:end;margin:16px 0}",
  'toolbar columns'
);

replaceOnce(
  "    <div class=\"group\"><label data-i18n=\"leagueLabel\">1. CHAMPIONNAT</label><select id=\"leagueFilter\"><option value=\"\">Tous les championnats chargés</option></select></div>",
  "    <div class=\"group\"><label data-i18n=\"timeFilter\">PÉRIODE DU MATCH</label><select id=\"timeFilter\"><option value=\"all\" data-i18n=\"allTimes\">Tous les horaires</option><option value=\"morning\" data-i18n=\"morning\">Matin</option><option value=\"afternoon\" data-i18n=\"afternoon\">Après-midi</option><option value=\"evening\" data-i18n=\"evening\">Soir</option></select></div>\n    <div class=\"group\"><label data-i18n=\"leagueLabel\">1. CHAMPIONNAT</label><select id=\"leagueFilter\"><option value=\"\">Tous les championnats chargés</option></select></div>",
  'time filter html'
);

replaceOnce(
  "probabilityLevel:'NIVEAU DE PROBABILITÉ',all:'Tous'",
  "probabilityLevel:'NIVEAU DE PROBABILITÉ',timeFilter:'PÉRIODE DU MATCH',allTimes:'Tous les horaires',morning:'Matin',afternoon:'Après-midi',evening:'Soir',all:'Tous'",
  'fr translations'
);
replaceOnce(
  "probabilityLevel:'PROBABILITY LEVEL',all:'All'",
  "probabilityLevel:'PROBABILITY LEVEL',timeFilter:'MATCH TIME',allTimes:'All times',morning:'Morning',afternoon:'Afternoon',evening:'Evening',all:'All'",
  'en translations'
);
replaceOnce(
  "probabilityLevel:'NIVEL DE PROBABILIDAD',all:'Todos'",
  "probabilityLevel:'NIVEL DE PROBABILIDAD',timeFilter:'HORARIO DEL PARTIDO',allTimes:'Todos los horarios',morning:'Mañana',afternoon:'Tarde',evening:'Noche',all:'Todos'",
  'es translations'
);

replaceOnce(
  "let matches=[],band='all',limit=5,meta={};const REC_LIMIT=8;",
  "let matches=[],band='all',timeBand='all',limit=5,meta={};const REC_LIMIT=8;",
  'state'
);

replaceOnce(
  "function bestAngle(m){",
  "function inTime(m){if(timeBand==='all')return true;if(!m.start_time)return false;const h=new Date(Number(m.start_time)*1000).getHours();if(timeBand==='morning')return h>=5&&h<12;if(timeBand==='afternoon')return h>=12&&h<18;if(timeBand==='evening')return h>=18||h<5;return true}\nfunction bestAngle(m){",
  'time predicate'
);

replaceOnce(
  "function render(){const metric=document.getElementById('metric').value,league=document.getElementById('leagueFilter').value,team=document.getElementById('teamFilter').value;let list=matches.filter(m=>(!league||m.league===league)&&(!team||m.home===team||m.away===team)&&inBand(m[metric]));",
  "function render(){const metric=document.getElementById('metric').value,league=document.getElementById('leagueFilter').value,team=document.getElementById('teamFilter').value;let list=matches.filter(m=>(!league||m.league===league)&&(!team||m.home===team||m.away===team)&&inBand(m[metric])&&inTime(m));",
  'render filter'
);

replaceOnce(
  "document.getElementById('metric').onchange=render;document.getElementById('leagueFilter').onchange=()=>updateTeamFilter(true);",
  "document.getElementById('metric').onchange=render;document.getElementById('timeFilter').onchange=e=>{timeBand=e.target.value;render()};document.getElementById('leagueFilter').onchange=()=>updateTeamFilter(true);",
  'time handler'
);

await fs.writeFile(file, html);
console.log('Added multilingual match-time filter to index.html');
