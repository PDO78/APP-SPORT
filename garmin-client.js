/* Clé du service en mémoire uniquement. Aucune connexion Garmin dans le navigateur. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let key='',connected=false,busy=false,pending=null;
const storageKey='app-sport-garmin-pending';
function endpoint(){
 const value=window.APP_SPORT_GARMIN_CONFIG?.backendURL;
 if(!value)throw Error('Le service Garmin n’est pas encore configuré. L’import manuel reste disponible.');
 const url=new URL(value);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw Error('Adresse du service invalide : une origine HTTPS est requise.');
 return url.origin;
}
let configurationError='';try{endpoint();}catch(e){configurationError=e.message;}
function report(text){$('garminStatus').textContent=text;}
function remember(){try{if(pending)sessionStorage.setItem(storageKey,JSON.stringify(pending));else sessionStorage.removeItem(storageKey);}catch{/* Le serveur déduplique aussi les fichiers, même sans stockage navigateur. */}}
try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved&&saved.origin===endpoint()&&/^[0-9a-f-]{36}$/.test(saved.id))pending=saved;}catch{}
function update(){
 $('garminService').hidden=$('destination').value!=='garmin';
 $('garminSend').disabled=!connected||busy||Boolean(pending);
 $('garminCheck').hidden=!pending;$('garminCheck').disabled=!connected||busy;
 $('garminFinish').hidden=!pending;$('garminFinish').disabled=busy;
 $('garminConnect').disabled=busy||Boolean(configurationError);$('garminDisconnect').hidden=!connected;$('garminDisconnect').disabled=busy;
 $('garminConnection').hidden=connected;$('garminKey').disabled=busy||Boolean(configurationError);
 if($('destination').value==='garmin')$('autoImportStatus').textContent='L’envoi direct passe par ton service personnel ci-dessous. Ouvrir le site Garmin reste un import manuel.';
}
async function request(path,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
 try{
  const response=await fetch(endpoint()+path,{...options,headers:{Authorization:'Bearer '+key,...options.headers},credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
  let data;try{data=await response.json();}catch{throw Error('Réponse du service illisible.');}
  if(!response.ok){if(response.status===401){key='';connected=false;}const error=Error(typeof data.detail==='string'?data.detail:'Le service a refusé la demande.');error.status=response.status;throw error;}
  return data;
 }finally{clearTimeout(timer);}
}
function data(){
 const result={};for(const id of ['eq','start','minutes','distance','unit','calories','heart'])result[id]=$(id).value;
 result.totalStrokes=$('totalStrokes')?.value||'';result.extra={};
 $('extraFields').querySelectorAll('input').forEach(i=>result.extra[SportOCR.fields[i.id][0]]=i.value);
 return result;
}
function accept(result){
 if(!result||!['verified','pending','uncertain'].includes(result.status)||typeof result.request_id!=='string')throw Error('État de l’envoi non reconnu.');
 if(result.activity_id&&!/^\d+$/.test(String(result.activity_id)))throw Error('Identifiant Garmin non reconnu.');
 $('garminActivity').hidden=true;
 if(result.status==='verified'&&!result.activity_id)throw Error('Confirmation sans identifiant Garmin.');
 if(result.activity_id){$('garminActivity').href='https://connect.garmin.com/modern/activity/'+result.activity_id;$('garminActivity').hidden=false;}
 report(result.status==='verified'?'Séance importée et vérifiée dans Garmin. Consulte l’activité pour la contrôler.':result.status==='pending'?'Envoi en cours ou interrompu. Vérifie son état et ton compte Garmin avant toute autre tentative.':'Import non confirmé. Vérifie Garmin : le service ne renverra pas automatiquement cette séance.');
 if(result.status==='verified'){pending=null;remember();}
 else{pending={origin:endpoint(),id:result.request_id};remember();}
}
$('garminConnection').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;key=$('garminKey').value;$('garminKey').value='';update();
 try{const result=await request('/v1/status');if(result.mode!=='personal')throw Error('Ce service n’est pas une passerelle personnelle compatible.');connected=true;report(pending?'Service accessible. Un envoi reste à vérifier : utilise « Vérifier l’état ».':result.message);}
 catch(e){key='';connected=false;report(e.message);}finally{busy=false;update();}
});
$('garminDisconnect').onclick=()=>{key='';connected=false;report('Déconnecté du service. La clé a été effacée de la mémoire.');update();};
$('garminSend').onclick=async()=>{
 if(busy||!connected||pending)return;
 let workout,fit;
 try{
  if(window.ocrBusy?.()||window.SportVideo?.processing())throw Error('Attends la fin de l’analyse.');
  if(!$('reviewed').checked)throw Error('Vérifie les valeurs et coche la confirmation avant l’envoi.');
  workout=data();fit=SportFIT.build(workout);
  if(!confirm('Créer une nouvelle séance '+workout.eq+' dans le compte Garmin de ton service personnel ? Aucune activité existante ne sera remplacée. Si ta montre a déjà enregistré cette séance, cela créera un doublon.'))return;
 }catch(e){report(e.message);return;}
 busy=true;pending={origin:endpoint(),id:crypto.randomUUID()};remember();update();$('garminActivity').hidden=true;
 $('garminSnapshot').textContent='Dernier envoi : '+workout.eq+' — début '+workout.start.replace('T',' à ')+' — '+workout.minutes+' min — '+workout.distance+' '+workout.unit+' — '+workout.calories+' kcal.';
 report('Envoi de la séance vérifiée… Ne relance pas l’import pendant cette étape.');
 try{
  let binary='';for(const byte of fit.bytes)binary+=String.fromCharCode(byte);
  const result=await request('/v1/imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:pending.id,fit_base64:btoa(binary),confirmed:true})});accept(result);
 }catch(e){report('Envoi non confirmé : '+e.message+' Utilise « Vérifier l’état » avant toute autre tentative.');}
 finally{busy=false;update();}
};
$('garminCheck').onclick=async()=>{
 if(busy||!connected||!pending)return;busy=true;update();
 try{accept(await request('/v1/imports/'+pending.id));}
 catch(e){if(e.status===404){pending=null;remember();report('Le service ne trouve aucun envoi avec cette référence. Tu peux réessayer.');}else report('Vérification impossible : '+e.message);}
 finally{busy=false;update();}
};
$('garminFinish').onclick=()=>{if(busy||!confirm('As-tu vérifié directement dans Garmin ? Terminer le suivi ne supprime aucune activité et ne relance aucun envoi.'))return;pending=null;remember();report('Suivi terminé. Aucun nouvel envoi effectué.');update();};
$('destination').addEventListener('change',update);
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
if(configurationError)report(configurationError);
else if(pending)report('Un envoi reste à vérifier. Connecte-toi au service puis vérifie son état.');
else report('Connecte-toi avec la clé de ton service personnel. Elle sera effacée à la fermeture de la page.');
update();
})();
