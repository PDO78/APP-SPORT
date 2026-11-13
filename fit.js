/* Encodeur indépendant d'un résumé FIT. Le SDK Garmin n'est utilisé que par les tests. */
(function(root){
'use strict';
const tcx=root.SportTCX||(typeof require==='function'?require('./tcx.js'):null);
const FIT_EPOCH_MS=631065600000;
function crc(bytes){let value=0;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value&1)?(value>>>1)^0xa001:value>>>1;}return value;}
function build(data){
 const validated=tcx.build(data); // Les mêmes contrôles et la même confirmation que le TCX.
 const seconds=Math.round(Number(data.minutes)*60),meters=Number(data.distance)*(data.unit==='km'?1000:1),calories=Math.round(Number(data.calories));
 const start=Math.round((new Date(data.start).getTime()-FIT_EPOCH_MS)/1000),end=start+seconds;
 if(start<0||end>=0xffffffff||calories>=0xffff||Math.round(meters*100)>=0xffffffff)throw Error('Date ou valeurs hors des limites du format FIT. Le TCX reste disponible.');
 const sport=data.eq==='tapis'?1:data.eq==='rameur'?15:4,subSport=data.eq==='tapis'?1:data.eq==='rameur'?14:15;
 const bytes=[];
 const put=(number,size)=>{for(let i=0;i<size;i++)bytes.push(Math.floor(number/2**(8*i))&255);};
 // [numéro de champ, taille, type FIT, valeur] ; aucun identifiant de capteur inventé.
 function message(local,global,fields){bytes.push(0x40|local,0,0);put(global,2);bytes.push(fields.length);for(const [id,size,type]of fields)bytes.push(id,size,type);bytes.push(local);for(const [,size,,value]of fields){if(!Number.isInteger(value)||value<0||value>=2**(8*size)-1)throw Error('Valeur invalide pour le format FIT.');put(value,size);}}
 const u8=(id,value)=>[id,1,0x02,value],en=(id,value)=>[id,1,0,value],u16=(id,value)=>[id,2,0x84,value],u32=(id,value)=>[id,4,0x86,value];
 message(0,0,[en(0,4),u16(1,255),u16(2,1),u32(4,start)]); // Activité créée par l'application, pas par une montre Garmin.
 message(1,21,[u32(253,start),en(0,0),en(1,0)]); // Début du chronomètre.
 // Un unique point final représente la distance totale connue. Pas de GPS, vitesse,
 // cadence ou FC instantanée reconstruite à partir d'une moyenne.
 message(2,20,[u32(253,end),u32(5,Math.round(meters*100))]);
 message(1,21,[u32(253,end),en(0,0),en(1,4)]);
 const common=[u32(253,end),u16(254,0),u32(2,start),u32(7,seconds*1000),u32(8,seconds*1000),u32(9,Math.round(meters*100)),u16(11,calories)];
 const hasHeart=data.heart!==''&&data.heart!==undefined;
 message(3,19,[...common,en(0,9),en(1,1),en(25,sport),en(39,subSport),...(hasHeart?[u8(15,Math.round(Number(data.heart)))]:[])]);
 message(4,18,[...common,en(0,8),en(1,1),en(5,sport),en(6,subSport),u16(25,0),u16(26,1),...(hasHeart?[u8(16,Math.round(Number(data.heart)))]:[])]);
 message(5,34,[u32(253,end),u32(0,seconds*1000),u16(1,1),en(2,0),en(3,26),en(4,1)]);
 const output=new Uint8Array(14+bytes.length+2),view=new DataView(output.buffer);output.set([14,0x20]);view.setUint16(2,21000,true);view.setUint32(4,bytes.length,true);output.set([46,70,73,84],8);view.setUint16(12,crc(output.subarray(0,12)),true);output.set(bytes,14);view.setUint16(output.length-2,crc(output.subarray(0,output.length-2)),true);
 return {bytes:output,filename:validated.filename.replace(/\.tcx$/,'.fit')};
}
root.SportFIT={build};if(typeof module!=='undefined')module.exports=root.SportFIT;
})(typeof window!=='undefined'?window:globalThis);
