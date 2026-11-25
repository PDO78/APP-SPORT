(function(root){
'use strict';
function numeric(raw){if(typeof raw!=='string')return null;let s=raw.trim();if(/^\d{1,3}(?:[ \u00a0]\d{3})+$/.test(s))s=s.replace(/[ \u00a0]/g,'');if(!/^\d+(?:[.,]\d+)?$/.test(s))return null;const n=Number(s.replace(',','.'));return Number.isFinite(n)&&n>=0?n:null;}
function seconds(value,unit){if(unit==='s')return numeric(value);if(unit==='min'){const n=numeric(value);return n===null?null:n*60;}const regex=unit==='mm:ss'?/^\d+:\d{2}(?:[.,]\d+)?$/:unit==='hh:mm:ss'?/^\d+:\d{2}:\d{2}(?:[.,]\d+)?$/:null;if(!regex||!regex.test(value))return null;const parts=value.replace(',','.').split(':').map(Number);if(parts.slice(1).some(n=>n>=60))return null;return parts.reduce((a,b)=>a*60+b,0);}
function formValues(result,equipment){const expected={rameur:'rowing',tapis:'treadmill',elliptique:'elliptical'}[equipment];if(result.equipment!==expected)return {values:{},warnings:['Le type d’équipement n’est pas confirmé : renseigne le formulaire manuellement.']};const values={},warnings=[],select=(quantity,aggregation,units,convert=numeric)=>{const all=result.readings.filter(r=>r.quantity===quantity&&aggregation.includes(r.aggregation));if(all.some(r=>r.status==='conflicting')){warnings.push('Valeurs contradictoires : '+SportVisionContract.labels[quantity]);return null;}const candidates=all.filter(r=>r.status==='readable'&&r.confidence==='high'&&r.label!==null&&units.includes(r.unit)&&(r.aggregation!=='average'||/\b(?:avg|average|mean|moy|moyenne)\b/i.test(r.label+' '+(r.raw_text||'')))).map(r=>({value:convert(r.value,r.unit),unit:r.unit})).filter(c=>c.value!==null);const distinct=new Set(candidates.map(c=>JSON.stringify(c)));if(distinct.size>1){warnings.push('Valeurs contradictoires : '+SportVisionContract.labels[quantity]);return null;}return candidates[0]||null;};
 const duration=select('duration',['cumulative'],['mm:ss','hh:mm:ss','s','min'],seconds);if(duration&&duration.value>0)values.minutes=duration.value/60;
 const distance=select('distance',['cumulative'],['m','km']);if(distance){values.distance=distance.value;values.unit=distance.unit;}
 const energy=select('energy',['cumulative'],['kcal']);if(energy)values.calories=energy.value;
 const total=select('stroke_count',['cumulative'],['count']);if(total&&Number.isInteger(total.value))values.totalStrokes=total.value;
 const level=select('resistance',['setting'],['level']);if(level)values.resistance=level.value;
 const heart=select('heart_rate',['average'],['bpm']);if(heart&&heart.value>=20&&heart.value<=250)values.heart=heart.value;
 const cadence=select('cadence',['average'],[equipment==='elliptique'?'rpm':'spm']);if(cadence)values[equipment==='elliptique'?'rpm':'strokes']=cadence.value;
 const power=select('power',['average'],['W']);if(power)values.power=power.value;
 const pace=select('pace',['average'],['min/500m','s/500m'],(raw,unit)=>unit==='min/500m'?seconds(raw,'mm:ss'):numeric(raw));if(pace&&pace.value>0)values.pace=pace.value;
 const speed=select('speed',['average'],['km/h']);if(speed)values.speed=speed.value;
 // Aucun choix arbitraire pour une pente instantanée ou variable.
 return {values,warnings};}
root.SportVisionResults={formValues,numeric,seconds};if(typeof module!=='undefined')module.exports=root.SportVisionResults;
})(typeof window!=='undefined'?window:globalThis);
