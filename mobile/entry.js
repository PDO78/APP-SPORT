import { Capacitor } from '@capacitor/core';
import { SecureStorage, KeychainAccess } from '@aparajita/capacitor-secure-storage';
import vaultModule from './secure-store.cjs';
async function initialize() {
  if (!Capacitor.isNativePlatform()) return;
  await SecureStorage.setKeyPrefix('app-sport_');
  await SecureStorage.setSynchronize(false);
  await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  const vault=vaultModule.createVault({storage:SecureStorage,isNative:()=>Capacitor.isNativePlatform()});
  await vault.purge();
  // Point d’intégration des futurs adaptateurs de connexion. Aucun identifiant demandé
  // tant que l’authentification du service et son import ne sont pas implémentés.
  window.AppSportVault=vault;
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) vault.purge().catch(()=>{delete window.AppSportVault;});});
}
initialize().catch(()=>{delete window.AppSportVault; const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Stockage sécurisé indisponible. Les connexions sont désactivées ; la saisie et l’OCR restent disponibles.';document.querySelector('main').prepend(p);});
