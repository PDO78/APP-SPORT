/* Un nombre sans libellé ou zone explicitement affectée n'est jamais attribué. */
(function(root){
'use strict';
const fields={minutes:['Durée','(?:duree|duration|time|temps)','time'],distance:['Distance','(?:distance|dist)','distance'],calories:['Calories','(?:calories|kcal|cal)','number'],heart:['Fréquence cardiaque','(?:fc|heart rate|pulse|bpm|pouls)','number'],strokes:['Cadence rameur (coups/min)','(?:spm|s/m|coups/min|stroke rate)','number'],pace:['Allure rameur (secondes/500 m)','(?:pace|allure|split|/\\s*500\\s*m)','timeSeconds'],power:['Puissance (W)','(?:watts|watt|power|puissance)','number'],rpm:['Cadence elliptique (tr/min)','(?:rpm|tr/min)','number'],resistance:['Résistance','(?:resistance|level|niveau)','number'],speed:['Vitesse (km/h)','(?:speed|vitesse)','speed'],incline:['Inclinaison (%)','(?:incline|inclinaison|pente)','number']};
function keys(eq){return ['minutes','distance','calories','heart',...(eq==='rameur'?['strokes','pace','power']:eq==='elliptique'?['rpm','resistance','power']:['speed','incline'])];}
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
 if(key==='minutes'&&value<=0)return null;
 return value;
}
function fromValues(values){const unique=[...new Set(values.filter(value=>value!==null))];return {value:unique.length===1?unique[0]:null,status:unique.length>1?'Valeurs contradictoires : à saisir manuellement.':unique.length===0?'Non reconnue : à saisir manuellement.':'Valeur reconnue : à vérifier.'};}
function assigned(text,key,unit){
 // La zone est affectée par l'utilisateur, mais plusieurs nombres restent ambigus.
 const suffix={minutes:'(?:min|minutes|s|sec)',distance:'(?:km|m|metres|meters)',heart:'(?:bpm)',power:'(?:w|watts?)',strokes:'(?:spm|s/m)',rpm:'(?:rpm|tr/min)',speed:'(?:km\\s*/\\s*h)',incline:'%',calories:'(?:kcal|cal)',pace:'(?:/\\s*500\\s*m|s)'}[key];
 const raw=normalize(text).trim().replace(/\s*\n\s*/g,' ');
 const match=raw.match(new RegExp('^('+token+')(?:\\s*('+(suffix||'(?!)')+'))?\\s*$'));
 if(match&&match[2]){const canonical=u=>normalize(u).replace(/metres|meters/,'m').replace(/minutes/,'min').replace(/sec$/,'s').replace(/\s/g,'');if(['distance','speed'].includes(key)&&canonical(match[2])!==canonical(unit))return fromValues([]);if(key==='minutes'&&!match[1].includes(':')&&canonical(match[2])!==canonical(unit))return fromValues([]);}
 return fromValues([match?parseValue(match[1],key,unit):null]);
}
function extract(text,eq){
 const result={},lines=normalize(text).split(/\r?\n/);
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
    values.push(parseValue(match[2],key,match[1]||match[3]||''));
   }
   // Certains écrans mettent le libellé après la valeur : « 24 spm », « 2:30.0 /500m ».
   if(['strokes','pace','power','rpm','heart'].includes(key)){
    const reverse=new RegExp('(?:^|\\s)('+token+')(?![\\d:.,])\\s*'+label+'(?=$|\\s)','g');
    for(const match of line.matchAll(reverse))values.push(parseValue(match[1],key,''));
   }
  }
  result[key]=fromValues(values);
 }
 return result;
}
root.SportOCR={fields,keys,extract,assigned,fromValues};if(typeof module!=='undefined')module.exports=root.SportOCR;
})(typeof window!=='undefined'?window:globalThis);
