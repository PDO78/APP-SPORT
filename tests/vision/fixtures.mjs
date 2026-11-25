// Données SIMULÉES pour le protocole, jamais envoyées comme consigne au modèle.
export const origin='https://pdo78.github.io';
export const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=';
export function reading(quantity,value,unit,aggregation='cumulative',extra={}){return {quantity,aggregation,value,unit,label:quantity,raw_text:value===null?'---':String(value),status:value===null?'absent':'readable',confidence:'high',source_image_ids:['img-1'],...extra};}
export function result(){return {schema_version:'1.0',equipment:'rowing',machine_state:'paused',readings:[reading('duration','15:21','mm:ss'),reading('distance','2312','m'),reading('energy','126','kcal'),reading('stroke_count','377','count'),reading('resistance','6','level','setting'),reading('heart_rate',null,'unknown','unknown'),reading('cadence','0','spm','instantaneous'),reading('power','0','W','instantaneous'),reading('pace','0:00','min/500m','instantaneous')],unclassified_readings:[],warnings:[]};}
export function response(data=result()){return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]};}
