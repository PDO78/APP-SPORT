/* Deuxième lecture contrastée : aucun caractère n'est remplacé ou déduit. */
(function(){
'use strict';
window.SportImagePrep={crop:async(source,region)=>{const image=new Image();image.src=source;await image.decode();const canvas=document.createElement('canvas'),scale=Math.min(4,Math.max(1,120/region.height));canvas.width=Math.round(region.width*scale);canvas.height=Math.round(region.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,region.x,region.y,region.width,region.height,0,0,canvas.width,canvas.height);return {src:canvas.toDataURL('image/png'),width:image.naturalWidth,height:image.naturalHeight};},size:async source=>{const image=new Image();image.src=source;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};},binary:async source=>{
 const image=new Image();image.src=source;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height),histogram=new Uint32Array(256);
 for(let i=0;i<pixels.data.length;i+=4){const gray=Math.round(.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2]);pixels.data[i]=gray;histogram[gray]++;}
 const total=canvas.width*canvas.height;let sum=0;for(let i=0;i<256;i++)sum+=i*histogram[i];let weight=0,partial=0,best=-1,threshold=127;
 for(let i=0;i<255;i++){weight+=histogram[i];if(!weight)continue;const remaining=total-weight;if(!remaining)break;partial+=i*histogram[i];const delta=partial/weight-(sum-partial)/remaining,variance=weight*remaining*delta*delta;if(variance>best){best=variance;threshold=i;}}
 let dark=0;for(let i=0;i<=threshold;i++)dark+=histogram[i];const invert=dark>total/2;
 for(let i=0;i<pixels.data.length;i+=4){let value=pixels.data[i]>threshold?255:0;if(invert)value=255-value;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}
 context.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
}};
})();
