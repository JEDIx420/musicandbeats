/* Music & Beats V24 — Play mode horizontal rack console. */
let v24ScanQueued=false;
const V24_MODULE_DEFAULTS={instrument:false,tone:true,groove:true,arp:true};

function v24StoreKey(id){return `musicandbeats:v24:play:${id}`}
function v24ReadCollapsed(id){
  try{const v=localStorage.getItem(v24StoreKey(id));if(v!==null)return v==='1'}catch{}
  return !!V24_MODULE_DEFAULTS[id];
}
function v24WriteCollapsed(id,value){try{localStorage.setItem(v24StoreKey(id),value?'1':'0')}catch{}}
function v24ModuleSummary(id,panel){
  if(id==='instrument'){
    const name=playInstrument==='guitar'?'Guitar':playInstrument==='bass'?'Bass':'Smart Keys';
    const sound=$('#playSound')?.value||$('#playBassSound')?.value||'';return sound?`${name} · ${sound}`:name;
  }
  if(id==='tone'){
    const rack=panel?.querySelector('.v19-rack-shell'),summary=rack?.querySelector('[data-v19-rack-summary]')?.textContent?.trim();
    return summary||'Performance controls + effects';
  }
  if(id==='groove'){
    const style=$('#playBeatStyle')?.value||'Worship',kit=document.querySelector('#playScreen [data-v18-kit]')?.value||'Studio';return `${style} · ${kit}`;
  }
  if(id==='arp'){
    const state=typeof v6Arp!=='undefined'&&v6Arp?.enabled?'ARP ON':'ARP OFF',rate=typeof v6Arp!=='undefined'?(v6Arp.rate||'1/8'):'1/8';return `${state} · ${rate}`;
  }
  return '';
}
function v24ToggleMarkup(id,collapsed){return `<button class="v24-module-toggle" data-v24-toggle="${id}" type="button" aria-expanded="${String(!collapsed)}"><span>${collapsed?'SHOW':'HIDE'}</span><i>⌄</i></button>`}
function v24SyncModule(panel,id){
  if(!panel)return;const collapsed=v24ReadCollapsed(id);panel.classList.toggle('v24-collapsed',collapsed);panel.dataset.v24Module=id;
  const toggle=panel.querySelector(`[data-v24-toggle="${id}"]`);if(toggle){toggle.setAttribute('aria-expanded',String(!collapsed));toggle.querySelector('span').textContent=collapsed?'SHOW':'HIDE'}
  const summary=panel.querySelector('[data-v24-summary]');if(summary)summary.textContent=v24ModuleSummary(id,panel);
}
function v24InstallToggle(panel,id,title,kicker){
  if(!panel)return;panel.classList.add('v24-play-module');panel.dataset.v24Module=id;
  let head=panel.querySelector(':scope > .panel-head,:scope > .v17-record-arp-head');
  if(!head){head=document.createElement('div');head.className='panel-head v24-generated-head';panel.prepend(head)}
  head.classList.add('v24-module-head');
  let meta=head.querySelector('.v24-module-meta');
  if(!meta){meta=document.createElement('div');meta.className='v24-module-meta';meta.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small data-v24-summary></small>`;head.prepend(meta)}
  let actions=head.querySelector('.v24-module-actions');
  if(!actions){actions=document.createElement('div');actions.className='v24-module-actions';
    const existing=[...head.children].filter(n=>n!==meta&&!(n.matches?.('.v24-module-actions')));existing.forEach(n=>actions.appendChild(n));head.appendChild(actions)}
  if(!actions.querySelector(`[data-v24-toggle="${id}"]`)){actions.insertAdjacentHTML('beforeend',v24ToggleMarkup(id,v24ReadCollapsed(id)))}
  v24SyncModule(panel,id);
}
function v24EnsureToneModule(workspace,instrument){
  let tone=$('#v24ToneFx');if(!tone){tone=document.createElement('section');tone.id='v24ToneFx';tone.className='panel v24-tone-module v24-play-module';tone.innerHTML='<div class="panel-head v24-module-head"><div class="v24-module-meta"><span>SOUND SHAPING</span><strong>Tone & FX</strong><small data-v24-summary>Performance controls + effects</small></div><div class="v24-module-actions"></div></div><div class="v24-tone-body"></div>';instrument.after(tone)}
  const body=tone.querySelector('.v24-tone-body');
  document.querySelectorAll('#playScreen .instrument-panel .v9-expression-shell,#playScreen .instrument-panel .v19-rack-shell').forEach(node=>body.appendChild(node));
  /* Catch a newly rebuilt rack before V19 has wrapped it, without stealing record racks. */
  document.querySelectorAll('#playScreen .instrument-panel > .v17-fx-rack').forEach(node=>body.appendChild(node));
  v24InstallToggle(tone,'tone','Tone & FX','SOUND SHAPING');
  const hasContent=!!body.querySelector('.v9-expression-shell,.v19-rack-shell,.v17-fx-rack');tone.classList.toggle('v24-empty-module',!hasContent);
  return tone;
}
function v24NormalizePlayArp(arp){
  if(!arp)return;arp.classList.add('v24-play-arp');
  const body=arp.querySelector('.v6-arp-body'),visual=arp.querySelector('.v6-arp-visual'),controls=arp.querySelector('.v6-arp-controls,.v22-arp-deck');
  if(body){body.classList.add('v24-arp-body');if(visual)visual.classList.add('v24-arp-scope-wrap');if(controls)controls.classList.add('v24-arp-grid')}
  if(controls){
    /* Flatten accidental wrapper layers so all twelve controls participate in one 6x2 grid. */
    const labels=[...controls.querySelectorAll('label')].filter(l=>!l.parentElement?.closest?.('.v22-rhythm-pattern'));
    labels.forEach(l=>{if(l.parentElement!==controls)controls.appendChild(l)});
    [...controls.children].forEach(n=>{if(n.matches?.('.v17-pattern,.v18-arp-pattern,.v22-rhythm-pattern'))return;if(n.matches?.('label'))return;if(!n.matches?.('button'))n.classList?.add('v24-arp-legacy-hidden')});
  }
}
function v24BuildPlayStack(){
  if(currentScreen!=='play')return;const workspace=$('#playScreen .play-workspace'),instrument=workspace?.querySelector('.instrument-panel'),beat=workspace?.querySelector('.beat-panel'),arp=$('#v6ArpPanel');if(!workspace||!instrument||!beat)return;
  workspace.classList.add('v24-play-rack-stack');
  v24InstallToggle(instrument,'instrument','Instrument','PLAY SURFACE');
  const tone=v24EnsureToneModule(workspace,instrument);
  v24InstallToggle(beat,'groove','Groove Box','DRUM MACHINE');
  if(arp){v24InstallToggle(arp,'arp',playInstrument==='bass'?'Bass Arp':'Arp Lab','PATTERN ENGINE');v24NormalizePlayArp(arp)}
  /* Canonical order: Instrument → Tone & FX → Groove Box → Arp Lab. */
  if(instrument.parentElement===workspace)workspace.appendChild(instrument);
  if(tone.parentElement===workspace)workspace.appendChild(tone);
  if(beat.parentElement===workspace)workspace.appendChild(beat);
  if(arp&&arp.parentElement===workspace)workspace.appendChild(arp);
  ['instrument','tone','groove','arp'].forEach(id=>v24SyncModule(workspace.querySelector(`[data-v24-module="${id}"]`),id));
}
function v24Schedule(){if(v24ScanQueued)return;v24ScanQueued=true;requestAnimationFrame(()=>{v24ScanQueued=false;v24BuildPlayStack()})}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-v24-toggle]');if(b){const id=b.dataset.v24Toggle,panel=b.closest('[data-v24-module]'),next=!panel.classList.contains('v24-collapsed');v24WriteCollapsed(id,next);v24SyncModule(panel,id);return}if(e.target.closest?.('.instrument-tab,[data-v18-generate],#generatePlayBeat,#clearPlayBeat,.v6-arp-power,[data-arp-action]'))v24Schedule()},true);
document.addEventListener('change',e=>{if(e.target.closest?.('#playScreen'))v24Schedule()},true);
const v24Play=$('#playScreen');if(v24Play)new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.v9-expression-shell,.v19-rack-shell,.v17-fx-rack,#v6ArpPanel')||n.querySelector?.('.v9-expression-shell,.v19-rack-shell,.v17-fx-rack,#v6ArpPanel')))))v24Schedule()}).observe(v24Play,{childList:true,subtree:true});

/* Re-apply after instrument renders without touching Record. */
if(typeof renderPlayInstrument==='function'){
  const v24BaseRenderPlayInstrument=renderPlayInstrument;renderPlayInstrument=function(){const out=v24BaseRenderPlayInstrument.apply(this,arguments);v24Schedule();return out};
}
window.addEventListener('resize',v24Schedule,{passive:true});
v24Schedule();
