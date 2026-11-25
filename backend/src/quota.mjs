// Un Durable Object unique coordonne les quotas de tous les utilisateurs.
export class VisionQuota{
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){const {op,user,ip,images=0,requestId}=await request.json(),now=Date.now(),minute=Math.floor(now/60000),day=Math.floor(now/86400000),quarter=Math.floor(now/900000);const n=(key,defaultValue)=>{const v=Number(this.env[key]);return Number.isInteger(v)&&v>0?v:defaultValue;};
  const entries=op==='login'?[[`login-ip:${ip}:${quarter}`,n('LOGIN_IP_LIMIT',10),1,(quarter+1)*900000],[`login-global:${day}`,200,1,(day+1)*86400000]]:op==='credential'?[[`login-user:${user}:${quarter}`,5,1,(quarter+1)*900000]]:op==='ingress'?[[`ingress:${user}:${minute}`,20,1,(minute+1)*60000],[`ingress-day:${user}:${day}`,200,1,(day+1)*86400000]]:op==='reserve'?[[`minute:${user}:${minute}`,n('USER_MINUTE_LIMIT',3),1,(minute+1)*60000],[`day:${user}:${day}`,n('USER_DAILY_LIMIT',20),1,(day+1)*86400000],[`images:${user}:${day}`,n('USER_DAILY_IMAGES',60),images,(day+1)*86400000],[`global:${day}`,n('GLOBAL_DAILY_IMAGES',240),images,(day+1)*86400000]]:[];
  if(!['login','credential','ingress','reserve','release'].includes(op))return Response.json({allowed:false},{status:400});
  const result=await this.ctx.storage.transaction(async storage=>{
   const leaseKey='lease:'+user,leases=(await storage.get(leaseKey)||[]).filter(l=>l.expires>now);
   if(op==='release'){await storage.put(leaseKey,leases.filter(l=>l.id!==requestId));return {allowed:true};}
   if(op==='reserve'&&leases.length>=2)return {allowed:false,retry_after:30};
   const updates=[];for(const [key,limit,increment,end]of entries){const prior=await storage.get(key)||{count:0};if(prior.count+increment>limit)return {allowed:false,retry_after:Math.max(1,Math.ceil((end-now)/1000))};updates.push([key,{count:prior.count+increment,expires:end+86400000}]);}
   for(const [key,value]of updates)await storage.put(key,value);
   if(op==='reserve')await storage.put(leaseKey,[...leases,{id:requestId,expires:now+100000}]);
   return {allowed:true};
  });
  if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(now+86400000);
  return Response.json(result,{status:result.allowed?200:429});
 }
 async alarm(){
  const now=Date.now();let startAfter;
  for(;;){const values=await this.ctx.storage.list({limit:128,...(startAfter?{startAfter}:{})});if(!values.size)break;startAfter=[...values.keys()].at(-1);
   for(const key of values.keys())await this.ctx.storage.transaction(async storage=>{
    // Relire sous transaction : une nouvelle réservation a pu arriver après list().
    const value=await storage.get(key);if(!value)return;
    if(key.startsWith('lease:')){const active=value.filter(l=>l.expires>now);if(active.length)await storage.put(key,active);else await storage.delete(key);}
    else if(value.expires<=now)await storage.delete(key);
   });
  }
  await this.ctx.storage.setAlarm(now+86400000);
 }
}
