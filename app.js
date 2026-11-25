'use strict';
const $=id=>document.getElementById(id);let frames=[],busy=false,videoProcessing=false,pendingVision=null;
window.updateExtra=function(){const previous={};$('extraFields').querySelectorAll('input').forEach(i=>previous[i.id]=i.value);$('extraFields').replaceChildren();for(const key of SportOCR.keys($('eq').value).slice(4)){const label=document.createElement('label');label.textContent=SportOCR.fields[key][0];const input=document.createElement('input');input.type='number';input.min='0';input.step=key==='totalStrokes'?'1':'any';input.id=key;input.value=previous[key]||'';label.append(input);$('extraFields').append(label);}};
updateExtra();
function status(message){$('ocrStatus').textContent=message;window.SportVideo?.ocrProgress?.(message);}
function render(){
 const container=$('frames');container.replaceChildren();
 frames.forEach((f,i)=>{
  const block=document.createElement('div'),label=document.createElement('label'),check=document.createElement('input'),img=document.createElement('img');
  check.type='checkbox';check.checked=f.selected;check.style.width='auto';check.onchange=()=>{f.selected=check.checked;invalidateVision();};
  img.src=f.src;img.alt='Image '+(i+1)+' à analyser';img.style.width='100%';
  const title=f.field?'Zone : '+SportOCR.fields[f.field][0]+' '+(f.unit||''):'Image '+(i+1)+(Number.isFinite(f.time)?' — '+Math.floor(f.time/60)+':'+String(Math.floor(f.time%60)).padStart(2,'0'):'');
  label.append(check,document.createTextNode(' Analyser '+title),img);block.append(label);
  const crop=document.createElement('button');crop.type='button';crop.textContent='Lire une zone';crop.disabled=busy;
  crop.onclick=async()=>{if(busy)return;try{await SportRegions.open(f.src,$('eq').value,region=>{if(busy)return;if(frames.length>=12){status('Limite de 12 images. Retire une image avant d’ajouter une zone.');return;}invalidateVision();f.selected=false;frames.push({...region,selected:true});render();status('Zone ajoutée. L’image complète est décochée pour éviter de mélanger ses valeurs avec les zones choisies.');});}catch(e){status('Recadrage impossible : '+e.message);}};
  const remove=document.createElement('button');remove.type='button';remove.textContent='Retirer cette image';remove.disabled=busy;remove.onclick=()=>{if(busy)return;frames.splice(i,1);invalidateVision();render();};
  if(f.origin!=='video')block.append(crop);block.append(remove);container.append(block);
 });
 $('analyze').disabled=busy||videoProcessing||!frames.length;
}
function add(source){invalidateVision();if(frames.length>=12)throw Error('Limite de 12 images atteinte. Efface les images pour recommencer.');const canvas=document.createElement('canvas'),ratio=Math.min(1,1600/source.width);canvas.width=Math.round(source.width*ratio);canvas.height=Math.round(source.height*ratio);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);frames.push({src:canvas.toDataURL('image/png'),selected:true});render();}
async function photos(event){if(busy)return;try{for(const file of event.target.files){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();add(img);}finally{URL.revokeObjectURL(url);}}status('Sélectionne les images à analyser.');}catch(e){status('Impossible de lire la photo. Utilise une image JPEG ou PNG. '+e.message);}event.target.value='';}
$('photo').onchange=photos;$('photos').onchange=photos;
$('capture').onclick=()=>{if(busy)return;const v=$('video');v.pause();if(!window.SportVideo?.ready()){status('Attends le chargement de la vidéo avant de capturer.');return;}try{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);add(c);status('Image capturée. Tu peux avancer vers un autre écran.');}catch(e){status(e.message);}};
$('clearFrames').onclick=()=>{if(busy)return;frames=[];invalidateVision();render();window.SportVideo?.clear();$('ocrText').textContent='';status('Images effacées.');};
let analysisController=null,generation=0;
function controls(active){
 $('manual').querySelectorAll('input,select,button').forEach(input=>input.disabled=active);
 for(const id of ['photo','photos','videoFile','videoLibrary','capture','clearFrames','eq','newSession','autoVideo','visionUsername','visionPassword','visionLoginButton'])$(id).disabled=active;
 $('cancelOCR').hidden=!active;$('visionApply').disabled=active||!pendingVision;
 $('frames').querySelectorAll('input,button,select').forEach(input=>input.disabled=active);window.SportVideo?.update();
}
function invalidateVision(){pendingVision=null;$('visionReview').hidden=true;$('visionSources').replaceChildren();$('visionReadingList').replaceChildren();$('visionApply').disabled=true;$('ocrText').textContent='';}
function showVision(reply,equipment){
 pendingVision={...reply,equipment};$('visionReadingList').replaceChildren();
 const categories={instantaneous:'Instantanée',average:'Moyenne',cumulative:'Cumulée',setting:'Réglage',unknown:'Nature non identifiée'};
 const statuses={readable:'lisible',absent:'absente',unreadable:'illisible',conflicting:'contradictoire'},confidence={high:'élevée',medium:'moyenne',low:'faible'},units={unknown:'unité non identifiée',level:'niveau',count:'coups',spm:'coups/min',rpm:'tr/min'};
 const states={paused:'PAUSE',active:'EN COURS',stopped:'ARRÊT',unknown:'Non identifié'};
 $('visionMachineState').textContent='État affiché : '+states[reply.result.machine_state];
 for(const r of reply.result.readings){const item=document.createElement('p'),title=document.createElement('strong');title.textContent=SportVisionContract.labels[r.quantity]+' — '+categories[r.aggregation]+' : ';const value=r.value===null?'Non renseigné':r.value+' '+(units[r.unit]||r.unit);item.append(title,document.createTextNode(value+' · '+statuses[r.status]+' · confiance '+confidence[r.confidence]+' · libellé : '+(r.label||'non identifié')+' · source(s) : '+r.source_image_ids.join(', ')));$('visionReadingList').append(item);}
 for(const r of reply.result.unclassified_readings){const item=document.createElement('p');item.textContent='Valeur non attribuée : '+(r.value??'Non renseigné')+' · libellé : '+(r.label||'non identifié')+' · unité : '+(r.unit||'non identifiée')+' · '+r.reason;$('visionReadingList').append(item);}
 for(const warning of reply.result.warnings){const item=document.createElement('p');item.textContent=warning;$('visionReadingList').append(item);}
 $('visionSources').replaceChildren();for(const image of reply.images){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=image.data_url;img.alt='Image transmise '+image.id;img.style.width='100%';caption.textContent=image.id+(image.timestamp_seconds===null?'':' — '+image.timestamp_seconds+' s dans la vidéo');figure.append(img,caption);$('visionSources').append(figure);}
 $('ocrText').textContent=JSON.stringify(reply.result,null,2);$('visionReview').hidden=false;$('visionApply').disabled=false;$('visionReview').scrollIntoView({block:'start',behavior:'smooth'});
}
$('cancelOCR').onclick=()=>{analysisController?.abort();status('Annulation de l’analyse IA…');};
window.addEventListener('vision-logout',()=>{analysisController?.abort();invalidateVision();});
$('analyze').onclick=async()=>{
 const selected=frames.filter(f=>f.selected);if(busy||videoProcessing)return false;
 if(!selected.length){status('Sélectionne au moins une image.');return false;}
 busy=true;const id=++generation;analysisController=new AbortController();const signal=analysisController.signal;invalidateVision();$('minutes').dispatchEvent(new Event('input',{bubbles:true}));$('reviewed').checked=false;render();controls(true);const equipment=$('eq').value;
 const timer=setTimeout(()=>analysisController?.abort(),110000);
 try{
  status('Analyse IA des '+selected.length+' image(s) ensemble…');
  const reply=await SportVisionClient.analyze(selected,equipment,signal);if(signal.aborted||id!==generation)return false;
  showVision(reply,equipment);status('Résultats IA affichés. Aucun calcul ni remplacement du formulaire n’a été effectué. Vérifie-les puis utilise le bouton de reprise.');return true;
 }catch(e){status(signal.aborted?'Analyse IA annulée ou trop longue. Le formulaire est conservé.':'Analyse IA impossible : '+e.message);return false;}
 finally{clearTimeout(timer);analysisController=null;busy=false;render();controls(false);}
};
$('visionApply').onclick=()=>{
 if(!pendingVision||busy||videoProcessing)return;const {result,equipment}=pendingVision;if(result.equipment!==({rameur:'rowing',tapis:'treadmill',elliptique:'elliptical'}[equipment])){status('Équipement non confirmé par la lecture. Utilise la saisie manuelle.');return;}
 const mapped=SportVisionResults.formValues(result,equipment);$('eq').value=equipment;updateExtra();
 for(const key of SportOCR.keys(equipment))if($(key))$(key).value=mapped.values[key]===undefined?'':String(mapped.values[key]);
 $('unit').value=mapped.values.unit||'km';$('minutes').dispatchEvent(new Event('input',{bubbles:true}));$('reviewed').checked=false;
 $('recognition').textContent=['Valeurs reprises après vérification du résultat IA. Les valeurs absentes, incertaines et les mesures instantanées non pertinentes restent vides.',...mapped.warnings].join('\n');location.hash='manual';
};

window.clearSessionMedia=function(){if(busy||videoProcessing)return false;$('clearFrames').click();return true;};
window.ocrBusy=()=>busy||videoProcessing;
window.SportMedia={
 beginVideo(){if(busy||videoProcessing)throw Error('Un traitement est déjà en cours.');$('minutes').dispatchEvent(new Event('input',{bubbles:true}));$('reviewed').checked=false;videoProcessing=true;render();controls(true);$('cancelOCR').hidden=true;},
 setVideoFrames(items){if(busy)throw Error('Une analyse IA est en cours.');invalidateVision();frames=items.map(item=>({...item,selected:true,origin:'video'}));videoProcessing=false;render();controls(false);},
 endVideo(){videoProcessing=false;render();controls(busy);},
 analyze:()=> $('analyze').onclick()
};
