const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'vendor/ocr');fs.mkdirSync(out,{recursive:true});
const files={
 'tesseract.min.js':'tesseract.js/dist/tesseract.min.js',
 'worker.min.js':'tesseract.js/dist/worker.min.js',
 'tesseract-core-lstm.wasm.js':'tesseract.js-core/tesseract-core-lstm.wasm.js',
 'tesseract-core-simd-lstm.wasm.js':'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
 'eng.traineddata.gz':'@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
 'LICENSE-tesseract.txt':'tesseract.js/LICENSE.md',
 'LICENSE-core.txt':'tesseract.js-core/LICENSE',
 'README-data.md':'@tesseract.js-data/eng/README.md'
};const manifest={};for(const [name,source]of Object.entries(files)){const data=fs.readFileSync(path.join(root,'node_modules',source));fs.writeFileSync(path.join(out,name),data);manifest[name]=crypto.createHash('sha256').update(data).digest('hex');}fs.writeFileSync(path.join(out,'SHA256.json'),JSON.stringify(manifest,null,2)+'\n');
