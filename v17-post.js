/* Music & Beats V17 final integration shim. */

/* V17 fully owns Record Bass Arp now; stop the legacy V15 module from ever being injected. */
v15EnhanceRecordBass=function(){
  if(currentScreen==='record'&&session.layers?.length&&sessionLayer().source==='bass')v17EnhanceRecordArp();
};

/* Remove the Keys/Bass rack when Guitar is selected, and keep the correct faceplate when returning. */
const v17PostBaseInstallFxRack=v17InstallFxRack;
v17InstallFxRack=function(){
  const play=currentScreen==='play',source=play?playInstrument:(session.layers?.length?sessionLayer().source:null),host=play?$('#playScreen .instrument-panel'):$('#layerSourceTools .tool-box');
  if(!['chords','bass'].includes(source)){host?.querySelector('[data-v17-rack]')?.remove();return}
  return v17PostBaseInstallFxRack();
};

/* A Play instrument switch should never carry a stale Record arp target with it. */
document.querySelectorAll('#playScreen .instrument-tab').forEach(tab=>tab.addEventListener('click',()=>{
  if(v6Arp.target?.context==='record')v15HardStopArp();
  requestAnimationFrame(()=>{v17ApplyArpState(V17_PLAY_ARP);v17InstallFxRack();v17SyncPlayArpButtons()});
},true));

/* Re-run once after the deterministic patch chain finishes. */
requestAnimationFrame(()=>{v17Hardwareize();v17SyncPlayArpButtons()});