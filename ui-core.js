/* Music & Beats V32 — UI state ownership and non-structural parameter updates.
   Keeps Play drawer state independent from ARP/FX/control changes. */
(()=>{
  if(window.MB_UI_CORE)return;
  const CORE={version:'v32',lastArpParameterAt:-Infinity,arpGuardMs:180,playChangeActive:false,repairs:0};
  window.MB_UI_CORE=CORE;

  function now(){return performance.now()}
  function arpPanel(){return document.querySelector('#playScreen #v6ArpPanel')}
  function isPlayParameterTarget(target){return !!target?.closest?.('#playScreen select,#playScreen input,#playScreen textarea')}
  function isArpParameterTarget(target){
    return !!target?.closest?.('#playScreen #v6ArpPanel [data-arp],#playScreen #v6ArpPanel [data-v17-arp],#playScreen #v6ArpPanel [data-v18-arp],#playScreen #v6ArpPanel [data-v22-control] select,#playScreen #v6ArpPanel [data-v22-control] input');
  }
  function inArpParameterWindow(){return now()-CORE.lastArpParameterAt<CORE.arpGuardMs}

  function runtimeDrawerState(id,panel){
    try{if(typeof V25_DRAWER_STATE!=='undefined'&&V25_DRAWER_STATE.has(id))return !!V25_DRAWER_STATE.get(id)}catch{}
    if(panel?.dataset?.v25Collapsed==='1')return true;
    if(panel?.dataset?.v25Collapsed==='0')return false;
    return panel?.classList.contains('v24-collapsed')||false;
  }
  function applyDrawerState(id,collapsed,{persist=false,announce=false}={}){
    const panel=document.querySelector(`#playScreen [data-v24-module="${id}"]`);if(!panel)return;
    try{
      if(typeof v25ApplyDrawer==='function'){v25ApplyDrawer(panel,id,!!collapsed,{persist,announce});return}
    }catch{}
    panel.classList.toggle('v24-collapsed',!!collapsed);
  }
  function syncModuleSummary(target){
    const panel=target?.closest?.('#playScreen [data-v24-module]');if(!panel)return;
    const id=panel.dataset.v24Module,summary=panel.querySelector('[data-v24-summary]');
    if(summary&&id&&typeof v24ModuleSummary==='function')try{summary.textContent=v24ModuleSummary(id,panel)}catch{}
  }
  function syncArpSummary(){const panel=arpPanel();if(panel)syncModuleSummary(panel)}
  function preserveOpenArp(){
    const panel=arpPanel();if(!panel)return;
    const collapsed=runtimeDrawerState('arp',panel);
    if(!collapsed){CORE.repairs++;applyDrawerState('arp',false)}
    syncArpSummary();
  }

  /* Capture parameter edits before older document-level listeners run. A change to a
     select/range/input is data, not layout: it must never rebuild the Play stack. */
  window.addEventListener('input',e=>{if(isArpParameterTarget(e.target))CORE.lastArpParameterAt=now()},true);
  window.addEventListener('change',e=>{
    if(!isPlayParameterTarget(e.target))return;
    CORE.playChangeActive=true;
    if(isArpParameterTarget(e.target))CORE.lastArpParameterAt=now();
    syncModuleSummary(e.target);
    queueMicrotask(()=>{CORE.playChangeActive=false;syncModuleSummary(e.target)});
  },true);

  /* V24's historical Play change listener calls v24Schedule for every control.
     During an ordinary parameter event this is now deliberately a no-op. */
  try{
    if(typeof v24Schedule==='function'){
      const baseSchedule=v24Schedule;
      v24Schedule=function(){
        if(CORE.playChangeActive)return;
        return baseSchedule.apply(this,arguments);
      };
    }
  }catch{}

  /* V28 historically re-sorted/reparented the ARP topology on every change event.
     Its delayed restore is suppressed only for the short ARP parameter window. */
  try{
    if(typeof v28Schedule==='function'){
      const baseV28Schedule=v28Schedule;
      v28Schedule=function(){if(inArpParameterWindow())return;return baseV28Schedule.apply(this,arguments)};
    }
  }catch{}

  /* Structural rebuilds still happen for real lifecycle changes. Preserve the explicit
     drawer state across those legitimate rebuilds. */
  try{
    if(typeof v24BuildPlayStack==='function'){
      const baseBuild=v24BuildPlayStack;
      v24BuildPlayStack=function(){
        const panel=arpPanel(),before=panel?runtimeDrawerState('arp',panel):null;
        const out=baseBuild.apply(this,arguments);
        if(before!==null)applyDrawerState('arp',before);
        return out;
      };
    }
  }catch{}

  /* Final assertion after ARP edits. Cheap and state-preserving: an open module stays open. */
  window.addEventListener('change',e=>{
    if(!isArpParameterTarget(e.target))return;
    queueMicrotask(preserveOpenArp);requestAnimationFrame(preserveOpenArp);
  },true);

  CORE.getDrawer=id=>{const panel=document.querySelector(`#playScreen [data-v24-module="${id}"]`);return panel?{collapsed:runtimeDrawerState(id,panel),panel}:null};
  CORE.setDrawer=(id,collapsed,options={})=>applyDrawerState(id,collapsed,options);
  CORE.openDrawer=id=>applyDrawerState(id,false,{persist:true,announce:true});
  CORE.closeDrawer=id=>applyDrawerState(id,true,{persist:true,announce:true});

  window.addEventListener('pageshow',()=>requestAnimationFrame(preserveOpenArp),{passive:true});
  window.addEventListener('orientationchange',()=>requestAnimationFrame(preserveOpenArp),{passive:true});
})();