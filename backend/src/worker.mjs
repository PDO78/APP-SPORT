import contract from '../../vision-contract.js';
import {instructions} from './prompt.mjs';
import {accounts,authenticate,digest,issue,verify} from './auth.mjs';
import {HttpError,jsonBody,analysisInput} from './input.mjs';
export {VisionQuota} from './quota.mjs';
const originList=env=>(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
async function quota(env,body){const stub=env.VISION_QUOTA.get(env.VISION_QUOTA.idFromName('global'));const response=await stub.fetch('https://quota.internal/',{method:'POST',body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new HttpError(429,'quota','Limite atteinte. Réessaie plus tard.',result.retry_after||60);return stub;}
function outputText(response){if(response.status!=='completed'||response.error||response.incomplete_details)throw new HttpError(502,'incomplete','L’analyse n’a pas été terminée. Aucune valeur ne sera utilisée.');const parts=[];for(const item of response.output||[]){if(item.type==='message')for(const part of item.content||[]){if(part.type==='refusal')throw new HttpError(422,'refused','L’image n’a pas pu être interprétée.');if(part.type==='output_text')parts.push(part.text);}}if(parts.length!==1)throw new HttpError(502,'invalid_result','Résultat d’analyse invalide.');try{return JSON.parse(parts[0]);}catch{throw new HttpError(502,'invalid_result','Résultat d’analyse invalide.');}}
export default {async fetch(request,env){const requestId=crypto.randomUUID(),origin=request.headers.get('Origin'),allowed=originList(env).includes(origin),headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'});if(allowed){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','POST, GET, OPTIONS');headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');headers.set('Access-Control-Expose-Headers','Retry-After');}
 const send=(data,status=200,retry=0)=>{if(retry)headers.set('Retry-After',String(retry));return new Response(JSON.stringify({...data,request_id:requestId}),{status,headers});};
 try{
  const path=new URL(request.url).pathname;
  if(request.method==='OPTIONS'){if(!allowed)return send({error:{code:'origin',message:'Origine non autorisée.'}},403);return new Response(null,{status:204,headers});}
  if(request.method==='GET'&&path==='/health')return send({configured:Boolean(env.OPENAI_API_KEY&&env.SESSION_HMAC_KEY&&env.AUTH_USERS_JSON&&env.VISION_QUOTA&&originList(env).length),service:'app-sport-vision'});
  if(!allowed)throw new HttpError(403,'origin','Origine non autorisée.');
  if(request.method!=='POST'||!['/v1/session','/v1/analyze'].includes(path))throw new HttpError(404,'route','Route inconnue.');
  if(!env.SESSION_HMAC_KEY||!env.AUTH_USERS_JSON||!env.VISION_QUOTA||!env.OPENAI_API_KEY)throw new HttpError(503,'configuration','Le service d’analyse n’est pas encore configuré.');
  const users=accounts(env);
  if(path==='/v1/session'){
   const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
   // Avant toute dérivation de mot de passe : limiter aussi les requêtes mal formées.
   await quota(env,{op:'login',user:ip,ip});
   const body=await jsonBody(request,2048);if(!body||typeof body.username!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(body.username)||typeof body.password!=='string'||body.password.length<12||body.password.length>256||Object.keys(body).sort().join('|')!=='password|username')throw new HttpError(401,'credentials','Identifiant ou phrase secrète incorrect.');
   await quota(env,{op:'credential',user:await digest(body.username)});const user=await authenticate(users,body.username,body.password);if(!user)throw new HttpError(401,'credentials','Identifiant ou phrase secrète incorrect.');
   return send(await issue(env,user));
  }
  const auth=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('Authorization')||''),user=auth?await verify(env,auth[1],users):null;if(!user)throw new HttpError(401,'session','Connecte-toi au service d’analyse.');
  await quota(env,{op:'ingress',user:user.id});
  const body=analysisInput(await jsonBody(request,10*1024*1024));
  const stub=await quota(env,{op:'reserve',user:user.id,images:body.images.length,requestId});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),80000);const cancel=()=>controller.abort();request.signal.addEventListener('abort',cancel,{once:true});if(request.signal.aborted)cancel();
  try{
   const content=[{type:'input_text',text:'Équipement choisi (simple indication, ne prouve aucune mesure) : '+body.equipment_hint+'. Source : '+body.source_kind+'. Les images suivantes appartiennent à la même demande ; analyse-les ensemble.'}];for(const image of body.images){content.push({type:'input_text',text:'Image '+image.id+(image.timestamp_seconds===null?'':', instant dans la vidéo : '+image.timestamp_seconds+' s')});content.push({type:'input_image',image_url:image.data_url,detail:'high'});}
   const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1',instructions,input:[{role:'user',content}],text:{format:{type:'json_schema',name:'sport_screen_reading',strict:true,schema:contract.schema}},store:false,max_output_tokens:7000}),signal:controller.signal});
   if(!upstream.ok)throw new HttpError(upstream.status===429?503:502,'provider','Le service IA est indisponible. Réessaie plus tard.');
   // Réponse limitée aussi en lecture, sans journaliser les images ni les résultats.
   const reader=upstream.body?.getReader();if(!reader)throw new HttpError(502,'invalid_result','Résultat vide.');const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024){await reader.cancel();throw new HttpError(502,'invalid_result','Résultat trop volumineux.');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}let result;try{result=contract.validate(outputText(JSON.parse(new TextDecoder().decode(bytes))),body.images.map(i=>i.id));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(502,'invalid_result','Le résultat ne respecte pas le format attendu. Aucune valeur ne sera utilisée.');}
   return send({result});
  }finally{clearTimeout(timer);request.signal.removeEventListener('abort',cancel);await stub.fetch('https://quota.internal/',{method:'POST',body:JSON.stringify({op:'release',user:user.id,requestId})}).catch(()=>{});}
 }catch(error){if(error instanceof HttpError)return send({error:{code:error.code,message:error.message}},error.status,error.retry);if(error.name==='AbortError')return send({error:{code:'timeout',message:'Analyse interrompue ou trop longue. Aucune valeur ne sera utilisée.'}},504);return send({error:{code:'internal',message:'Service temporairement indisponible.'}},503);}
}};
