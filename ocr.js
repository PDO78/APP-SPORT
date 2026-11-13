/* Un nombre sans libellé ou zone explicitement affectée n'est jamais attribué. */
(function(root){
'use strict';
const fields={minutes:['Durée','(?:duree|duration|time|temps)','time'],distance:['Distance','(?:distance|dist|meters|metres)','distance'],calories:['Calories','(?:calories|kcal|cal)','number'],heart:['Fréquence cardiaque moyenne','(?:fc moyenne|frequence cardiaque moyenne|avg\\.?\\s+(?:pulse|hr|heart rate)|average (?:pulse|heart rate)|(?:heart rate|pulse|fc)\\s+(?:avg|average|moyenne))','number'],strokes:['Cadence affichée (coups/min)','(?:spm|s/m|coups/min|stroke rate)','number'],pace:['Allure rameur (secondes/500 m)','(?:pace|allure|split|/\\s*500\\s*m)','timeSeconds'],totalStrokes:['Nombre total de coups','(?:total strokes|strokes|coups totaux)','number'],power:['Puissance affichée (W)','(?:watts|watt|power|puissance)','number'],rpm:['Cadence elliptique (tr/min)','(?:rpm|tr/min)','number'],resistance:['Résistance','(?:resistance|level|niveau)','number'],speed:['Vitesse (km/h)','(?:speed|vitesse)','speed'],incline:['Inclinaison (%)','(?:incline|inclinaison|pente)','number']};
function keys(eq){return ['minutes','distance','calories','heart',...(eq==='rameur'?['totalStrokes','resistance','strokes','pace','power']:eq==='elliptique'?['rpm','resistance','power']:['speed','incline'])];}
const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const token='\\d+(?:[.,]\\d+)?(?::\\d{2}){0,2}(?:[.,]\\d+)?';
function parseValue(raw,key,unit){
 if(!fields[key])return null;
 const type=fields[key][2];raw=String(raw).trim();unit=normalize(unit||'').trim();
 if(!new RegExp('^'+token+'$').test(raw))return null;
 let value=Number(raw.replace(',','.'));
 if(type==='time'||type==='timeSeconds'){
  if(raw.includes(':')){const parts=raw.replace(',','.').split(':').map(Number);if(parts.slice(1).some(n=>n>=60)||parts.slice(0,-1).some(n=>!Number.isInteger(n)))return null;const seconds=parts.reduce((a,b)=>a*60+b,0);value=type==='time'?seconds/60:seconds;}
  else if(type==='time'){if(/^(min|minutes)$/.test(unit)){}else if(/^(s|sec|secondes)$/.test(unit))value/=60;else return null;}
  else if(unit!=='s')return null;
 }
 if(type==='distance'){if(unit==='km'){}else if(/^(m|metres|meters)$/.test(unit))value/=1000;else return null;}
 if(type==='speed'&&!/^km\s*\/\s*h$/.test(unit))return null;
 if(!Number.isFinite(value)||value<0)return null;
 if(key==='heart'&&(value<20||value>250))return null;
 if(['minutes','pace'].includes(key)&&value<=0)return null;if(key==='totalStrokes'&&!Number.isInteger(value))return null;
 return value;
}
function fromValues(values){const unique=[...new Set(values.filter(value=>value!==null))];return {value:unique.length===1?unique[0]:null,status:unique.length>1?'Valeurs contradictoires : à saisir manuellement.':unique.length===0?'Non reconnue : à saisir manuellement.':'Valeur reconnue : à vérifier.'};}
function assigned(text,key,unit){
 // La zone est affectée par l'utilisateur, mais plusieurs nombres restent ambigus.
 const suffix={minutes:'(?:min|minutes|s|sec)',distance:'(?:km|m|metres|meters)',heart:'(?:bpm)',power:'(?:w|watts?)',strokes:'(?:spm|s/m)',rpm:'(?:rpm|tr/min)',speed:'(?:km\\s*/\\s*h)',incline:'%',calories:'(?:kcal|cal)',totalStrokes:'(?:strokes|coups)',pace:'(?:/\\s*500\\s*m|s)'}[key];
 const raw=normalize(text).trim().replace(/\s*\n\s*/g,' ');
 const match=raw.match(new RegExp('^('+token+')(?:\\s*('+(suffix||'(?!)')+'))?\\s*$'));
 if(match&&match[2]){const canonical=u=>normalize(u).replace(/metres|meters/,'m').replace(/minutes/,'min').replace(/sec$/,'s').replace(/\s/g,'');if(['distance','speed'].includes(key)&&canonical(match[2])!==canonical(unit))return fromValues([]);if(key==='minutes'&&!match[1].includes(':')&&canonical(match[2])!==canonical(unit))return fromValues([]);}
 return fromValues([match?parseValue(match[1],key,unit):null]);
}
function extract(text,eq){
 const result={},lines=normalize(text).split(/\r?\n/),paused=isPaused(text);
 for(const key of keys(eq)){
  const [,label,type]=fields[key],values=[];
  const units=type==='distance'?'(?:km|m|metres|meters)':type==='speed'?'km\\s*/\\s*h':type==='time'?'(?:minutes|min|secondes|sec|s)':'(?!)';
  const beforeUnit='(?:\\s*[(\\[]\\s*('+units+')\\s*[)\\]])?';
  const labelOnly=new RegExp('^\\s*'+label+beforeUnit+'\\s*[:=]?\\s*$');
  for(let i=0;i<lines.length;i++){
   let line=lines[i];if(labelOnly.test(line)&&lines[i+1])line+=' '+lines[i+1];
   // Refuser les calories par heure et les maxima plutôt que les transformer en totaux/moyennes.
   if(key==='calories'&&/(?:k?cal|calories)\s*(?:\/|per)\s*h/.test(line))continue;
   if(key==='heart'&&/\bmax(?:imum)?\b/.test(line))continue;
   const pattern=new RegExp('(?:^|\\s)'+label+beforeUnit+'\\s*[:=]?\\s*('+token+')(?![\\d:.,])(?:\\s*('+units+')(?![a-z]))?','g');
   for(const match of line.matchAll(pattern)){
    // Ne pas prendre « 5 miles » pour 5 m ni une donnée sans unité pour des km.
    const suffix=line.slice(match.index+match[0].length);if((type==='distance'||type==='speed')&&/^\s*(?:miles|mph)\b/.test(suffix))continue;
    values.push(parseValue(match[2],key,match[1]||match[3]||(/^(?:meters|metres)\b/.test(match[0].trim())?'m':'')));
   }
   // Certains écrans mettent le libellé après la valeur : « 24 spm », « 2:30.0 /500m ».
   if(['strokes','pace','power','rpm','heart'].includes(key)){
    const reverse=new RegExp('(?:^|\\s)('+token+')(?![\\d:.,])\\s*'+label+'(?=$|\\s)','g');
    for(const match of line.matchAll(reverse))values.push(parseValue(match[1],key,''));
   }
  }
  result[key]=paused&&['strokes','power','pace'].includes(key)?pausedValue():fromValues(values);
 }
 return result;
}

function isPaused(text){return /\bpause(?:d)?\b/.test(normalize(text));}
function pausedValue(){return {value:null,status:'Écran en pause : valeur instantanée non retenue comme moyenne.'};}
function layout(data){
 if(!Array.isArray(data?.words))return {labels:[],wordList:[],consumed:new Set()};
 const wordList=data.words.filter(w=>w.bbox&&['x0','y0','x1','y1'].every(k=>Number.isFinite(w.bbox[k]))&&w.bbox.x1>w.bbox.x0&&w.bbox.y1>w.bbox.y0).map(w=>({...w,text:normalize(w.text).trim()}));
 const compact=text=>text.replace(/[^a-z0-9/]/g,'');
 const definitions={time:['minutes','clock'],'time/500m':['pace','clock'],spm:['strokes',''],pulse:[null,''],meters:['distance','m'],metres:['distance','m'],calories:['calories',''],kcal:['calories',''],strokes:['totalStrokes',''],level:['resistance',''],watts:['power',''],avgpulse:['heart',''],averageheartrate:['heart',''],fcmoyenne:['heart','']};
 const labels=[],consumed=new Set();
 for(let i=0;i<wordList.length;i++){
  if(consumed.has(i))continue;const first=wordList[i],parts=[first],indexes=[i];
  // Reconstituer uniquement les libellés voisins sur une même ligne, pas les chiffres.
  for(let n=1;n<=2;n++){const next=wordList[i+n];if(!next)break;const prev=parts[parts.length-1],h=first.bbox.y1-first.bbox.y0;
   if(Math.abs(next.bbox.y0-first.bbox.y0)>h*.6||next.bbox.x0-prev.bbox.x1>h*2||next.bbox.x0<prev.bbox.x1-h*.2)break;
   parts.push(next);indexes.push(i+n);
  }
  for(let count=parts.length;count>=1;count--){const name=compact(parts.slice(0,count).map(w=>w.text).join(''));
   if(!definitions[name]||parts.slice(0,count).some(w=>Number(w.confidence)<65||!Number.isFinite(Number(w.confidence))))continue;const [key,unit]=definitions[name];const last=parts[count-1];
   labels.push({key,unit,bbox:{x0:first.bbox.x0,y0:Math.min(...parts.slice(0,count).map(w=>w.bbox.y0)),x1:last.bbox.x1,y1:Math.max(...parts.slice(0,count).map(w=>w.bbox.y1))}});
   indexes.slice(0,count).forEach(index=>consumed.add(index));break;
  }
 }
 return {labels,wordList,consumed};
}
function extractSpatial(data,eq){
 const result=Object.fromEntries(keys(eq).map(key=>[key,fromValues([])]));
 const {labels,wordList,consumed}=layout(data);
 const paused=isPaused(data?.text||wordList.map(w=>w.text).join(' '));
 for(const label of labels){
  if(!label.key||!keys(eq).includes(label.key))continue;
  const b=label.bbox,h=b.y1-b.y0,cx=(b.x0+b.x1)/2;
  const peers=labels.filter(other=>other!==label&&Math.abs(other.bbox.y0-b.y0)<=Math.max(h,other.bbox.y1-other.bbox.y0)*.65);
  const centers=peers.map(other=>(other.bbox.x0+other.bbox.x1)/2);
  const left=Math.max(b.x0-h*4,...centers.filter(x=>x<cx).map(x=>(x+cx)/2));
  const right=Math.min(b.x1+h*4,...centers.filter(x=>x>cx).map(x=>(x+cx)/2));
  const nextLabelTop=Math.min(Infinity,...labels.filter(other=>other!==label&&other.bbox.y0>b.y1+h*.2&&other.bbox.x1>left&&other.bbox.x0<right).map(other=>other.bbox.y0));
  const candidates=[];
  for(let i=0;i<wordList.length;i++){
   const first=wordList[i],wb=first.bbox,center=(wb.x0+wb.x1)/2;
   if(consumed.has(i)||wb.y0<b.y1-h*.2||wb.y0>b.y1+h*4||wb.y0>=nextLabelTop-h*.15||center<left||center>right)continue;
   if(!/^[0-9:.,]+$/.test(first.text))continue;
   let raw=first.text,last=first,merged=0,reliable=Number(first.confidence)>=65;
   for(let n=1;n<=2;n++){const next=wordList[i+n];if(!next||consumed.has(i+n)||!/^[0-9:.,]+$/.test(next.text))break;
    const nb=next.bbox,gap=nb.x0-last.bbox.x1;
    if(gap<0||gap>(wb.y1-wb.y0)*.22||Math.abs(nb.y0-wb.y0)>(wb.y1-wb.y0)*.25||(nb.x0+nb.x1)/2>right)break;
    raw+=next.text;last=next;merged++;reliable=reliable&&Number(next.confidence)>=65;
   }
   i+=merged;const value=reliable?parseValue(raw,label.key,label.unit):null;if(value!==null)candidates.push(value);
  }
  const existing=result[label.key];
  if(existing.status.includes('contradictoires'))continue;
  const current=fromValues(candidates);
  result[label.key]=fromValues([...(existing.value===null?[]:[existing.value]),...candidates]);
  if(current.status.includes('contradictoires'))result[label.key]=current;
 }
 if(paused)for(const key of ['strokes','power','pace'])if(result[key])result[key]=pausedValue();
 return result;
}
function regions(data,eq,width,height){
 const {labels}=layout(data),result=[];
 for(const label of labels){if(!label.key||!keys(eq).includes(label.key))continue;
  const b=label.bbox,h=b.y1-b.y0,cx=(b.x0+b.x1)/2;
  const centers=labels.filter(other=>other!==label&&Math.abs(other.bbox.y0-b.y0)<=Math.max(h,other.bbox.y1-other.bbox.y0)*.65).map(other=>(other.bbox.x0+other.bbox.x1)/2);
  const left=Math.max(0,b.x0-h*2.5,...centers.filter(x=>x<cx).map(x=>(x+cx)/2));
  const right=Math.min(width,b.x1+h*2.5,...centers.filter(x=>x>cx).map(x=>(x+cx)/2));
  const next=Math.min(height,...labels.filter(other=>other!==label&&other.bbox.y0>b.y1+h*.2&&other.bbox.x1>left&&other.bbox.x0<right).map(other=>other.bbox.y0-h*.15));
  const top=b.y1+1,bottom=Math.min(height,b.y1+h*4,next);
  if(right-left>=8&&bottom-top>=8)result.push({key:label.key,unit:label.unit,x:left,y:top,width:right-left,height:bottom-top});
 }
 return result;
}
root.SportOCR={fields,keys,extract,extractSpatial,regions,isPaused,pausedValue,assigned,fromValues};if(typeof module!=='undefined')module.exports=root.SportOCR;
})(typeof window!=='undefined'?window:globalThis);
