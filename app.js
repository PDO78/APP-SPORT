'use strict';
const $=id=>document.getElementById(id);let frames=[],worker,busy=false;
window.updateExtra=function(){const previous={};$('extraFields').querySelectorAll('input').forEach(i=>previous[i.id]=i.value);$('extraFields').replaceChildren();for(const key of SportOCR.keys($('eq').value).slice(4)){const label=document.createElement('label');label.textContent=SportOCR.fields[key][0];const input=document.createElement('input');input.type='number';input.min='0';input.step='any';input.id=key;input.value=previous[key]||'';label.append(input);$('extraFields').append(label);}};
updateExtra();
function status(message){$('ocrStatus').textContent=message;}
function render(){
 const container=$('frames');container.replaceChildren();
 frames.forEach((f,i)=>{
  const block=document.createElement('div'),label=document.createElement('label'),check=document.createElement('input'),img=document.createElement('img');
  check.type='checkbox';check.checked=f.selected;check.style.width='auto';check.onchange=()=>{f.selected=check.checked;};
  img.src=f.src;img.alt='Image '+(i+1)+' à analyser';img.style.width='100%';
  const title=f.field?'Zone : '+SportOCR.fields[f.field][0]+' '+(f.unit||''):'Image '+(i+1);
  label.append(check,document.createTextNode(' Analyser '+title),img);block.append(label);
  const crop=document.createElement('button');crop.type='button';crop.textContent='Lire une zone';crop.disabled=busy;
  crop.onclick=async()=>{if(busy)return;try{await SportRegions.open(f.src,$('eq').value,region=>{if(busy)return;if(frames.length>=12){status('Limite de 12 images. Retire une image avant d’ajouter une zone.');return;}f.selected=false;frames.push({...region,selected:true});render();status('Zone ajoutée. L’image complète est décochée pour éviter de mélanger ses valeurs avec les zones choisies.');});}catch(e){status('Recadrage impossible : '+e.message);}};
  const remove=document.createElement('button');remove.type='button';remove.textContent='Retirer cette image';remove.disabled=busy;remove.onclick=()=>{if(busy)return;frames.splice(i,1);render();};
  block.append(crop,remove);container.append(block);
 });
 $('analyze').disabled=busy||!frames.length;
}
function add(source){if(frames.length>=12)throw Error('Limite de 12 images atteinte. Efface les images pour recommencer.');const canvas=document.createElement('canvas'),ratio=Math.min(1,1600/source.width);canvas.width=Math.round(source.width*ratio);canvas.height=Math.round(source.height*ratio);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);frames.push({src:canvas.toDataURL('image/png'),selected:true});render();}
async function photos(event){if(busy)return;try{for(const file of event.target.files){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();add(img);}finally{URL.revokeObjectURL(url);}}status('Sélectionne les images à analyser.');}catch(e){status('Impossible de lire la photo. Utilise une image JPEG ou PNG. '+e.message);}event.target.value='';}
$('photo').onchange=photos;$('photos').onchange=photos;
$('capture').onclick=()=>{if(busy)return;const v=$('video');v.pause();if(!window.SportVideo?.ready()){status('Attends le chargement de la vidéo avant de capturer.');return;}try{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);add(c);status('Image capturée. Tu peux avancer vers un autre écran.');}catch(e){status(e.message);}};
$('clearFrames').onclick=()=>{if(busy)return;frames=[];render();window.SportVideo?.clear();$('ocrText').textContent='';status('Images effacées.');};
function loadEngine(){if(window.Tesseract)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('vendor/ocr/tesseract.min.js',document.baseURI).href;const timer=setTimeout(()=>{s.remove();reject(Error('Chargement trop long. Vérifie ta connexion puis réessaie.'));},20000);s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);s.remove();reject(Error('Téléchargement du moteur impossible. Vérifie ta connexion puis réessaie.'));};document.head.append(s);});}
let cancelled=false,abortAnalysis,generation=0;
function controls(active){
 for(const id of ['photo','photos','videoFile','videoLibrary','capture','clearFrames','eq','newSession'])$(id).disabled=active;
 $('cancelOCR').hidden=!active;
 $('frames').querySelectorAll('input,button,select').forEach(input=>input.disabled=active);window.SportVideo?.update();
}
$('cancelOCR').onclick=async()=>{cancelled=true;abortAnalysis?.(Error('Analyse annulée.'));status('Annulation en cours…');if(worker)await worker.terminate().catch(()=>{});};
$('analyze').onclick=async()=>{
 const selected=frames.filter(f=>f.selected);if(busy)return;
 if(!selected.length){status('Sélectionne au moins une image.');return;}
 busy=true;cancelled=false;const currentGeneration=++generation;const interrupted=new Promise((_,reject)=>abortAnalysis=reject);render();controls(true);const equipment=$('eq').value;
 const timer=setTimeout(()=>{$('cancelOCR').click();status('Analyse trop longue. Annulation en cours ; essaie une seule photo plus nette.');},120000);
 try{
  await Promise.race([loadEngine(),interrupted]);if(cancelled)return;
  status('Chargement du moteur OCR…');
  worker=await Promise.race([Tesseract.createWorker('eng',1,{
   workerPath:new URL('vendor/ocr/worker.min.js',document.baseURI).href,
   corePath:new URL('vendor/ocr',document.baseURI).href,
   langPath:new URL('vendor/ocr',document.baseURI).href,
   workerBlobURL:false,errorHandler:()=>{},
   logger:m=>{if(!cancelled&&m.status==='recognizing text')status('Lecture en cours : '+Math.round(m.progress*100)+' %');}
  }).then(async value=>{if(cancelled||currentGeneration!==generation){await value.terminate();throw Error('Analyse annulée.');}return value;}),interrupted]);
  if(cancelled)return;
  const texts=[],values=Object.fromEntries(SportOCR.keys(equipment).map(key=>[key,[]]));
  for(let i=0;i<selected.length;i++){
   status('Analyse de l’image '+(i+1)+' / '+selected.length);
   const frame=selected[i];
   await Promise.race([worker.setParameters({tessedit_pageseg_mode:frame.field?'7':'3'}),interrupted]);
   const result=await Promise.race([worker.recognize(frame.src),interrupted]);
   if(cancelled)return;
   const text=result.data.text||'';
   texts.push((frame.field?'Zone '+SportOCR.fields[frame.field][0]+' : ':'Image '+(i+1)+' : ')+text);
   // Faible confiance : montrer le texte pour diagnostic, sans proposer de nombre.
   if(result.data.confidence<50)continue;
   if(frame.field){const item=SportOCR.assigned(text,frame.field,frame.unit);if(item.value!==null)values[frame.field].push(item.value);}
   else {const parsed=SportOCR.extract(text,equipment);for(const [key,item]of Object.entries(parsed)){if(item.value!==null)values[key].push(item.value);else if(item.status.includes('contradictoires'))values[key].push('conflict');}}
  }
  const text=texts.join('\n');$('ocrText').textContent=text||'Aucun texte suffisamment fiable.';
  $('eq').value=equipment;updateExtra();
  const parsed=Object.fromEntries(Object.entries(values).map(([key,list])=>[key,list.includes('conflict')?{value:null,status:'Valeurs contradictoires : à saisir manuellement.'}:SportOCR.fromValues(list)])),messages=[];
  for(const [key,item]of Object.entries(parsed)){
   $(key).value=item.value===null?'':String(item.value);
   messages.push(SportOCR.fields[key][0]+' : '+item.status);
  }
  $('unit').value='km';$('minutes').dispatchEvent(new Event('input',{bubbles:true}));$('reviewed').checked=false;
  $('recognition').textContent=messages.join('\n');$('recognition').style.whiteSpace='pre-line';
  status('Analyse terminée. Vérifie et corrige les valeurs dans le formulaire.');location.hash='manual';
 }catch(e){if(!cancelled)status('Analyse impossible. '+e.message+' La saisie manuelle reste disponible.');}
 finally{
  clearTimeout(timer);abortAnalysis=null;
  if(worker){await worker.terminate().catch(()=>{});worker=null;}
  busy=false;render();controls(false);
  if(cancelled)status('Analyse annulée. Les images et les valeurs précédentes sont conservées.');
 }
};

window.clearSessionMedia=function(){if(busy)return false;$('clearFrames').click();return true;};
window.ocrBusy=()=>busy;
