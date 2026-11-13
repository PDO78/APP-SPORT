/* La référence File et le champ restent vivants tant que le lecteur utilise la vidéo. */
(function(){
'use strict';
const video=document.getElementById('video'),panel=document.getElementById('videoPanel'),capture=document.getElementById('capture'),status=document.getElementById('videoStatus');
const inputs=['videoFile','videoLibrary'].map(id=>document.getElementById(id));
let retainedFile=null,url=null,timer;
function report(text){status.textContent=text;}
function ready(){return Boolean(retainedFile&&!video.error&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0);}
function label(){return retainedFile?retainedFile.name+' ('+(retainedFile.size/1024/1024).toFixed(1)+' Mo)':'';}
function update(){capture.disabled=!ready()||Boolean(window.ocrBusy?.());}
function clear(){clearTimeout(timer);video.pause();video.removeAttribute('src');video.load();if(url)URL.revokeObjectURL(url);url=null;retainedFile=null;for(const input of inputs)input.value='';panel.hidden=true;report('');update();}
function select(event){
 if(window.ocrBusy?.())return;
 const file=event.target.files?.[0];if(!file)return; // Annuler le sélecteur préserve la vidéo précédente.
 if(file.size===0){report('Le téléphone a transmis un fichier vide. Enregistre la vidéo dans Photos/Galerie puis choisis-la avec « Choisir une vidéo ».');panel.hidden=false;return;}
 const oldURL=url;clearTimeout(timer);video.pause();
 retainedFile=file;url=URL.createObjectURL(file);
 // Ne pas vider event.target.value : certains navigateurs mobiles conservent le
 // média via le champ. Garder également File évite de perdre la référence au fichier.
 for(const input of inputs)if(input!==event.target)input.value='';
 panel.hidden=false;video.muted=true;video.playsInline=true;video.preload='auto';video.src=url;
 capture.disabled=true;report('Vidéo reçue : '+label()+'. Chargement du lecteur…');
 video.load();if(oldURL)URL.revokeObjectURL(oldURL);
 timer=setTimeout(()=>{if(!ready()&&retainedFile)report('Vidéo reçue : '+label()+'. Appuie sur Lecture dans le lecteur. Si aucun écran ne s’affiche, choisis la vidéo enregistrée dans Photos/Galerie ou prends des photos des récapitulatifs.');},12000);
}
video.addEventListener('loadedmetadata',()=>{if(!retainedFile)return;report('Vidéo reçue : '+label()+'. Appuie sur Lecture, puis mets en pause sur un écran net.');update();});
for(const event of ['loadeddata','canplay','seeked'])video.addEventListener(event,()=>{if(!retainedFile)return;update();if(ready()){clearTimeout(timer);report('Vidéo prête : '+label()+'. Mets en pause sur un écran net puis capture une image.');}});
video.addEventListener('error',()=>{if(!retainedFile||!video.error)return;clearTimeout(timer);update();const reason={1:'Chargement interrompu.',2:'Erreur de lecture du fichier.',3:'Le navigateur ne peut pas décoder cette vidéo.',4:'Le format ou le codec vidéo n’est pas pris en charge.'}[video.error.code]||'La vidéo est illisible.';report('Vidéo reçue : '+label()+'. '+reason+' Essaie une vidéo MP4/H.264 depuis Photos/Galerie, ou des photos JPEG/PNG.');});
for(const input of inputs)input.addEventListener('change',select);
window.SportVideo={clear,ready,update,hasFile:()=>retainedFile!==null};
update();
})();
