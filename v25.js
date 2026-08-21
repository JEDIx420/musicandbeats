/* Music & Beats V25 — reliable cross-device Play drawer state engine. */
const V25_DRAWER_STATE=new Map();
let v25DrawerScanQueued=false;

function v25DrawerKey(id){return `musicandbeats:v24:play:${id}`}
function v25ReadPersisted(id){
  try{const v=localStorage.getItem(v25DrawerKey(id));return v===null?null:v==='1'}catch{return null}
}
function v25Persist(id,collapsed){try{localStorage.setItem(v25DrawerKey(id),collapsed?'1':'0')}catch{}}
function v25DrawerHeader(panel){
  if(!panel)return null;
  return [...panel.children].find(n=>n.classList?.contains('v24-module-head'))||panel.querySelector(':scope > .panel-head,:scope > .v17-record-arp-head');
}
function v25DrawerParts(panel){
  const head=v25DrawerHeader(panel);
  return [...panel.children].filter(n=>n!==head);
}
function v25InitialState(panel,id){
  if(V25_DRAWER_STATE.has(id))return V25_DRAWER_STATE.get(id);
  const saved=v25ReadPersisted(id);
  if(saved!==null){V25_DRAWER_STATE.set(id,saved);return saved}
  const collapsed=panel.classList.contains('v24-collapsed');
  V25_DRAWER_STATE.set(id,collapsed);return collapsed;
}
function v25SyncButton(panel,id,collapsed){
  const button=panel.querySelector(`[data-v24-toggle="${id}"]`);
  if(!button)return;
  button.setAttribute('aria-expanded',String(!collapsed));
  button.setAttribute('aria-label',`${collapsed?'Show':'Hide'} ${panel.querySelector('.v24-module-meta>strong')?.textContent?.trim()||id}`);
  const word=button.querySelector('span');if(word)word.textContent=collapsed?'SHOW':'HIDE';
}
function v25ApplyVisibility(panel,collapsed){
  v25DrawerParts(panel).forEach(part=>{
    part.classList.toggle('v25-drawer-hidden',collapsed);
    part.setAttribute('aria-hidden',String(collapsed));
    try{part.inert=collapsed}catch{}
  });
}
function v25ApplyDrawer(panel,id,collapsed,{persist=false,announce=false}={}){
  if(!panel||!id)return;
  collapsed=!!collapsed;
  V25_DRAWER_STATE.set(id,collapsed);
  panel.classList.toggle('v24-collapsed',collapsed);
  panel.classList.toggle('v25-drawer-open',!collapsed);
  panel.dataset.v25Collapsed=collapsed?'1':'0';
  v25SyncButton(panel,id,collapsed);
  v25ApplyVisibility(panel,collapsed);
  const summary=panel.querySelector('[data-v24-summary]');
  if(summary&&typeof v24ModuleSummary==='function')try{summary.textContent=v24ModuleSummary(id,panel)}catch{}
  if(persist)v25Persist(id,collapsed);
  if(announce)panel.dispatchEvent(new CustomEvent('musicandbeats:drawerchange',{bubbles:true,detail:{id,collapsed}}));
  if(!collapsed){
    requestAnimationFrame(()=>{
      try{v24NormalizePlayArp?.(panel.id==='v6ArpPanel'?panel:null)}catch{}
      try{v22StartVisualizer?.(true)}catch{}
    });
  }
}
function v25PrepareDrawer(panel){
  if(!panel?.matches?.('#playScreen [data-v24-module]'))return;
  const id=panel.dataset.v24Module;if(!id)return;
  const collapsed=v25InitialState(panel,id);
  v25ApplyDrawer(panel,id,collapsed);
  const button=panel.querySelector(`[data-v24-toggle="${id}"]`);
  if(button){button.style.touchAction='manipulation';button.dataset.v25DrawerControl='1'}
}
function v25ScanDrawers(){
  v25DrawerScanQueued=false;
  document.querySelectorAll('#playScreen [data-v24-module]').forEach(v25PrepareDrawer);
}
function v25ScheduleDrawerScan(){if(v25DrawerScanQueued)return;v25DrawerScanQueued=true;requestAnimationFrame(v25ScanDrawers)}

/* Any later V24 rebuild now consults V25's runtime state instead of storage. */
if(typeof v24SyncModule==='function'){
  v24SyncModule=function(panel,id){
    if(!panel||!id)return;
    const collapsed=V25_DRAWER_STATE.has(id)?V25_DRAWER_STATE.get(id):v25InitialState(panel,id);
    v25ApplyDrawer(panel,id,collapsed);
  };
}

/* V25 owns drawer activation before V24's older document handler can see it. */
window.addEventListener('click',e=>{
  const button=e.target?.closest?.('#playScreen [data-v24-toggle]');if(!button)return;
  const panel=button.closest('[data-v24-module]'),id=button.dataset.v24Toggle||panel?.dataset?.v24Module;if(!panel||!id)return;
  e.preventDefault();e.stopPropagation();
  const current=V25_DRAWER_STATE.has(id)?V25_DRAWER_STATE.get(id):panel.classList.contains('v24-collapsed');
  v25ApplyDrawer(panel,id,!current,{persist:true,announce:true});
},{capture:true});

/* Real buttons already support keyboard activation; prevent duplicate synthetic toggles. */
window.addEventListener('keydown',e=>{
  const button=e.target?.closest?.('#playScreen [data-v24-toggle]');if(!button||!['Enter',' '].includes(e.key)||e.repeat)return;
  e.preventDefault();e.stopPropagation();button.click();
},{capture:true});

const v25PlayScreen=document.querySelector('#playScreen');
if(v25PlayScreen)new MutationObserver(mutations=>{
  if(mutations.some(m=>m.type==='childList'&&([...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('[data-v24-module],[data-v24-toggle]')||n.querySelector?.('[data-v24-module],[data-v24-toggle]'))))))v25ScheduleDrawerScan();
}).observe(v25PlayScreen,{childList:true,subtree:true});

window.addEventListener('pageshow',v25ScheduleDrawerScan,{passive:true});
window.addEventListener('orientationchange',v25ScheduleDrawerScan,{passive:true});
v25ScanDrawers();
