/* Music & Beats V26 — singleton Play FX rack + observer/layout performance hardening. */
let v26PlayRepairQueued=false;
let v26RackMutationQueued=false;

function v26PlayTone(){return document.querySelector('#playScreen #v24ToneFx')}
function v26PlayToneBody(){return v26PlayTone()?.querySelector('.v24-tone-body')||null}
function v26PlayRackShells(){return [...document.querySelectorAll('#playScreen .v19-rack-shell')]}
function v26PlayRacks(){return [...document.querySelectorAll('#playScreen .v17-fx-rack')]}
function v26RackShell(rack){return rack?.closest?.('.v19-rack-shell')||null}
function v26CurrentPlayRack(){
  const toneRack=v26PlayToneBody()?.querySelector('.v19-rack-shell > .v17-fx-rack,.v17-fx-rack');if(toneRack)return toneRack;
  const racks=v26PlayRacks();return racks.length?racks[racks.length-1]:null;
}
function v26RemoveDuplicatePlayRacks(keepRack=null){
  const keepShell=v26RackShell(keepRack);
  v26PlayRackShells().forEach(shell=>{if(shell!==keepShell)shell.remove()});
  v26PlayRacks().forEach(rack=>{if(rack!==keepRack&&!keepShell?.contains(rack))rack.remove()});
}
function v26CreatePlayRack(kind){
  const state=V17_PLAY_FX,holder=document.createElement('div');
  holder.innerHTML=v17FxMarkup(state,kind);
  const rack=holder.firstElementChild;if(!rack)return null;
  rack.dataset.kind=kind;
  const host=v26PlayToneBody()||document.querySelector('#playScreen .instrument-panel');
  if(!host)return null;
  host.appendChild(rack);v17BindFxRack(rack,state);return rack;
}
function v26RefreshPlayRackKind(rack,kind){
  if(!rack||rack.dataset.kind===kind)return rack;
  const holder=document.createElement('div');holder.innerHTML=v17FxMarkup(V17_PLAY_FX,kind);
  const fresh=holder.firstElementChild;if(!fresh)return rack;
  fresh.dataset.kind=kind;rack.replaceWith(fresh);v17BindFxRack(fresh,V17_PLAY_FX);return fresh;
}
function v26EnsurePlayRack(){
  if(currentScreen!=='play')return null;
  const source=playInstrument;
  if(!['chords','bass'].includes(source)){
    v26RemoveDuplicatePlayRacks(null);
    const tone=v26PlayTone(),body=v26PlayToneBody();
    if(tone&&body)tone.classList.toggle('v24-empty-module',!body.querySelector('.v9-expression-shell'));
    return null;
  }
  const kind=source==='bass'?'bass':'keys';
  let rack=v26CurrentPlayRack()||v26CreatePlayRack(kind);if(!rack)return null;
  rack=v26RefreshPlayRackKind(rack,kind);
  let shell=v26RackShell(rack);
  if(!shell&&typeof v19EnhanceRack==='function'){v19EnhanceRack(rack);shell=v26RackShell(rack)}
  const body=v26PlayToneBody();
  if(shell&&body&&shell.parentElement!==body)body.appendChild(shell);
  else if(!shell&&body&&rack.parentElement!==body)body.appendChild(rack);
  v26RemoveDuplicatePlayRacks(rack);
  if(shell&&typeof v19SyncRackShell==='function')v19SyncRackShell(shell);
  const tone=v26PlayTone();if(tone)tone.classList.remove('v24-empty-module');
  if(ctx)try{v17ApplyFx()}catch{}
  return rack;
}

/* Play owns one global FX rack. Record keeps the existing per-layer installer. */
if(typeof v17InstallFxRack==='function'){
  const v26RecordInstallFxRack=v17InstallFxRack;
  v17InstallFxRack=function(){
    if(currentScreen!=='play')return v26RecordInstallFxRack.apply(this,arguments);
    return v26EnsurePlayRack();
  };
}

/* Tone & FX no longer sweeps every rack shell out of the instrument panel. */
if(typeof v24EnsureToneModule==='function'){
  v24EnsureToneModule=function(workspace,instrument){
    let tone=document.querySelector('#v24ToneFx');
    if(!tone){
      tone=document.createElement('section');tone.id='v24ToneFx';tone.className='panel v24-tone-module v24-play-module';
      tone.innerHTML='<div class="panel-head v24-module-head"><div class="v24-module-meta"><span>SOUND SHAPING</span><strong>Tone & FX</strong><small data-v24-summary>Performance controls + effects</small></div><div class="v24-module-actions"></div></div><div class="v24-tone-body"></div>';
      instrument.after(tone);
    }
    const body=tone.querySelector('.v24-tone-body');
    instrument.querySelectorAll(':scope > .v9-expression-shell').forEach(node=>{if(node.parentElement!==body)body.appendChild(node)});
    if(typeof v24InstallToggle==='function')v24InstallToggle(tone,'tone','Tone & FX','SOUND SHAPING');
    v26EnsurePlayRack();
    tone.classList.toggle('v24-empty-module',!body.querySelector('.v9-expression-shell,.v19-rack-shell,.v17-fx-rack'));
    return tone;
  };
}

function v26SameOrder(parent,nodes){
  const set=new Set(nodes),current=[...parent.children].filter(n=>set.has(n));
  return current.length===nodes.length&&current.every((n,i)=>n===nodes[i]);
}

/* V24 used appendChild on every scan, creating a perpetual mutation/layout loop. */
if(typeof v24BuildPlayStack==='function'){
  v24BuildPlayStack=function(){
    if(currentScreen!=='play')return;
    const workspace=document.querySelector('#playScreen .play-workspace'),instrument=workspace?.querySelector('.instrument-panel'),beat=workspace?.querySelector('.beat-panel'),arp=document.querySelector('#v6ArpPanel');
    if(!workspace||!instrument||!beat)return;
    workspace.classList.add('v24-play-rack-stack');
    v24InstallToggle?.(instrument,'instrument','Instrument','PLAY SURFACE');
    const tone=v24EnsureToneModule(workspace,instrument);
    v24InstallToggle?.(beat,'groove','Groove Box','DRUM MACHINE');
    if(arp){v24InstallToggle?.(arp,'arp',playInstrument==='bass'?'Bass Arp':'Arp Lab','PATTERN ENGINE');v24NormalizePlayArp?.(arp)}
    const desired=[instrument,tone,beat,arp].filter(Boolean);
    if(!v26SameOrder(workspace,desired))desired.forEach(node=>workspace.appendChild(node));
    v26EnsurePlayRack();
    ['instrument','tone','groove','arp'].forEach(id=>v24SyncModule?.(workspace.querySelector(`[data-v24-module="${id}"]`),id));
  };
}
function v26SchedulePlayRepair(){
  if(v26PlayRepairQueued||currentScreen!=='play')return;
  v26PlayRepairQueued=true;
  requestAnimationFrame(()=>{v26PlayRepairQueued=false;try{v24BuildPlayStack?.()}catch(e){console.warn('V26 Play repair skipped',e)}});
}
if(typeof v24Schedule==='function')v24Schedule=v26SchedulePlayRepair;

/* Replace V19's full-document mutation scan with an added-rack-only observer. */
try{v19Observer?.disconnect()}catch{}
if(typeof v19Scan==='function'){
  v19Scan=function(){
    v19EnsureRateOptions?.();
    document.querySelectorAll('#layerSourceTools .v17-fx-rack').forEach(r=>v19EnhanceRack?.(r));
    if(currentScreen==='play')v26EnsurePlayRack();
  };
}
function v26CollectAddedRacks(mutations){
  const racks=[];
  for(const m of mutations)for(const n of m.addedNodes){
    if(n.nodeType!==1)continue;
    if(n.matches?.('.v17-fx-rack'))racks.push(n);
    n.querySelectorAll?.('.v17-fx-rack').forEach(r=>racks.push(r));
  }
  return racks;
}
const V26_RATE_SELECTOR='[data-arp="rate"],[data-basic="rate"],[data-v18-arp="rate"],[data-v15-arp="rate"]';
function v26MutationHasRateUI(mutations){
  return mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(V26_RATE_SELECTOR)||n.querySelector?.(V26_RATE_SELECTOR))));
}
const v26RackObserver=new MutationObserver(mutations=>{
  if(v26MutationHasRateUI(mutations))v19EnsureRateOptions?.();
  const racks=v26CollectAddedRacks(mutations);if(!racks.length)return;
  racks.filter(r=>r.closest('#layerSourceTools')).forEach(r=>v19EnhanceRack?.(r));
  if(racks.some(r=>r.closest('#playScreen'))&&!v26RackMutationQueued){
    v26RackMutationQueued=true;requestAnimationFrame(()=>{v26RackMutationQueued=false;v26EnsurePlayRack();v26SchedulePlayRepair()});
  }
});
v26RackObserver.observe(document.body,{childList:true,subtree:true});

/* Keep the Play ARP deck as a real responsive grid on tablet/mobile too. */
function v26NormalizePlayArpGrid(){
  const arp=document.querySelector('#v6ArpPanel');if(!arp||currentScreen!=='play')return;
  const body=arp.querySelector('.v6-arp-body'),visual=arp.querySelector('.v6-arp-visual'),legacy=arp.querySelector('.v22-arp-deck,.v6-arp-controls');
  if(!body||!legacy)return;
  let grid=body.querySelector(':scope > .v26-arp-grid');
  if(!grid){grid=document.createElement('div');grid.className='v26-arp-grid';visual?.insertAdjacentElement('afterend',grid)}
  [...legacy.querySelectorAll(':scope > label')].forEach(label=>grid.appendChild(label));
  legacy.classList.add('v26-legacy-arp-deck');
}
const v26BaseNormalizePlayArp=typeof v24NormalizePlayArp==='function'?v24NormalizePlayArp:null;
v24NormalizePlayArp=function(arp){const out=v26BaseNormalizePlayArp?.(arp);if(arp?.id==='v6ArpPanel')v26NormalizePlayArpGrid();return out};

window.addEventListener('pageshow',v26SchedulePlayRepair,{passive:true});
window.addEventListener('orientationchange',v26SchedulePlayRepair,{passive:true});
requestAnimationFrame(()=>{v26EnsurePlayRack();v26NormalizePlayArpGrid();v26SchedulePlayRepair()});