// Vrai navigateur + vrai serveur Python/SQLite ; Garmin simulé, aucun compte réel.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const root=process.cwd(),folder=await fs.mkdtemp(path.join(os.tmpdir(),'sport-garmin-'));
const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
let browser,python;const key='test-only-service-key-not-for-production-123456';
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 // Port libre attribué par le noyau : le sous-processus publie son vrai port.
 const command="import socket,uvicorn; s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1],flush=True);uvicorn.run('fake_server:app',fd=s.fileno(),log_level='critical',access_log=False)";
 python=spawn(process.env.GARMIN_TEST_PYTHON||'python3',['-c',command],{cwd:path.join(root,'tests/garmin'),env:{...process.env,APP_SPORT_API_KEY:key,APP_SPORT_DB:path.join(folder,'test.sqlite3'),ALLOWED_ORIGINS:origin,GARMIN_EMAIL:'fake@example.invalid',GARMIN_PASSWORD:'test-only'}});
 let pythonErrors='';python.stderr.on('data',b=>pythonErrors+=b);
 const port=await new Promise((resolve,reject)=>{python.stdout.once('data',b=>resolve(Number(String(b).trim().split('\n')[0])));python.once('error',reject);python.once('exit',code=>reject(Error('Serveur Python arrêté : '+code+' '+pythonErrors)));});
 const backend='http://127.0.0.1:'+port;
 for(let i=0;i<100;i++){try{const r=await fetch(backend+'/__test/count');if(r.ok)break;}catch{}if(i===99)throw Error('Serveur indisponible : '+pythonErrors);await new Promise(resolve=>setTimeout(resolve,50));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Paris'}),page=await context.newPage(),errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url()===backend+'/v1/imports'&&r.method()==='POST')posts.push(r.postDataJSON());});
 await context.route('**/garmin-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.APP_SPORT_GARMIN_CONFIG={backendURL:'+JSON.stringify(backend)+'};'}));
 page.on('dialog',d=>d.accept());
 await page.goto(origin+'/#manual');
 await page.locator('#garminKey').fill('incorrect-key-with-at-least-32-characters');await page.locator('#garminConnect').click();await page.waitForFunction(()=>document.getElementById('garminStatus').textContent.includes('invalide'));
 assert(await page.locator('#garminSend').isDisabled());
 await page.locator('#garminKey').fill(key);await page.locator('#garminConnect').click();await page.waitForFunction(()=>!document.getElementById('garminDisconnect').hidden);
 assert.equal(await page.locator('#garminKey').inputValue(),'');
 const fill=async(eq,distance)=>{await page.evaluate(eq=>setEq(eq),eq);await page.locator('#start').fill('2026-11-25T09:00');await page.locator('#minutes').fill('15.35');await page.locator('#distance').fill(distance);await page.locator('#unit').selectOption('m');await page.locator('#calories').fill('126');};
 await fill('rameur','2312');await page.locator('#garminSend').click();assert.match(await page.locator('#garminStatus').textContent(),/coche/);assert.equal(posts.length,0);
 await page.locator('#reviewed').check();await page.locator('#garminSend').click();await page.waitForFunction(()=>document.getElementById('garminStatus').textContent.includes('importée et vérifiée'));
 assert.equal(posts.length,1);assert.equal(posts[0].confirmed,true);assert(!JSON.stringify(posts).includes(key));assert.equal(await page.locator('#garminActivity').getAttribute('href'),'https://connect.garmin.com/modern/activity/12345');
 // Un second clic avec les mêmes données ne crée pas une nouvelle activité.
 await page.locator('#garminSend').click();await page.waitForFunction(()=>document.getElementById('garminStatus').textContent.includes('importée et vérifiée'));
 assert.equal((await(await fetch(backend+'/__test/count')).json()).calls,1);
 await fill('tapis','1356');await page.locator('#reviewed').check();await page.locator('#garminSend').click();await page.waitForFunction(()=>document.getElementById('garminStatus').textContent.includes('importée et vérifiée'));
 assert.equal((await(await fetch(backend+'/__test/count')).json()).calls,2);
 // Le TCX reste téléchargeable après l'envoi direct.
 await page.locator('#exportFormat').selectOption('tcx');const pendingDownload=page.waitForEvent('download');await page.locator('button[onclick="downloadWorkout()"]').click();const download=await pendingDownload;const xml=await fs.readFile(await download.path(),'utf8');assert.match(xml,/<DistanceMeters>1356.0<\/DistanceMeters>/);
 // Réponse perdue APRÈS réception par le serveur : le suivi retrouve le même
 // import, sans renvoyer le fichier ni créer une deuxième activité.
 await context.route(backend+'/v1/imports',async route=>{await route.fetch();await route.abort('failed');},{times:1});
 await page.locator('#distance').fill('1400');await page.locator('#reviewed').check();await page.locator('#garminSend').click();await page.waitForFunction(()=>document.getElementById('garminStatus').textContent.includes('Envoi non confirmé'));
 assert(await page.locator('#garminSend').isDisabled());
 const afterLostResponse=(await(await fetch(backend+'/__test/count')).json()).calls;
 await page.locator('#garminCheck').click();await page.waitForFunction(()=>document.getElementById('garminStatus').textContent.includes('importée et vérifiée'));
 assert.equal((await(await fetch(backend+'/__test/count')).json()).calls,afterLostResponse);
 await page.locator('#distance').fill('9999');await page.locator('#reviewed').check();await page.locator('#garminSend').click();await page.waitForFunction(()=>document.getElementById('garminStatus').textContent.includes('Import non confirmé'));
 assert(await page.locator('#garminSend').isDisabled());assert(await page.locator('#garminCheck').isVisible());
 const storage=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));assert.equal(Object.keys(storage.local).length,0);assert(!JSON.stringify(storage).includes(key));assert(!JSON.stringify(storage).includes('fit_base64'));assert(storage.session['app-sport-garmin-pending']);
 const count=(await(await fetch(backend+'/__test/count')).json()).calls;
 await page.reload();await page.locator('#garminKey').fill(key);await page.locator('#garminConnect').click();await page.waitForFunction(()=>!document.getElementById('garminDisconnect').hidden);await page.locator('#garminCheck').click();await page.waitForFunction(()=>document.getElementById('garminStatus').textContent.includes('Import non confirmé'));assert.equal((await(await fetch(backend+'/__test/count')).json()).calls,count);
 await page.locator('#garminDisconnect').click();assert(await page.locator('#garminSend').isDisabled());
 await page.locator('#destination').selectOption('strava');assert(await page.locator('#garminService').isHidden());assert.match(await page.locator('#importLink').getAttribute('href'),/strava/);
 assert.deepEqual(errors,[]);
 console.log('PASS Garmin mobile : vrai FIT/API/SQLite, authentification, confirmation, rameur/tapis, déduplication, export TCX, interruption et suivi après rechargement. Garmin simulé.');
}finally{
 await browser?.close();if(python){const stopped=new Promise(resolve=>python.once('exit',resolve));python.kill();await stopped;}await new Promise(resolve=>server.close(resolve));await fs.rm(folder,{recursive:true,force:true});
}
