/* Décodage du vrai fichier et extraction par l'application, sans appel IA. */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const file=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Indiquer le chemin de la vraie vidéo.');
await fs.access(file);
const root=process.cwd(),output=path.resolve('real-vision-results/extraction');
await fs.mkdir(output,{recursive:true,mode:0o700});
const server=http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://local').pathname);
  const target=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',target.endsWith('.js')?'application/javascript':target.endsWith('.html')?'text/html':'application/octet-stream');
  res.end(await fs.readFile(target));
 }catch{res.writeHead(404).end();}
});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/#automatic');
 // Extraction seule : aucun faux résultat IA, aucune requête fournisseur.
 await page.evaluate(()=>{window.SportMedia.analyze=async()=>false;});
 await page.locator('#videoLibrary').setInputFiles(file);
 await page.waitForFunction(()=>SportVideo.processing(),{},{timeout:20000});
 await page.waitForFunction(()=>!SportVideo.processing(),{},{timeout:200000});
 const images=await page.locator('#frames img').evaluateAll(items=>items.map(img=>({src:img.src,description:img.parentElement.textContent})));
 assert(images.length>0,await page.locator('#videoStatus').textContent());
 assert.deepEqual(errors,[]);
 for(let i=0;i<images.length;i++)await fs.writeFile(path.join(output,'frame-'+(i+1)+'.jpg'),Buffer.from(images[i].src.split(',')[1],'base64'),{mode:0o600});
 const report={source:path.basename(file),sha256:crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),frames:images.map(({description},i)=>({file:'frame-'+(i+1)+'.jpg',description})),status:await page.locator('#videoStatus').textContent(),scope:'Décodage et extraction seulement. Reconnaissance OpenAI non exécutée.'};
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2),{mode:0o600});
 console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
