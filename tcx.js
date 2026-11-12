(function(root){
'use strict';
function build(data){
 const required=['minutes','distance','calories'];
 if(!['tapis','rameur','elliptique'].includes(data.eq)||!['km','m'].includes(data.unit)||required.some(k=>data[k]===''||data[k]===undefined||!Number.isFinite(Number(data[k]))||Number(data[k])<0)||Number(data.minutes)<=0)throw Error('Renseigne la durée, la distance et les calories avec des valeurs connues.');
 const start=new Date(data.start),seconds=Math.round(Number(data.minutes)*60),distance=Number(data.distance)*(data.unit==='km'?1000:1),end=new Date(start.getTime()+seconds*1000);
 if(!data.start||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||!Number.isFinite(distance)||seconds<1||seconds>7*24*3600)throw Error('Vérifie la date de début et la durée de la séance.');
 const heart=data.heart===''||data.heart===undefined?null:Number(data.heart);
 if(heart!==null&&(!Number.isFinite(heart)||heart<20||heart>250))throw Error('Vérifie la fréquence cardiaque moyenne (20 à 250), ou laisse ce champ vide.');
 const escape=text=>String(text).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
 const notes=[data.eq];for(const [name,value]of Object.entries(data.extra||{})){if(value==='')continue;if(!Number.isFinite(Number(value))||Number(value)<0)throw Error('Vérifie les mesures propres à ton équipement.');notes.push(name+' : '+Number(value));}
 const iso=start.toISOString(),sport=data.eq==='tapis'?'Running':'Other';
 // Un résumé de séance, sans trace GPS ni échantillons inventés.
 const xml='<?xml version="1.0" encoding="UTF-8"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="'+sport+'"><Id>'+iso+'</Id><Lap StartTime="'+iso+'"><TotalTimeSeconds>'+seconds+'</TotalTimeSeconds><DistanceMeters>'+distance.toFixed(1)+'</DistanceMeters><Calories>'+Math.round(Number(data.calories))+'</Calories>'+(heart===null?'':'<AverageHeartRateBpm><Value>'+Math.round(heart)+'</Value></AverageHeartRateBpm>')+'<Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod></Lap><Notes>'+escape(notes.join(' ; '))+'</Notes></Activity></Activities></TrainingCenterDatabase>';
 return {xml,filename:'seance_'+data.eq+'_'+iso.replace(/[:.]/g,'-')+'.tcx'};
}
root.SportTCX={build};if(typeof module!=='undefined')module.exports=root.SportTCX;
})(typeof window!=='undefined'?window:globalThis);
