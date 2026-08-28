/* Music & Beats V36 — latch performance, metronome monitor, and legacy UI lockout. */
(()=>{
const V=window.MB_V35,api=window.MB_V34_LOOPER;if(!V||!api||window.MB_V36)return;
const {state,tracks,extra}=V,holds=new Map();let lastAbs=0,wasRunning=false,decorating=false;
function laneLatch(lane){return lane==='keys'?!!extra.latchKeys:lane==='bass'?!!extra.latchBass:false}
function holdId(lane,b){return lane==='keys'?`keys:${b.dataset.index??b.dataset.root}:${b.dataset.root||''}:${b.dataset.quality||''}`:`bass:${b.dataset.midi}`}
function resolvePad(lane,b){
  if(lane==='bass')return{midis:[+b.dataset.midi],preset:tracks.bass.sound};
  const root=b.dataset.root,quality=b.dataset.quality,base=noteMidi(root,3),preset=tracks.keys.sound;
  const midis=preset==='Tanpura Drone'?[base-12,base,base+7,base+12]:voiced(chordIntervals('triad',quality),'open').map(x=>base+x);
  return{midis,preset};
}
function captureMeta(lane,now){
  if(state.recordingLane===lane)return{lane,startTime:state.recordStartTime,startStep:state.recordStartStep,boundary:state.recordStartTime+V.totalSteps()*V.stepSeconds()};
  const g=state.captureGrace;if(g?.lane===lane&&now<=g.boundary)return{lane,startTime:g.startTime,startStep:g.startStep,boundary:g.boundary};
  return null;
}
function capture(h,endTime){
  if(h.captured||!h.meta)return;const sec=V.stepSeconds(),m=h.meta,end=Math.min(endTime,m.boundary),start=Math.max(h.startedAt,m.startTime);if(end<=m.startTime){h.captured=true;return}
  let a=Math.round((start-m.startTime)/sec),b=Math.round((end-m.startTime)/sec);a=Math.max(0,Math.min(V.totalSteps()-1,a));b=Math.max(a+1,Math.min(V.totalSteps(),b));
  tracks[h.lane].events.push({step:V.wrapStep(m.startStep+a),durationSteps:Math.max(1,b-a),midis:[...h.midis],preset:h.preset});h.captured=true;V.persist();
}
function stopHold(id,h,endTime=ctx?.currentTime||0){capture(h,endTime);h.voices?.forEach(v=>{try{v.stop()}catch{}});h.button?.classList.remove('v36-latched','active');holds.delete(id)}
function releaseLane(lane){for(const [id,h] of [...holds])if(h.lane===lane)stopHold(id,h)}
function releaseAll(){for(const [id,h] of [...holds])stopHold(id,h)}
function beginLatch(lane,b){
  primeAudio();if(!ctx)return;const id=holdId(lane,b),existing=holds.get(id);if(existing){stopHold(id,existing);decorate();return}
  const r=resolvePad(lane,b),now=ctx.currentTime,voices=r.midis.map((m,i)=>startVoice(m,r.preset,.78-Math.min(i*.04,.2))),h={id,lane,button:b,midis:r.midis,preset:r.preset,voices,startedAt:now,meta:captureMeta(lane,now),captured:false};holds.set(id,h);b.classList.add('v36-latched','active');
}
function padLane(b){if(b.closest('#v34ChordPads'))return'keys';if(b.closest('#v34BassPads'))return'bass';return null}
function intercept(e){const b=e.target.closest?.('.v34-performance-pad');if(!b)return;const lane=padLane(b);if(!lane||!laneLatch(lane))return;e.preventDefault();e.stopImmediatePropagation();if(e.type==='pointerdown')beginLatch(lane,b)}
['pointerdown','pointerup','pointercancel','lostpointercapture'].forEach(type=>document.addEventListener(type,intercept,true));
function toggleLatch(lane){const key=lane==='keys'?'latchKeys':'latchBass',next=!extra[key];extra[key]=next;if(!next)releaseLane(lane);V.persist();decorate()}
function decorate(){
  if(decorating)return;decorating=true;requestAnimationFrame(()=>{decorating=false;const lane=state.activeLane;if(!['keys','bass'].includes(lane))return;const grid=document.querySelector('#v34Workspace .v34-control-grid');if(!grid)return;let wrap=grid.querySelector('.v36-latch-control');if(!wrap){wrap=document.createElement('label');wrap.className='v36-latch-control';wrap.innerHTML='<span>Latch</span><button class="v36-latch-toggle" type="button"></button>';grid.insertBefore(wrap,grid.lastElementChild);wrap.querySelector('button').onclick=e=>{e.preventDefault();toggleLatch(state.activeLane)}}const on=laneLatch(lane),btn=wrap.querySelector('button');btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',String(on));btn.innerHTML=`<i></i><strong>${on?'On':'Off'}</strong>`;const hint=document.querySelector('#v34Workspace .v34-work-head small'),copy=on?'Latch is on — tap once to hold, tap the same pad again to release.':'Latch is off — pads play only while you hold them.';if(hint&&hint.textContent!==copy)hint.textContent=copy;document.querySelectorAll(lane==='keys'?'#v34ChordPads .v34-performance-pad':'#v34BassPads .v34-performance-pad').forEach(b=>b.classList.toggle('v36-latched',holds.has(holdId(lane,b))))})
}
function monitor(){
  if(ctx){for(const [id,h] of [...holds]){if(!h.meta&&state.recordingLane===h.lane)h.meta=captureMeta(h.lane,ctx.currentTime);if(h.meta&&!h.captured&&ctx.currentTime>=h.meta.boundary-.002){capture(h,h.meta.boundary);h.voices?.forEach(v=>{try{v.stop()}catch{}});h.button?.classList.remove('v36-latched','active');holds.delete(id)}}}
  if(!state.running){lastAbs=0;wasRunning=false;return}const abs=+state.absoluteStep||0;if(!wasRunning){lastAbs=0;wasRunning=true}if(abs<lastAbs)lastAbs=0;if(state.countInSteps>0){lastAbs=abs;return}if(abs>lastAbs&&ctx){const sec=V.stepSeconds(),next=state.nextStepTime;for(let n=lastAbs;n<abs;n++){const when=next-(abs-n)*sec,step=V.wrapStep(n);if(extra.metronome&&step%4===0)click(when,step%16===0)}lastAbs=abs}
}
setInterval(monitor,18);
function lockLegacy(){
  document.querySelector('#v7ProjectsDialog')?.remove();document.querySelector('#v35ProjectsBtn')?.remove();try{if(window.v6Arp){v6Arp.enabled=false;v6Arp.target=null}if(typeof v6StopArp==='function')v6StopArp('immediate')}catch{}
  try{window.v7OpenProject=()=>V.openProjects?.(false);window.v7ProjectDialog=()=>document.querySelector('#v35ProjectsDialog')}catch{}
  const legacy=document.querySelectorAll('#playScreen.active,#recordScreen.active,#recordSetupScreen.active');if(legacy.length)api.open();
}
document.addEventListener('click',e=>{if(e.target.closest?.('#homeBtn'))releaseAll();const t=e.target.closest?.('#v34Transport');if(t&&state.running)releaseAll()},true);
window.addEventListener('pagehide',releaseAll);window.addEventListener('blur',()=>{if(!state.running)releaseAll()});window.addEventListener('musicandbeats:v35change',decorate);
const observer=new MutationObserver(()=>{lockLegacy();decorate()});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
window.MB_V36={version:'v36',holds,releaseAll,releaseLane,decorate,toggleLatch};document.documentElement.classList.add('mb-v36');document.body.classList.add('mb-v36');lockLegacy();decorate();
})();