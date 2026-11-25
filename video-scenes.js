/* Sélection d'écrans stables et distincts ; ne déduit aucune donnée sportive. */
(function(root){
'use strict';
const WIDTH=96,HEIGHT=64;
function fingerprint(rgba,width=WIDTH,height=HEIGHT){const pixels=new Float32Array(width*height);let mean=0;for(let i=0;i<pixels.length;i++){const v=.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2];pixels[i]=v;mean+=v;}mean/=pixels.length;for(let i=0;i<pixels.length;i++)pixels[i]-=mean;return {pixels,width,height};}
function distance(a,b){if(a.width!==b.width||a.height!==b.height)return Infinity;const {width:w,height:h}=a;let best=Infinity;
 // Le petit recalage limite les faux changements dus aux tremblements du téléphone.
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){let sum=0,count=0;const bins=new Uint32Array(511);for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const d=Math.min(510,Math.round(Math.abs(a.pixels[y*w+x]-b.pixels[(y+dy)*w+x+dx])));bins[d]++;count++;}let remaining=Math.ceil(count*.2);for(let i=510;i>=0&&remaining;i--){const used=Math.min(remaining,bins[i]);sum+=used*i;remaining-=used;}best=Math.min(best,sum/Math.ceil(count*.2));}return best;
}
function sharpness(fp){const {pixels:p,width:w,height:h}=fp;let sum=0;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,v=4*p[i]-p[i-1]-p[i+1]-p[i-w]-p[i+w];sum+=v*v;}return sum/((w-2)*(h-2));}
// Si les mouvements empêchent toute scène stable, garder aussi la couverture temporelle.
// La première image protège les écrans qui disparaissent dès le début de la vidéo.
class Collector{
 constructor({limit=12,threshold=11,minSamples=2,fallbackWindow=0}={}){this.limit=limit;this.threshold=threshold;this.minSamples=minSamples;this.current=null;this.frames=[];this.overflow=false;this.best=null;this.first=null;this.fallbackWindow=fallbackWindow;this.temporal=new Map();}
 push({fingerprint:fp,time,score=sharpness(fp),capture}){const sample={fingerprint:fp,time,score};if(!this.first)this.first={...sample,src:capture()};if(this.fallbackWindow>0){const slot=Math.min(Math.max(0,this.limit-2),Math.floor(time/this.fallbackWindow)),previous=this.temporal.get(slot);if(!previous||score>previous.score)this.temporal.set(slot,{...sample,src:capture()});}if(!this.best||score>this.best.score)this.best={...sample,src:capture()};
  if(this.current&&distance(this.current.fingerprint,fp)<=this.threshold){this.current.samples++;if(score>this.current.score)this.current={...sample,samples:this.current.samples,src:capture()};return;}
  this.flush();this.current={...sample,samples:1,src:capture()};
 }
 flush(){const c=this.current;if(!c||c.samples<this.minSamples)return;const duplicate=this.frames.find(f=>distance(f.fingerprint,c.fingerprint)<=this.threshold);if(duplicate){if(c.score>duplicate.score)Object.assign(duplicate,c);return;}if(this.frames.length>=this.limit){this.overflow=true;return;}this.frames.push({...c});}
 finish(){this.flush();this.current=null;const fallback=this.frames.length===0;if(fallback&&this.temporal.size)this.frames.push(this.first,...Array.from(this.temporal.values()).filter(f=>f.time!==this.first.time).slice(0,this.limit-1));else if(fallback&&this.best)this.frames.push(this.best);return {frames:this.frames.sort((a,b)=>a.time-b.time).map(({src,time})=>({src,time})),overflow:this.overflow,fallback};}
}
function sampleTimes(duration,maxSamples=360){if(!Number.isFinite(duration)||duration<=0||duration>600)throw Error('Choisis une vidéo du récapitulatif de moins de 10 minutes.');const step=Math.max(.4,duration/(maxSamples-1)),times=[];for(let time=0;time<duration-.05;time+=step)times.push(Number(time.toFixed(3)));const end=Math.max(0,duration-.05);if(!times.length||end-times[times.length-1]>.05)times.push(end);return times;}
root.SportScenes={fingerprint,distance,sharpness,Collector,sampleTimes,WIDTH,HEIGHT};if(typeof module!=='undefined')module.exports=root.SportScenes;
})(typeof window!=='undefined'?window:globalThis);
