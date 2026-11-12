'use strict';
const $=id=>document.getElementById(id);let frames=[],videoURL,worker,busy=false;
window.updateExtra=function(){const previous={};$('extraFields').querySelectorAll('input').forEach(i=>previous[i.id]=i.value);$('extraFields').replaceChildren();for(const key of SportOCR.keys($('eq').value).slice(4)){const label=document.createElement('label');label.textContent=SportOCR.fields[key][0];const input=document.createElement('input');input.type='number';input.min='0';input.step='any';input.id=key;input.value=previous[key]||'';label.append(input);$('extraFields').append(label);}};
updateExtra();
function status(message){$('ocrStatus').textContent=message;}
function render(){const container=$('frames');container.replaceChildren();frames.forEach((f,i)=>{const label=document.createElement('label'),check=document.createElement('input'),img=document.createElement('img');check.type='checkbox';check.checked=f.selected;check.style.width='auto';check.onchange=()=>{f.selected=check.checked;};img.src=f.src;img.alt='Image '+(i+1)+' à analyser';img.style.width='100%';label.append(check,document.createTextNode(' Analyser l’image '+(i+1)),img);container.append(label);});$('analyze').disabled=busy||!frames.length;}
function add(source){if(frames.length>=12)throw Error('Limite de 12 images atteinte. Efface les images pour recommencer.');const canvas=document.createElement('canvas'),ratio=Math.min(1,1600/source.width);canvas.width=Math.round(source.width*ratio);canvas.height=Math.round(source.height*ratio);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);frames.push({src:canvas.toDataURL('image/png'),selected:true});render();}
async function photos(event){if(busy)return;try{for(const file of event.target.files){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();add(img);}finally{URL.revokeObjectURL(url);}}status('Sélectionne les images à analyser.');}catch(e){status('Impossible de lire la photo. Utilise une image JPEG ou PNG. '+e.message);}event.target.value='';}
$('photo').onchange=photos;$('photos').onchange=photos;
function videoFile(event){if(busy)return;const file=event.target.files[0];if(!file)return;if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(file);$('video').src=videoURL;$('videoPanel').hidden=false;status('Mets la vidéo en pause sur un écran lisible et capture une image.');event.target.value='';}
$('videoFile').onchange=videoFile;$('videoLibrary').onchange=videoFile;
$('video').onerror=()=>status('Vidéo illisible sur ce navigateur. Essaie une vidéo MP4 compatible ou prends des photos.');
$('capture').onclick=()=>{if(busy)return;const v=$('video');v.pause();if(v.readyState<2||!v.videoWidth){status('Attends le chargement de la vidéo avant de capturer.');return;}try{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);add(c);status('Image capturée. Tu peux avancer vers un autre écran.');}catch(e){status(e.message);}};
$('clearFrames').onclick=()=>{if(busy)return;frames=[];render();$('video').removeAttribute('src');$('video').load();$('videoPanel').hidden=true;if(videoURL)URL.revokeObjectURL(videoURL);videoURL=null;$('ocrText').textContent='';status('Images effacées.');};
function loadEngine(){if(window.Tesseract)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('vendor/ocr/tesseract.min.js',document.baseURI).href;const timer=setTimeout(()=>{s.remove();reject(Error('Chargement trop long. Vérifie ta connexion puis réessaie.'));},20000);s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);s.remove();reject(Error('Téléchargement du moteur impossible. Vérifie ta connexion puis réessaie.'));};document.head.append(s);});}
let cancelled=false,abortAnalysis,generation=0;
function controls(active){
 for(const id of ['photo','photos','videoFile','videoLibrary','capture','clearFrames','eq','newSession'])$(id).disabled=active;
 $('cancelOCR').hidden=!active;
 $('frames').querySelectorAll('input').forEach(input=>input.disabled=active);
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
  const texts=[];
  for(let i=0;i<selected.length;i++){
   status('Analyse de l’image '+(i+1)+' / '+selected.length);
   const result=await Promise.race([worker.recognize(selected[i].src),interrupted]);
   if(cancelled)return;
   texts.push(result.data.confidence>=50?result.data.text:'');
  }
  const text=texts.join('\n');$('ocrText').textContent=text||'Aucun texte suffisamment fiable.';
  $('eq').value=equipment;updateExtra();
  const parsed=SportOCR.extract(text,equipment),messages=[];
  for(const [key,item]of Object.entries(parsed)){
   $(key).value=item.value===null?'':String(item.value);
   messages.push(SportOCR.fields[key][0]+' : '+item.status);
  }
  $('unit').value='km';$('reviewed').checked=false;
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
