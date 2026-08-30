import fs from 'node:fs/promises';
import path from 'node:path';

const OPENAI_API_KEY=process.env.OPENAI_API_KEY||'';
const SCREENING_MODEL=process.env.SCREENING_MODEL||'gpt-5.6-luna';
const DEEP_MODEL=process.env.DEEP_MODEL||'gpt-5.6-sol';
const INPUT=path.join(process.cwd(),'indicator','data','weltrade-candles.json');
const OUTPUT=path.join(process.cwd(),'indicator','data','signals.json');

function inspectCandles(candles){
  if(!Array.isArray(candles)||candles.length<60)return null;
  const normalized=candles.map(c=>({open:+c.open,high:+c.high,low:+c.low,close:+c.close,epoch:+c.epoch}));
  if(normalized.some(c=>![c.open,c.high,c.low,c.close,c.epoch].every(Number.isFinite)))return null;
  const closes=normalized.map(c=>c.close),highs=normalized.map(c=>c.high),lows=normalized.map(c=>c.low),last=normalized.at(-1);
  const ema=period=>{const k=2/(period+1);return closes.reduce((value,price,index)=>index?value+k*(price-value):price,closes[0]);};
  const ema20=ema(20),ema50=ema(50),ema200=ema(Math.min(200,closes.length));
  const gains=[],losses=[];
  for(let i=closes.length-14;i<closes.length;i++){const delta=closes[i]-closes[i-1];gains.push(Math.max(delta,0));losses.push(Math.max(-delta,0));}
  const avgGain=gains.reduce((a,b)=>a+b,0)/14,avgLoss=losses.reduce((a,b)=>a+b,0)/14,rsi=avgLoss===0?100:100-(100/(1+avgGain/avgLoss));
  const trs=normalized.slice(-15).map((c,i,a)=>i?Math.max(c.high-c.low,Math.abs(c.high-a[i-1].close),Math.abs(c.low-a[i-1].close)):c.high-c.low),atr=trs.reduce((a,b)=>a+b,0)/trs.length;
  const recent=normalized.slice(-22,-2),swingHigh=Math.max(...recent.map(c=>c.high)),swingLow=Math.min(...recent.map(c=>c.low));
  const bullish=ema20>ema50&&last.close>ema20,side=bullish?'BUY':'SELL';
  const bos=bullish?last.close>swingHigh:last.close<swingLow,choch=bullish?last.close>Math.max(...highs.slice(-8,-2)):last.close<Math.min(...lows.slice(-8,-2));
  const sweep=bullish?last.low<swingLow&&last.close>swingLow:last.high>swingHigh&&last.close<swingHigh;
  const body=Math.abs(last.close-last.open),range=Math.max(last.high-last.low,.00001),impulse=body/range>.55,third=normalized.at(-3);
  const fvg=bullish?last.low>third.high:last.high<third.low,retest=bullish?last.low<=ema20&&last.close>ema20:last.high>=ema20&&last.close<ema20;
  const orderBlock=bullish?recent.slice(-6).some(c=>c.close<c.open&&(c.high-c.low)>atr):recent.slice(-6).some(c=>c.close>c.open&&(c.high-c.low)>atr);
  const momentum=bullish?rsi>52&&rsi<78:rsi<48&&rsi>22,trendStrong=bullish?ema20>ema50&&ema50>=ema200:ema20<ema50&&ema50<=ema200;
  const spikeRisk=body>atr*2.2||(last.high-last.low)>atr*2.8,checks=[trendStrong,momentum,bos||choch,sweep,impulse,fvg,retest,orderBlock,!spikeRisk],passed=checks.filter(Boolean).length;
  return {side,confidence:Math.min(95,Math.round(42+passed*5.5)),passed,bos,choch,sweep,impulse,fvg,retest,orderBlock,momentum,trendStrong,spikeRisk,ema20,ema50,ema200,rsi,atr,swingHigh,swingLow,closedAt:last.epoch,price:last.close,change:((last.close/closes.at(-2))-1)*100};
}

function technicalSetup(meta,h1,h4){
  const aligned=h1.side===h4.side;
  const confirmed=aligned&&h4.trendStrong&&h1.passed>=5&&!h1.spikeRisk;
  const verdict=confirmed?h1.side:'ATTENDRE';
  const confidence=confirmed?Math.round(h1.confidence*.58+h4.confidence*.42):Math.min(64,Math.round((h1.confidence+h4.confidence)/2));
  let levels=null;
  if(verdict!=='ATTENDRE'){
    const entry=h1.price,structural=verdict==='BUY'?Math.min(entry-h1.atr*1.5,h1.swingLow):Math.max(entry+h1.atr*1.5,h1.swingHigh),distance=Math.max(Math.abs(entry-structural),h1.atr),direction=verdict==='BUY'?1:-1;
    levels={entry,sl:structural,tp1:entry+direction*distance*1.5,tp2:entry+direction*distance*2.4,tp3:entry+direction*distance*3.6};
  }
  return {...meta,price:h1.price,technical_verdict:verdict,technical_confidence:confidence,levels,h1,h4,risk:{risk_reward:3.6,spike_risk:h1.spikeRisk,source:'Weltrade MT5 SyntX'}};
}

async function loadWeltradeFeed(){
  try{
    const feed=JSON.parse(await fs.readFile(INPUT,'utf8'));
    if(feed?.broker!=='Weltrade'||!Array.isArray(feed?.markets))return {ready:false,status:'invalid_mt5_feed',note:'Le fichier MT5 ne correspond pas à un export Weltrade valide.'};
    const exportedAt=Date.parse(feed.exported_at);
    if(!Number.isFinite(exportedAt))return {ready:false,status:'invalid_mt5_time',note:'L’export Weltrade doit contenir une date exported_at valide.'};
    if(Date.now()-exportedAt>130*60*1000)return {ready:false,status:'stale_mt5_data',note:'ATTENDRE — les bougies Weltrade MT5 ont plus de 130 minutes. Une nouvelle exportation H1/H4 est requise.'};
    const valid=feed.markets.filter(row=>row?.market&&row?.symbol&&Array.isArray(row?.h1)&&row.h1.length>=60&&Array.isArray(row?.h4)&&row.h4.length>=60);
    if(!valid.length)return {ready:false,status:'insufficient_mt5_data',note:'ATTENDRE — aucune série Weltrade ne contient au moins 60 bougies H1 et 60 bougies H4.'};
    return {ready:true,feed:{...feed,markets:valid}};
  }catch(error){
    if(error?.code==='ENOENT')return {ready:false,status:'awaiting_mt5',note:'ATTENDRE — les bougies Weltrade MT5 H1/H4 ne sont pas encore reçues. Aucun cours ni signal n’est inventé.'};
    return {ready:false,status:'invalid_mt5_json',note:'Le fichier de bougies Weltrade est illisible.'};
  }
}

async function writeWaiting(status,note){
  const payload={ok:false,status,source_broker:'Weltrade',source:'Weltrade MT5 · SyntX',updated_at:null,markets_count:0,confirmed_signals:0,markets:[],note,safety:'Signaux uniquement. Aucun accès au compte et aucun ordre automatique.'};
  await fs.mkdir(path.dirname(OUTPUT),{recursive:true});
  await fs.writeFile(OUTPUT,JSON.stringify(payload,null,2));
  console.log(note);
}

const auditItem={type:'object',additionalProperties:false,properties:{id:{type:'string'},verdict:{type:'string',enum:['BUY','SELL','ATTENDRE']},confidence:{type:'number',minimum:0,maximum:100},summary:{type:'string'},confirmations:{type:'array',items:{type:'string'}},contradictions:{type:'array',items:{type:'string'}},risk:{type:'string'},needs_expert_review:{type:'boolean'}},required:['id','verdict','confidence','summary','confirmations','contradictions','risk','needs_expert_review']};
const auditSchema={type:'object',additionalProperties:false,properties:{markets:{type:'array',items:auditItem}},required:['markets']};

function extractOutputText(response){if(response?.output_text)return response.output_text;for(const item of response?.output||[]){if(item?.type!=='message')continue;for(const content of item?.content||[]){if(content?.type==='output_text'&&content.text)return content.text;}}throw new Error('OpenAI returned no output_text');}
async function callOpenAI(body){const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const raw=await res.text();let response={};try{response=raw?JSON.parse(raw):{};}catch{throw new Error(`OpenAI returned unreadable JSON (${res.status})`);}if(!res.ok)throw new Error(`OpenAI API ${res.status}: ${response?.error?.code||response?.error?.type||'request_failed'}`);if(response.status==='incomplete')throw new Error(`OpenAI incomplete response: ${response.incomplete_details?.reason||'unknown'}`);return response;}
function publicSetup(setup){const clean=value=>({side:value.side,confidence:value.confidence,passed:value.passed,bos:value.bos,choch:value.choch,sweep:value.sweep,impulse:value.impulse,fvg:value.fvg,retest:value.retest,orderBlock:value.orderBlock,momentum:value.momentum,trendStrong:value.trendStrong,spikeRisk:value.spikeRisk,ema20:value.ema20,ema50:value.ema50,ema200:value.ema200,rsi:value.rsi,atr:value.atr,swingHigh:value.swingHigh,swingLow:value.swingLow,closedAt:value.closedAt,price:value.price,change:value.change});return {id:setup.symbol,market:setup.market,symbol:setup.symbol,price:setup.price,technical_verdict:setup.technical_verdict,technical_confidence:setup.technical_confidence,levels:setup.levels,h1:clean(setup.h1),h4:clean(setup.h4),risk:setup.risk};}
async function auditMarkets(model,setups,deep=false){
  const instructions=deep?'Tu es Sol, seconde couche de contrôle de Sera Indicator pour les indices Weltrade SyntX. Vérifie profondément chaque setup sans inventer de données. Confirme uniquement le même BUY/SELL technique ou remplace-le par ATTENDRE. Examine H1/H4, structure, liquidité, retest, momentum, ATR, risque de spike et cohérence entrée/SL/TP.':'Tu es Luna, première couche de contrôle indépendante de Sera Indicator pour Weltrade SyntX. Analyse uniquement les indicateurs fournis. Confirme le même BUY/SELL technique ou remplace-le par ATTENDRE; ne transforme jamais ATTENDRE en signal et n’inverse jamais le sens. La confiance n’est jamais une garantie de gain.';
  const response=await callOpenAI({model,reasoning:{effort:deep?'medium':'low'},store:false,instructions,input:JSON.stringify({broker:'Weltrade',market_family:'SyntX',generated_at:new Date().toISOString(),timeframes:['H1','H4'],execution:'manual_only',markets:setups.map(publicSetup)}),text:{format:{type:'json_schema',name:deep?'sera_weltrade_sol_audit':'sera_weltrade_luna_audit',strict:true,schema:auditSchema}}});
  const parsed=JSON.parse(extractOutputText(response));return {results:parsed.markets||[],response_id:response.id||null,usage:response.usage||null};
}

function finalize(setup,luna,sol){const audit=sol||luna||{verdict:'ATTENDRE',confidence:0,summary:'Analyse OpenAI absente.',confirmations:[],contradictions:['Validation IA absente'],risk:'Inconnu',needs_expert_review:true};const agreed=setup.technical_verdict!=='ATTENDRE'&&audit.verdict===setup.technical_verdict&&Number(audit.confidence)>=75&&!audit.needs_expert_review;const finalVerdict=agreed?setup.technical_verdict:'ATTENDRE',finalConfidence=agreed?Math.min(99,Math.round(setup.technical_confidence*.45+Number(audit.confidence)*.55)):Math.min(69,Math.round((setup.technical_confidence+Number(audit.confidence||0))/2));return {...publicSetup(setup),levels:finalVerdict==='ATTENDRE'?null:setup.levels,final_verdict:finalVerdict,final_confidence:finalConfidence,ai_verdict:audit.verdict,ai_confidence:Number(audit.confidence)||0,ai_summary:audit.summary,ai_confirmations:audit.confirmations||[],ai_contradictions:audit.contradictions||[],ai_risk:audit.risk,needs_expert_review:Boolean(audit.needs_expert_review),ai_tier:sol?`${DEEP_MODEL} · validation profonde`:`${SCREENING_MODEL} · contrôle initial`};}

async function selfTest(){const candles=Array.from({length:240},(_,i)=>{const base=1000+i*.8,open=base+Math.sin(i/4)*2,close=base+1+Math.sin(i/4)*2,high=Math.max(open,close)+3,low=Math.min(open,close)-3;return{open,high,low,close,epoch:1700000000+i*3600};});const result=inspectCandles(candles);if(!result||!Number.isFinite(result.atr)||!['BUY','SELL'].includes(result.side))throw new Error('Technical engine self-test failed');const setup=technicalSetup({market:'FX Vol',symbol:'TEST.FXVOL'},result,{...result,trendStrong:true});if(!setup.h1||!setup.h4)throw new Error('H1/H4 assembly failed');console.log('Weltrade signal engine self-test passed.');}

async function main(){
  if(process.argv.includes('--self-test'))return selfTest();
  const source=await loadWeltradeFeed();
  if(!source.ready)return writeWaiting(source.status,source.note);
  if(!OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is not configured');
  const setups=source.feed.markets.map(meta=>{const h1=inspectCandles(meta.h1),h4=inspectCandles(meta.h4);if(!h1||!h4)throw new Error(`Insufficient candles for ${meta.market}`);return technicalSetup({market:meta.market,symbol:meta.symbol},h1,h4);});
  const luna=await auditMarkets(SCREENING_MODEL,setups,false),lunaMap=new Map(luna.results.map(row=>[String(row.id),row]));
  const deepCandidates=setups.filter(setup=>setup.technical_verdict!=='ATTENDRE'&&lunaMap.get(setup.symbol)?.verdict===setup.technical_verdict).sort((a,b)=>b.technical_confidence-a.technical_confidence).slice(0,5);
  let sol={results:[],response_id:null,usage:null};if(deepCandidates.length)sol=await auditMarkets(DEEP_MODEL,deepCandidates,true);
  const solMap=new Map(sol.results.map(row=>[String(row.id),row])),markets=setups.map(setup=>finalize(setup,lunaMap.get(setup.symbol),solMap.get(setup.symbol)));
  const payload={ok:true,status:'ai_analyzed',source_broker:'Weltrade',source:'Weltrade MT5 · SyntX H1/H4',source_updated_at:source.feed.exported_at,updated_at:new Date().toISOString(),model:`${SCREENING_MODEL} + ${DEEP_MODEL}`,screening_model:SCREENING_MODEL,deep_model:DEEP_MODEL,markets_count:markets.length,confirmed_signals:markets.filter(m=>m.final_verdict!=='ATTENDRE').length,markets,openai_response_ids:{screening:luna.response_id,deep:sol.response_id},usage:{screening:luna.usage,deep:sol.usage},safety:'Signaux uniquement. Aucun accès au compte et aucun ordre automatique. BUY/SELL exige un accord technique et OpenAI avec confiance IA >= 75.'};
  await fs.mkdir(path.dirname(OUTPUT),{recursive:true});await fs.writeFile(OUTPUT,JSON.stringify(payload,null,2));console.log(`Wrote ${markets.length} Weltrade analyses; ${payload.confirmed_signals} confirmed signals.`);
}

main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exit(1);});
