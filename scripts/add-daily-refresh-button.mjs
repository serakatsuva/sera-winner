import fs from 'node:fs/promises';

const path='index.html';
let html=await fs.readFile(path,'utf8');

html=html
  .replaceAll('Actualiser les résultats','Actualiser la journée')
  .replaceAll('Refresh results','Refresh today')
  .replaceAll('Actualizar resultados','Actualizar el día');

const oldHandler="document.getElementById('refresh').onclick=loadPredictions;";
const newHandler=`async function refreshToday(){
  const btn=document.getElementById('refresh');
  const oldText=btn.textContent;
  btn.disabled=true;
  btn.textContent=lang==='fr'?'⟳ Actualisation du jour…':lang==='es'?'⟳ Actualizando hoy…':'⟳ Refreshing today…';
  try{
    await loadPredictions();
    const updated=meta.updated_at?new Date(meta.updated_at):null;
    const now=new Date();
    const sameDay=updated&&updated.getFullYear()===now.getFullYear()&&updated.getMonth()===now.getMonth()&&updated.getDate()===now.getDate();
    btn.textContent=sameDay?(lang==='fr'?'✓ Journée actualisée':lang==='es'?'✓ Día actualizado':'✓ Today updated'):(lang==='fr'?'⚠ Analyse du jour en attente':lang==='es'?'⚠ Análisis de hoy pendiente':'⚠ Today analysis pending');
    setTimeout(()=>{btn.textContent=lang==='fr'?'↻ Actualiser la journée':lang==='es'?'↻ Actualizar el día':'↻ Refresh today';btn.disabled=false},2500);
  }catch(e){
    btn.textContent=lang==='fr'?'⚠ Réessayer':lang==='es'?'⚠ Reintentar':'⚠ Try again';
    btn.disabled=false;
  }
}
document.getElementById('refresh').onclick=refreshToday;`;
if(html.includes(oldHandler)) html=html.replace(oldHandler,newHandler);
else throw new Error('refresh handler not found');

await fs.writeFile(path,html);
console.log('Daily refresh button added.');
