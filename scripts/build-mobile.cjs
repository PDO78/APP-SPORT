const fs=require('node:fs');const path=require('node:path');const esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist-mobile');fs.mkdirSync(out,{recursive:true});
for(const file of ['app.js','ocr.js','tcx.js','session.js','video.js','regions.js','fit.js','image-processing.js','lcd.js'])fs.copyFileSync(path.join(root,file),path.join(out,file));
fs.cpSync(path.join(root,'vendor'),path.join(out,'vendor'),{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('</body>','<script src="native.js"></script></body>');fs.writeFileSync(path.join(out,'index.html'),html);
esbuild.buildSync({entryPoints:[path.join(root,'mobile/entry.js')],bundle:true,outfile:path.join(out,'native.js'),platform:'browser',target:['safari15','chrome100']});
