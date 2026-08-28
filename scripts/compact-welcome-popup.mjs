import fs from 'node:fs/promises';

const file='index.html';
let html=await fs.readFile(file,'utf8');

// Compact modal CSS
html=html.replace(/\.modal-backdrop\{[^}]*\}\.modal-backdrop\.open\{[^}]*\}\.modal\{[^}]*\}\.modalTop\{[^}]*\}\.modalIcon\{[^}]*\}\.modalLang\{[^}]*\}\.modal h2\{[^}]*\}\.modal p,\.modal li\{[^}]*\}\.modal ul\{[^}]*\}\.modal \.disclaimer\{[^}]*\}\.modalActions\{[^}]*\}\.modalActions button\{[^}]*\}/,
`.modal-backdrop{display:none;position:fixed;inset:0;z-index:9999;background:rgba(1,8,16,.76);backdrop-filter:blur(6px);padding:16px;align-items:center;justify-content:center}.modal-backdrop.open{display:flex}.modal{width:min(92vw,500px);max-height:82vh;overflow:auto;background:linear-gradient(180deg,#102039,#081421);border:1px solid #315170;border-radius:20px;box-shadow:0 22px 70px rgba(0,0,0,.5);padding:18px}.modalTop{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}.modalIcon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#173d63;font-weight:900;color:#9ed2ff;flex:0 0 42px}.modalLang{width:128px;padding:7px 28px 7px 9px}.modal h2{margin:2px 0 8px;font-size:19px;line-height:1.25}.modal p,.modal li{color:#a9bdd4;font-size:13.5px;line-height:1.52}.modal p{margin:7px 0}.modal ul{padding-left:20px;margin:8px 0 10px}.modal .disclaimer{background:#2b1d20;border:1px solid #6a343b;color:#ffd5d8;border-radius:12px;padding:10px;margin:10px 0;font-size:12.5px;line-height:1.5}.modalActions{display:flex;justify-content:flex-end;margin-top:12px}.modalActions button{min-width:150px;padding:9px 13px;font-size:13px}`);

// Mobile-specific compactness
html=html.replace(/@media\(max-width:520px\)\{([^}]|\}[^@])*?\}\n<\/style>/s, m=>{
  if(m.includes('.modal{width:min(94vw,420px)')) return m;
  return m.replace(/\.modal-backdrop\{padding:9px\}\.modal\{padding:17px;border-radius:17px\}\.modal h2\{font-size:20px\}\.modalActions button\{width:100%\}/,
    '.modal-backdrop{padding:10px}.modal{width:min(94vw,420px);max-height:80vh;padding:15px 14px;border-radius:17px}.modal h2{font-size:18px}.modal p,.modal li{font-size:13px;line-height:1.48}.modal .disclaimer{font-size:12px;padding:9px}.modalActions button{width:100%}');
});

// Shorter FR translations
html=html.replace(/modalIntro:'<b>Sera Winner · AI-Supported Analysis<\/b> est un outil d’aide à l’analyse des matchs de football assisté par intelligence artificielle\.'/,
"modalIntro:'<b>Sera Winner · AI-Supported Analysis</b> est un outil d’aide à l’analyse du football assisté par IA.'");
html=html.replace(/modalShows:'L’application analyse les données disponibles et affiche notamment :'/,
"modalShows:'L’application estime notamment :'");
html=html.replace(/modalP2:'la probabilité d’avoir au moins <b>2 buts<\/b> dans le match ;'/,
"modalP2:'la probabilité de <b>2+ buts</b> ;'");
html=html.replace(/modalP3:'la probabilité d’avoir au moins <b>3 buts<\/b> ;'/,
"modalP3:'la probabilité de <b>3+ buts</b> ;'");
html=html.replace(/modalHalves:'la probabilité que la <b>1re mi-temps<\/b> ait plus de buts que la 2e, ou l’inverse ;'/,
"modalHalves:'la tendance <b>1re mi-temps vs 2e mi-temps</b> ;'");
html=html.replace(/modalScore:'un <b>score probable<\/b>, sa confiance estimée, la qualité des données et la confiance globale de l’analyse\.'/,
"modalScore:'un <b>score probable</b> et les niveaux de confiance.'");
html=html.replace(/disclaimer:'<b>Avertissement important:<\/b>[^']*'/,
"disclaimer:'<b>Avertissement :</b> les probabilités et pronostics sont des estimations, jamais des garanties. Sera Winner décline toute responsabilité liée aux paris, pertes ou décisions prises à partir de ces analyses.'");
html=html.replace(/responsibility:'Si vous utilisez ces analyses dans un contexte de pari,[^']*'/,
"responsibility:'Vous restez entièrement responsable de vos décisions. Respectez la législation applicable et ne misez jamais plus que ce que vous pouvez vous permettre de perdre.'");

// Shorter EN translations
html=html.replace(/modalIntro:'<b>Sera Winner · AI-Supported Analysis<\/b> is an AI-assisted football match analysis tool\.'/,
"modalIntro:'<b>Sera Winner · AI-Supported Analysis</b> is an AI-assisted football analysis tool.'");
html=html.replace(/modalShows:'The application analyzes available data and displays, among other things:'/,"modalShows:'The application estimates:'");
html=html.replace(/modalP2:'the probability of at least <b>2 goals<\/b> in the match;'/,"modalP2:'the probability of <b>2+ goals</b>;'");
html=html.replace(/modalP3:'the probability of at least <b>3 goals<\/b>;'/,"modalP3:'the probability of <b>3+ goals</b>;'");
html=html.replace(/modalHalves:'the probability that the <b>1st half<\/b> has more goals than the 2nd half, or vice versa;'/,"modalHalves:'the <b>1st-half vs 2nd-half</b> goal trend;'");
html=html.replace(/modalScore:'a <b>predicted score<\/b>, its estimated confidence, data quality and overall analysis confidence\.'/,"modalScore:'a <b>predicted score</b> and confidence levels.'");
html=html.replace(/disclaimer:'<b>Important warning:<\/b>[^']*'/,
"disclaimer:'<b>Warning:</b> probabilities and predictions are estimates, never guarantees. Sera Winner accepts no responsibility for bets, losses or decisions made from these analyses.'");
html=html.replace(/responsibility:'If you use these analyses for betting,[^']*'/,
"responsibility:'You remain fully responsible for your decisions. Follow applicable laws and never stake more than you can afford to lose.'");

// Shorter ES translations
html=html.replace(/modalIntro:'<b>Sera Winner · AI-Supported Analysis<\/b> es una herramienta de análisis de partidos de fútbol asistida por inteligencia artificial\.'/,
"modalIntro:'<b>Sera Winner · AI-Supported Analysis</b> es una herramienta de análisis de fútbol asistida por IA.'");
html=html.replace(/modalShows:'La aplicación analiza los datos disponibles y muestra, entre otros elementos:'/,"modalShows:'La aplicación estima:'");
html=html.replace(/modalP2:'la probabilidad de que haya al menos <b>2 goles<\/b> en el partido;'/,"modalP2:'la probabilidad de <b>2+ goles</b>;'");
html=html.replace(/modalP3:'la probabilidad de que haya al menos <b>3 goles<\/b>;'/,"modalP3:'la probabilidad de <b>3+ goles</b>;'");
html=html.replace(/modalHalves:'la probabilidad de que la <b>1\.ª parte<\/b> tenga más goles que la 2\.ª, o viceversa;'/,"modalHalves:'la tendencia de goles de la <b>1.ª parte vs 2.ª parte</b>;'");
html=html.replace(/modalScore:'un <b>marcador probable<\/b>, su confianza estimada, la calidad de los datos y la confianza global del análisis\.'/,"modalScore:'un <b>marcador probable</b> y niveles de confianza.'");
html=html.replace(/disclaimer:'<b>Advertencia importante:<\/b>[^']*'/,
"disclaimer:'<b>Advertencia:</b> las probabilidades y pronósticos son estimaciones, nunca garantías. Sera Winner no asume responsabilidad por apuestas, pérdidas o decisiones basadas en estos análisis.'");
html=html.replace(/responsibility:'Si utiliza estos análisis para apostar,[^']*'/,
"responsibility:'Usted sigue siendo totalmente responsable de sus decisiones. Respete la legislación aplicable y nunca apueste más de lo que pueda permitirse perder.'");

await fs.writeFile(file,html);
console.log('Compact professional welcome popup applied.');
