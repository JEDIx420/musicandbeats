/* Music & Beats V23 — latch correctness, idle-performance hardening and coherent UI boot. */
let v23ArpCanvases=[];
let v23VisLastFrame=0;
let v23LatchScanQueued=false;

/* --------------------------------------------------------------------------
   LATCH placement + visual truth.
   -------------------------------------------------------------------------- */
function v23FindResetButton(row){
  if(!row)return null;
  return row.querySelector('.v6-reset-smart')||[...row.querySelectorAll('button')].find(b=>/reset/i.test(b.textContent||''))||null;
}
function v23EnsureSmartLatch(){
  document.querySelectorAll('#playScreen .v6-smart-toolbar,#layerSourceTools .v6-smart-toolbar').forEach(toolbar=>{
    const row=toolbar.firstElementChild||toolbar;if(row.querySelector('[data-v18-latch="smart"]'))return;
    const reset=v23FindResetButton(row);if(!reset||typeof v18LatchButton!=='function')return;
    reset.insertAdjacentHTML('afterend',v18LatchButton('smart'));
    const button=reset.nextElementSibling;if(button?.matches?.('[data-v18-latch="smart"]'))button.classList.add('v23-smart-latch');
    const note=toolbar.querySelector('small');if(note)note.textContent='Tap / 1–7 to play · LATCH holds the current chord';
  });
  try{v18SyncLatchUI?.()}catch{}
}
function v23ClearSmartVisual(except=null){
  document.querySelectorAll('#playChords .chord-pad,#recordChords .chord-pad').forEach(p=>{
    if(p===except)return;p.classList.remove('v14-latched','v18-latched','v23-latch-current');p.removeAttribute('aria-pressed');
  });
  if(except){except.classList.add('v14-latched','v18-latched','v23-latch-current');except.setAttribute('aria-pressed','true')}
}
function v23ClearBassVisual(except=null){
  document.querySelectorAll('#playKeyboard .piano-key,#recordKeyboard .piano-key').forEach(k=>{
    if(k===except)return;
    if(k.classList.contains('arp-active')||k.classList.contains('v18-latched')||k.classList.contains('v23-latch-current'))k.classList.remove('arp-active','v18-latched','v23-latch-current','active');
  });
  if(except){except.classList.add('arp-active','v18-latched','v23-latch-current')}
}

if(typeof v18LatchSmartPad==='function'){
  const v23BaseLatchSmartPad=v18LatchSmartPad;
  v18LatchSmartPad=function(pad){v23ClearSmartVisual();const out=v23BaseLatchSmartPad.apply(this,arguments);if(out)v23ClearSmartVisual(pad);return out};
}
if(typeof v6StartArp==='function'){
  const v23BaseStartArp=v6StartArp;
  v6StartArp=function(target){
    const out=v23BaseStartArp.apply(this,arguments);
    if(target?.kind==='bass'&&typeof v18LatchOn==='function'&&v18LatchOn('bass'))v23ClearBassVisual(target.pad||null);
    else if(target?.pad&&typeof v18LatchOn==='function'&&v18LatchOn('smart')&&target.pad.closest?.('#playChords,#recordChords'))v23ClearSmartVisual(target.pad);
    return out;
  };
}
if(typeof v18SetLatch==='function'){
  const v23BaseSetLatch=v18SetLatch;
  v18SetLatch=function(kind,on){
    const out=v23BaseSetLatch.apply(this,arguments);
    if(!on){if(kind==='bass')v23ClearBassVisual();else if(kind==='smart')v23ClearSmartVisual()}
    v23EnsureSmartLatch();return out;
  };
}
if(typeof v15HardStopArp==='function'){
  const v23BaseHardStopArp=v15HardStopArp;
  v15HardStopArp=function(){const out=v23BaseHardStopArp.apply(this,arguments);v23ClearBassVisual();if(v6Arp?.target?.kind!=='bass')v23ClearSmartVisual();return out};
}

function v23LatchRefresh(){v23LatchScanQueued=false;v23EnsureSmartLatch();
  if(typeof v18LatchOn==='function'){
    if(v18LatchOn('bass')&&v6Arp?.target?.kind==='bass')v23ClearBassVisual(v6Arp.target.pad||null);
    if(v18LatchOn('smart')&&v6Arp?.target?.pad?.closest?.('#playChords,#recordChords'))v23ClearSmartVisual(v6Arp.target.pad);
  }
}
function v23ScheduleLatchRefresh(){if(v23LatchScanQueued)return;v23LatchScanQueued=true;requestAnimationFrame(v23LatchRefresh)}
const v23ToolHost=document.querySelector('#layerSourceTools');if(v23ToolHost)new MutationObserver(v23ScheduleLatchRefresh).observe(v23ToolHost,{childList:true,subtree:true});
const v23PlayHost=document.querySelector('#playScreen');if(v23PlayHost)new MutationObserver(v23ScheduleLatchRefresh).observe(v23PlayHost,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest?.('.source-card,.instrument-tab,.v18-latch-switch'))v23ScheduleLatchRefresh()},true);

/* --------------------------------------------------------------------------
   V22 visualizer: zero continuous work while idle, ~30fps while ARP is running.
   -------------------------------------------------------------------------- */
function v23ArpRunning(){return !!v6Arp?.enabled&&!!v6Arp?.timer&&!document.hidden}
function v23RefreshArpCanvases(){v23ArpCanvases=[...document.querySelectorAll('.v22-arp-scope canvas')].filter(c=>c.isConnected)}
if(typeof v22EnsureArpAnalyser==='function'){
  const v23BaseEnsureAnalyser=v22EnsureArpAnalyser;
  v22EnsureArpAnalyser=function(){if(!ctx)return null;return v23BaseEnsureAnalyser.apply(this,arguments)};
}
if(typeof v22ScanArpUI==='function'){
  const v23BaseScanArpUI=v22ScanArpUI;
  v22ScanArpUI=function(){const out=v23BaseScanArpUI.apply(this,arguments);v23RefreshArpCanvases();v22StartVisualizer?.(true);return out};
}
if(typeof v22VisualizerLoop==='function'){
  v22VisualizerLoop=function(now){
    if(!v23ArpCanvases.length)v23RefreshArpCanvases();
    const active=v23ArpRunning(),due=!v23VisLastFrame||now-v23VisLastFrame>=33;
    if(due||!active){
      v23VisLastFrame=now;
      v23ArpCanvases.forEach(c=>{if(c.isConnected&&c.offsetParent!==null)try{v22DrawScope(c,now)}catch{}});
    }
    if(active&&v23ArpCanvases.some(c=>c.isConnected&&c.offsetParent!==null))V22_ARP_VIS.raf=requestAnimationFrame(v22VisualizerLoop);
    else V22_ARP_VIS.raf=0;
  };
  v22StartVisualizer=function(force=false){
    if(V22_ARP_VIS.raf)return;
    if(force||v23ArpRunning())V22_ARP_VIS.raf=requestAnimationFrame(v22VisualizerLoop);
  };
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&V22_ARP_VIS?.raf){cancelAnimationFrame(V22_ARP_VIS.raf);V22_ARP_VIS.raf=0}
  else if(!document.hidden)v22StartVisualizer?.(true);
});

/* Keep expensive ARP repainting isolated from the rest of the workstation. */
document.documentElement.classList.add('v23-performance-ui');
v23RefreshArpCanvases();v23EnsureSmartLatch();v22StartVisualizer?.(true);
