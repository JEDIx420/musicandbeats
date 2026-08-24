/* Music & Beats V32 — UI state ownership and non-structural parameter updates.
   Keeps Play drawer state independent from ARP/FX/control changes. */
(()=>{
  if(window.MB_UI_CORE)return;
  const CORE={version:'v32',lastArpParameterAt:-Infinity,guardMs:180,repairs:0};
  window.MB_UI_CORE=CORE;

  function now(){return performance.now()}
  function arpPanel(){return document.querySelector('#playScreen #v6ArpPanel')}
  function isArpParameterTarget(target){
    return !!target?.closest?.('#playScreen #v6ArpPanel [data-arp],#playScreen #v6ArpPanel [data-v17-arp],#playScreen #v6ArpPanel [data-v18-arp],#playScreen #v6ArpPanel [data-v22-control] select,#playScreen #v6ArpPanel [data-v22-control] input');
  }
  function markArpParameter(target){if(isArpParameterTarget(target))CORE.lastArpParameterAt=now()}
  function inArpParameterWindow(){return now()-CORE.lastArpParameterAt<CORE.guardMs}

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
  function syncArpSummary(){
    const panel=arpPanel(),summary=panel?.querySelector('[data-v24-summary]');
    if(summary&&typeof v24ModuleSummary==='function')try{summary.textContent=v24ModuleSummary('arp',panel)}catch{}
  }
  function preserveOpenArp(){
    const panel=arpPanel();if(!panel)return;
    const collapsed=runtimeDrawerState('arp',panel);
    if(!collapsed){CORE.repairs++;applyDrawerState('arp',false);}
    syncArpSummary();
  }

  /* Mark ARP control interactions before the older document-level listeners run. */
  window.addEventListener('input',e=>markArpParameter(e.target),true);
  window.addEventListener('change',e=>markArpParameter(e.target),true);

  /* V24's historical Play change listener calls v24Schedule for every control.
     Parameter edits are not structural, so they must never rebuild the Play stack. */
  try{
    if(typeof v24Schedule==='function'){
      const baseSchedule=v24Schedule;
      v24Schedule=function(){
        if(inArpParameterWindow()){syncArpSummary();return}
        return baseSchedule.apply(this,arguments);
      };
    }
  }catch{}

  /* V28 historically re-sorted/reparented the ARP topology on every change event.
     Keep restoration for actual lifecycle events only, never ordinary parameter edits. */
  try{
    if(typeof v28Schedule==='function'){
      const baseV28Schedule=v28Schedule;
      v28Schedule=function(){
        if(inArpParameterWindow())return;
        return baseV28Schedule.apply(this,arguments);
      };
    }
  }catch{}

  /* Structural rebuilds may still happen for instrument changes/orientation. Preserve
     the explicit drawer state across those legitimate rebuilds. */
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

  /* Final microtask/rAF assertion after a parameter edit. This is intentionally cheap:
     it only touches the ARP module when the user had it open. */
  function settleParameterEdit(e){
    if(!isArpParameterTarget(e.target))return;
    queueMicrotask(()=>preserveOpenArp());
    requestAnimationFrame(preserveOpenArp);
  }
  window.addEventListener('change',settleParameterEdit,true);

  /* One public drawer API for new code/help integrations. */
  CORE.getDrawer=id=>{
    const panel=document.querySelector(`#playScreen [data-v24-module="${id}"]`);return panel?{collapsed:runtimeDrawerState(id,panel),panel}:null;
  };
  CORE.setDrawer=(id,collapsed,options={})=>applyDrawerState(id,collapsed,options);
  CORE.openDrawer=id=>applyDrawerState(id,false,{persist:true,announce:true});
  CORE.closeDrawer=id=>applyDrawerState(id,true,{persist:true,announce:true});

  window.addEventListener('pageshow',()=>requestAnimationFrame(preserveOpenArp),{passive:true});
  window.addEventListener('orientationchange',()=>requestAnimationFrame(preserveOpenArp),{passive:true});
})();