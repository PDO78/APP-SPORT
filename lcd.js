/* Lecture géométrique de segments, limitée à une disposition vérifiée par ses libellés.
 * Les nombres ne sont jamais des constantes du profil. Un motif incomplet est refusé.
 */
(function(root){
'use strict';
const profile={
 labels:{minutes:['TIME',[.575,.045,.675,.13]],distance:['METERS',[.80,.045,.955,.13]],totalStrokes:['STROKES',[.795,.375,.965,.46]],calories:['CALORIES',[.79,.69,.97,.775]],resistance:['LEVEL',[.045,.345,.16,.435]]},
 values:{minutes:[.54,.13,.755,.35],distance:[.78,.13,.995,.35],totalStrokes:[.79,.45,.995,.675],resistance:[.08,.43,.18,.66],calories:[.84,.775,.995,.985]}
};
const patterns={'1111110':'0','0110000':'1','1101101':'2','1111001':'3','0110011':'4','1011011':'5','1011111':'6','1110000':'7','1111111':'8','1111011':'9'};
function findScreen(rgba,width,height){
 const mask=new Uint8Array(width*height),queue=new Int32Array(width*height);for(let i=0;i<mask.length;i++){const r=rgba[i*4],g=rgba[i*4+1],b=rgba[i*4+2];mask[i]=b>95&&b-r>50&&b-g>35?1:0;}
 let best=null;
 for(let i=0;i<mask.length;i++){
  if(!mask[i])continue;let head=0,tail=1,minX=width,minY=height,maxX=0,maxY=0;queue[0]=i;mask[i]=0;
  while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const next of [x>0?p-1:-1,x<width-1?p+1:-1,y>0?p-width:-1,y<height-1?p+width:-1])if(next>=0&&mask[next]){mask[next]=0;queue[tail++]=next;}
  }
  const w=maxX-minX+1,h=maxY-minY+1,ratio=w/h,fill=tail/(w*h);
  if(tail>width*height*.025&&ratio>1.4&&ratio<3.2&&fill>.2&&w>70&&h>35&&(!best||tail>best.area))best={x:minX,y:minY,width:w,height:h,area:tail};
 }
 return best;
}
function foreground(rgba){const mask=new Uint8Array(rgba.length/4);for(let i=0;i<mask.length;i++){const r=rgba[i*4],g=rgba[i*4+1],b=rgba[i*4+2],high=Math.max(r,g,b),low=Math.min(r,g,b);mask[i]=high>100&&low>high*.55&&b>g*.8&&b>r*.8?1:0;}return mask;}
function runs(active){const result=[];let start=-1;for(let i=0;i<=active.length;i++){if(active[i]&&start<0)start=i;else if(!active[i]&&start>=0){result.push([start,i]);start=-1;}}return result;}
function attempt(mask,width,height,shear){
 const w=width+Math.ceil(height*shear)+1,out=new Uint8Array(w*height),counts=new Uint32Array(w);
 for(let y=0;y<height;y++){const shift=Math.round(y*shear);for(let x=0;x<width;x++)if(mask[y*width+x]){out[y*w+x+shift]=1;counts[x+shift]++;}}
 const columns=runs(Array.from(counts,v=>v>=Math.max(2,height*.08)));if(!columns.length||columns.length>10)return null;
 const glyphs=columns.map(([x0,x1])=>{let y0=height,y1=0;for(let y=0;y<height;y++)for(let x=x0;x<x1;x++)if(out[y*w+x]){y0=Math.min(y0,y);y1=Math.max(y1,y+1);}return {x0,x1,y0,y1};});
 const maxH=Math.max(...glyphs.map(g=>g.y1-g.y0));if(maxH<height*.6)return null;
 function density(g,l,t,r,b){const gw=g.x1-g.x0,gh=g.y1-g.y0;const x0=g.x0+Math.round(l*gw),x1=g.x0+Math.round(r*gw),y0=g.y0+Math.round(t*gh),y1=g.y0+Math.round(b*gh);let on=0,total=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){on+=out[y*w+x]||0;total++;}return total?on/total:0;}
 let text='';
 for(const g of glyphs){const gw=g.x1-g.x0,gh=g.y1-g.y0;
  if(gh<maxH*.65&&gw<maxH*.2){const rowCounts=[];for(let y=g.y0;y<g.y1;y++){let sum=0;for(let x=g.x0;x<g.x1;x++)sum+=out[y*w+x];rowCounts.push(sum>0);}const parts=runs(rowCounts);if(parts.length!==2||parts.some(([a,b])=>b-a<2))return null;text+=':';continue;}
  if(gh<maxH*.75)return null;
  if(gw/gh<.28){if(density(g,0,.15,1,.4)<.4||density(g,0,.6,1,.85)<.4)return null;text+='1';continue;}
  if(gw/gh>.8||gw/gh<.3)return null;
  const areas=[[.25,.02,.75,.15],[.68,.17,.98,.43],[.68,.58,.98,.83],[.20,.87,.75,.99],[.02,.58,.30,.83],[.02,.17,.30,.43],[.20,.43,.75,.58]];
  const bits=areas.map(a=>{const d=density(g,...a);return d>.4?'1':d<.25?'0':'?';}).join('');if(!patterns[bits])return null;text+=patterns[bits];
 }
 return text;
}
function cleanEdges(mask,width,height){const rows=[];for(let y=0;y<height;y++){let sum=0;for(let x=0;x<width;x++)sum+=mask[y*width+x];rows.push(sum>0);}const groups=runs(rows);if(groups.length<2)return;const first=groups[0],second=groups[1],last=groups[groups.length-1],before=groups[groups.length-2];if(first[0]<=1&&first[1]-first[0]<=height*.06&&second[0]-first[1]>=2)mask.fill(0,0,first[1]*width);if(last[1]>=height-1&&last[1]-last[0]<=height*.06&&last[0]-before[1]>=2)mask.fill(0,last[0]*width);}
function readDigits(rgba,width,height){const mask=foreground(rgba);cleanEdges(mask,width,height);const votes=new Map();for(const shear of [.05,.075,.1,.125]){const text=attempt(mask,width,height,shear);if(text!==null)votes.set(text,(votes.get(text)||0)+1);}if(votes.size!==1)return null;const [text,count]=[...votes][0];return count>=2?text:null;}
async function inspect(source){
 const image=new Image();image.src=source;await image.decode();const small=document.createElement('canvas');small.width=Math.min(480,image.naturalWidth);small.height=Math.round(image.naturalHeight*small.width/image.naturalWidth);const ctx=small.getContext('2d');ctx.drawImage(image,0,0,small.width,small.height);const found=findScreen(ctx.getImageData(0,0,small.width,small.height).data,small.width,small.height);if(!found)return null;
 const scale=image.naturalWidth/small.width,screen={x:found.x*scale,y:found.y*scale,width:found.width*scale,height:found.height*scale};
 function crop(rect,resize=1){const [l,t,r,b]=rect,c=document.createElement('canvas');const w=Math.round((r-l)*screen.width),h=Math.round((b-t)*screen.height);c.width=Math.round(w*resize);c.height=Math.round(h*resize);const context=c.getContext('2d');context.drawImage(image,Math.round(screen.x+l*screen.width),Math.round(screen.y+t*screen.height),w,h,0,0,c.width,c.height);return c;}
 return {screen,crop};
}
function labelImage(crop){
 const ctx=crop.getContext('2d'),data=ctx.getImageData(0,0,crop.width,crop.height).data;let x0=crop.width,y0=crop.height,x1=0,y1=0;
 for(let y=0;y<crop.height;y++)for(let x=0;x<crop.width;x++){const i=(y*crop.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(Math.min(r,g,b)>145&&Math.min(r,g,b)>Math.max(r,g,b)*.65){x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);}}
 if(x1<=x0||y1<=y0)return crop;
 const inset=Math.max(2,Math.round((y1-y0)*.08)),w=x1-x0-2*inset,h=y1-y0-2*inset;if(w<10||h<10)return crop;
 const out=document.createElement('canvas');out.width=w+24;out.height=h+24;const c=out.getContext('2d');c.fillStyle='white';c.fillRect(0,0,out.width,out.height);c.drawImage(crop,x0+inset,y0+inset,w,h,12,12,w,h);return out;
}
async function read(source,worker,check=()=>{}){
 const screen=await inspect(source);check();if(!screen)return null;
 const verified={},diagnostics=[];
 for(const [key,[expected,rect]]of Object.entries(profile.labels)){
  const crop=labelImage(screen.crop(rect,4));await worker.setParameters({tessedit_pageseg_mode:'7'});check();const result=await worker.recognize(crop.toDataURL('image/png'));check();const label=(result.data.text||'').toUpperCase().replace(/[^A-Z]/g,'');verified[key]=label===expected&&result.data.confidence>=65;diagnostics.push(expected+' : '+(result.data.text||'').trim());
 }
 if(!['minutes','distance','totalStrokes','calories'].every(key=>verified[key]))return {confirmed:false,diagnostics};
 const fields={};
 for(const [key,rect]of Object.entries(profile.values)){
  if(!verified[key])continue;const crop=screen.crop(rect),ctx=crop.getContext('2d'),raw=readDigits(ctx.getImageData(0,0,crop.width,crop.height).data,crop.width,crop.height);fields[key]=raw;diagnostics.push(key+' (segments) : '+(raw===null?'non reconnu':raw));
 }
 return {confirmed:true,fields,diagnostics};
}
root.SportLCD={findScreen,foreground,readDigits,read,profile};if(typeof module!=='undefined')module.exports=root.SportLCD;
})(typeof window!=='undefined'?window:globalThis);
