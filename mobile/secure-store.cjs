// Aucun repli vers localStorage : les secrets restent exclusivement natifs.
const TTL = 7 * 24 * 60 * 60 * 1000;
function createVault({storage, isNative, now = Date.now}) {
  const key = provider => { if (!['garmin','strava'].includes(provider)) throw Error('Destination inconnue.'); return 'connection.' + provider; };
  function guard() { if (!isNative()) throw Error('Le stockage sécurisé nécessite l’application iOS ou Android.'); }
  return {
    async save(provider, secret) { guard(); const k=key(provider); if (!secret || typeof secret !== 'object' || !Object.keys(secret).length) throw Error('Connexion vide.'); const created=now(); await storage.set(k, {secret,created,expires:created+TTL}, false); },
    async read(provider) { guard(); const k=key(provider),entry=await storage.get(k,false,false); if (entry === null) return null; const time=now(); if (!entry || !Number.isFinite(entry.created) || entry.expires!==entry.created+TTL || time<entry.created || time>=entry.expires || !entry.secret || typeof entry.secret!=='object') { await storage.remove(k,false); return null; } return entry.secret; },
    async forget(provider) { guard(); await storage.remove(key(provider),false); },
    async purge() { guard(); for(const provider of ['garmin','strava']) await this.read(provider); }
  };
}
module.exports={createVault,TTL};
