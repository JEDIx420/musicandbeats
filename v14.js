/* Music & Beats V14 compatibility layer — explicit latch only.
   V18 retires the double-tap / double-click / double-press gesture in favour of
   dedicated global Smart Keys and Bass LATCH switches. */
const V14_DOUBLE_MS=360;
let v14Latch=null;
let v14LastPadTap=null;
let v14LastNumberTap=null;
const v14SuppressedPointers=new Set();

function v14SmartHostForPad(pad){return pad?.closest?.('#playChords,#recordChords')||null}
function v14PadContext(pad){
  const host=v14SmartHostForPad(pad);if(!host)return null;
  const id='#'+host.id,index=+pad.dataset.index,set=v6SmartSetFor(id),chord=set?.[index];if(!chord)return null;
  const c=v6SmartContext(id);return {host,id,index,pad,chord,...c};
}
function v14StopVoice(v,hard=false){try{hard&&typeof v?.hardStop==='function'?v.hardStop():v?.stop?.()}catch{}}
function v14ReleaseLatch(hard=false){
  if(!v14Latch)return;
  const old=v14Latch;v14Latch=null;
  old.pad?.classList.remove('v14-latched');old.pad?.removeAttribute('aria-pressed');
  if(old.arp){try{if(typeof v7HardStopArp==='function')v7HardStopArp();else v6StopArp?.(true)}catch{}}
  else old.voices?.forEach(v=>v14StopVoice(v,hard));
  v14PaintHints();
}
function v14LatchPad(pad){
  const c=v14PadContext(pad);if(!c)return false;
  v14ReleaseLatch(false);primeAudio();
  if(c.id==='#playChords'&&v6Arp?.enabled){
    v6StartArp({chord:c.chord,pad:c.pad,preset:c.preset,octave:c.octave,voicing:c.voicing});
    v14Latch={...c,arp:true,voices:[]};
  }else{
    const voices=v6StartSmartChord(c.chord,{voicing:c.voicing,octave:c.octave,preset:c.preset,velocity:.78});
    v14Latch={...c,arp:false,voices};
  }
  c.pad.classList.add('v14-latched');c.pad.setAttribute('aria-pressed','true');v14PaintHints();return true;
}
function v14PaintHints(){
  document.querySelectorAll('.v6-smart-toolbar small').forEach(el=>{
    if(el.dataset.v14Hint==='explicit')return;el.dataset.v14Hint='explicit';
    el.textContent='Tap or use 1–7 to play';
  });
}
function v14PadKey(pad){const host=v14SmartHostForPad(pad);return host?`${host.id}:${pad.dataset.index}`:''}

/* No automatic pointer/number double-tap listeners are installed anymore. */
const v14Observer=new MutationObserver(()=>{if(v14Latch?.pad&&!v14Latch.pad.isConnected)v14ReleaseLatch(true);v14PaintHints()});
['playChords','recordChords','layerSourceTools'].forEach(id=>{const el=document.getElementById(id);if(el)v14Observer.observe(el,{childList:true,subtree:true})});
if(typeof stopSession==='function'){const v14BaseStopSession=stopSession;stopSession=function(){v14ReleaseLatch(true);return v14BaseStopSession.apply(this,arguments)}}
if(typeof panic==='function'){const v14BasePanic=panic;panic=function(){v14ReleaseLatch(true);return v14BasePanic.apply(this,arguments)}}
window.addEventListener('blur',()=>v14ReleaseLatch(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)v14ReleaseLatch(true)});
document.addEventListener('click',e=>{if(e.target.closest('.back-home,#homeBtn,.instrument-tab,.v6-edit-smart,.v6-reset-smart'))v14ReleaseLatch(true)},true);
v14PaintHints();
