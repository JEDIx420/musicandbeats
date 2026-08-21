/* Music & Beats V19 — true ultra-fast arp rates + expanded collapsible performance rack. */

/* --------------------------------------------------------------------------
   Arp timing: one authoritative rate map for Smart Keys + Bass, Play + Record.
   -------------------------------------------------------------------------- */
const V19_ARP_RATE_BEATS={
  '1/4':1,
  '1/8':.5,
  '1/8T':1/3,
  '1/16':.25,
  '1/32':.125,
  '1/64':.0625
};
v6RateMs=function(){
  const bpm=v6Arp?.target?.bpm||clamp(+($('#playBpm')?.value||session?.bpm||100),40,220);
  const beats=V19_ARP_RATE_BEATS[v6Arp?.rate]??.5;
  return (60000/bpm)*beats;
};
function v19RateOptions(current){
  const rows=[['1/4','1/4'],['1/8','1/8'],['1/8T','1/8 Triplet'],['1/16','1/16'],['1/32','1/32'],['1/64','1/64']];
  return rows.map(([v,label])=>`<option value="${v}" ${v===current?'selected':''}>${label}</option>`).join('');
}
function v19EnsureRateOptions(){
  document.querySelectorAll('[data-arp="rate"],[data-basic="rate"],[data-v18-arp="rate"],[data-v15-arp="rate"]').forEach(select=>{
    if(!(select instanceof HTMLSelectElement))return;
    const current=select.value||'1/8',signature=[...select.options].map(o=>o.value).join('|');
    if(signature==='1/4|1/8|1/8T|1/16|1/32|1/64')return;
    select.innerHTML=v19RateOptions(current);select.value=V19_ARP_RATE_BEATS[current]!=null?current:'1/8';
  });
}

/* --------------------------------------------------------------------------
   Performance Rack: much larger curated board library.
   -------------------------------------------------------------------------- */
Object.assign(V17_FX_BOARDS,{
  'Wide Piano':{drive:{on:false,amount:.05},chorus:{on:true,amount:.22},delay:{on:false,amount:.08},reverb:{on:true,amount:.23}},
  'Neo Soul Room':{drive:{on:true,amount:.08},chorus:{on:true,amount:.27},delay:{on:false,amount:.08},reverb:{on:true,amount:.26}},
  'Vintage EP':{drive:{on:true,amount:.13},chorus:{on:true,amount:.32},delay:{on:false,amount:.09},reverb:{on:true,amount:.18}},
  'Disco Chorus':{drive:{on:false,amount:.08},chorus:{on:true,amount:.55},delay:{on:true,amount:.12},reverb:{on:true,amount:.16}},
  'House Keys':{drive:{on:true,amount:.16},chorus:{on:true,amount:.18},delay:{on:true,amount:.18},reverb:{on:true,amount:.14}},
  'Future Bounce':{drive:{on:true,amount:.22},chorus:{on:true,amount:.38},delay:{on:true,amount:.27},reverb:{on:true,amount:.24}},
  'Supersaw Lift':{drive:{on:true,amount:.28},chorus:{on:true,amount:.41},delay:{on:true,amount:.36},reverb:{on:true,amount:.31}},
  'Trance Cathedral':{drive:{on:true,amount:.13},chorus:{on:true,amount:.35},delay:{on:true,amount:.46},reverb:{on:true,amount:.72}},
  'Pluck Echo':{drive:{on:false,amount:.10},chorus:{on:true,amount:.13},delay:{on:true,amount:.58},reverb:{on:true,amount:.22}},
  'Club Shine':{drive:{on:true,amount:.18},chorus:{on:true,amount:.25},delay:{on:true,amount:.25},reverb:{on:true,amount:.16}},
  'Dream Pop':{drive:{on:false,amount:.06},chorus:{on:true,amount:.42},delay:{on:true,amount:.38},reverb:{on:true,amount:.55}},
  'Vapor Bloom':{drive:{on:false,amount:.05},chorus:{on:true,amount:.52},delay:{on:true,amount:.31},reverb:{on:true,amount:.66}},
  'Ambient Infinity':{drive:{on:false,amount:.03},chorus:{on:true,amount:.48},delay:{on:true,amount:.62},reverb:{on:true,amount:.78}},
  'Worship Air':{drive:{on:false,amount:.04},chorus:{on:true,amount:.26},delay:{on:true,amount:.42},reverb:{on:true,amount:.69}},
  'Tape Dream':{drive:{on:true,amount:.21},chorus:{on:true,amount:.18},delay:{on:true,amount:.24},reverb:{on:true,amount:.27}},
  'Broken Radio':{drive:{on:true,amount:.47},chorus:{on:false,amount:.07},delay:{on:true,amount:.12},reverb:{on:false,amount:.08}},
  'Synthwave Night':{drive:{on:true,amount:.17},chorus:{on:true,amount:.53},delay:{on:true,amount:.33},reverb:{on:true,amount:.38}},
  'Deep Sub Tight':{drive:{on:true,amount:.11},chorus:{on:false,amount:.03},delay:{on:false,amount:.03},reverb:{on:false,amount:.04}},
  'House Bass Glue':{drive:{on:true,amount:.28},chorus:{on:true,amount:.08},delay:{on:false,amount:.07},reverb:{on:true,amount:.06}},
  'Reese Chamber':{drive:{on:true,amount:.37},chorus:{on:true,amount:.22},delay:{on:true,amount:.12},reverb:{on:true,amount:.16}},
  'Acid Tunnel':{drive:{on:true,amount:.58},chorus:{on:false,amount:.04},delay:{on:true,amount:.31},reverb:{on:true,amount:.13}},
  'Growl Arena':{drive:{on:true,amount:.61},chorus:{on:true,amount:.16},delay:{on:true,amount:.24},reverb:{on:true,amount:.23}}
});

const V19_BOARD_GROUPS=[
  ['STUDIO & KEYS',['Clean Studio','Wide Piano','Neo Soul Room','Vintage EP','Neon Wide','Disco Chorus']],
  ['EDM & CLUB',['Festival Stack','House Keys','Future Bounce','Supersaw Lift','Trance Cathedral','Pluck Echo','Club Shine']],
  ['AMBIENT',['Dream Hall','Dream Pop','Vapor Bloom','Ambient Infinity','Worship Air']],
  ['COLOR & CHARACTER',['Lo-Fi Tape','Tape Dream','Broken Radio','Synthwave Night']],
  ['BASS',['Bass Forge','Deep Sub Tight','House Bass Glue','Reese Chamber','Acid Room','Acid Tunnel','Growl Arena']]
];
function v19BoardOptions(current){
  return V19_BOARD_GROUPS.map(([label,names])=>`<optgroup label="${label}">${names.filter(n=>V17_FX_BOARDS[n]).map(n=>`<option value="${n}" ${n===current?'selected':''}>${n}</option>`).join('')}</optgroup>`).join('');
}
function v19PopulateBoardSelect(select){
  if(!(select instanceof HTMLSelectElement)||select.dataset.v19Boards==='1')return;const current=select.value||'Clean Studio';
  select.innerHTML=v19BoardOptions(current);
  if(V17_FX_BOARDS[current])select.value=current;else select.value='Clean Studio';
  select.dataset.v19Boards='1';
}
function v19RackContext(rack){return rack.closest('#layerSourceTools')?'record':'play'}
function v19RackStorageKey(context){return`musicandbeats:v19:rack:${context}`}
function v19RackCollapsed(context){
  try{const saved=localStorage.getItem(v19RackStorageKey(context));if(saved!==null)return saved==='collapsed'}catch{}
  try{return (navigator.maxTouchPoints||0)>0&&(matchMedia('(pointer:coarse)').matches||matchMedia('(hover:none)').matches)}catch{return false}
}
function v19SaveRackCollapsed(context,collapsed){try{localStorage.setItem(v19RackStorageKey(context),collapsed?'collapsed':'expanded')}catch{}}
function v19RackSummary(rack){
  const board=rack.querySelector('[data-v17-board]')?.value||'Clean Studio',active=rack.querySelectorAll('.v17-pedal.on').length;
  return `${board} · ${active} FX active`;
}
function v19SyncRackShell(shell){
  if(!shell)return;const rack=shell.querySelector(':scope > .v17-fx-rack');if(!rack)return;
  const context=v19RackContext(rack),summary=shell.querySelector('[data-v19-rack-summary]'),word=shell.querySelector('[data-v19-rack-word]'),toggle=shell.querySelector('.v19-rack-toggle');
  if(summary)summary.textContent=v19RackSummary(rack);const collapsed=shell.classList.contains('collapsed');if(word)word.textContent=collapsed?'Show':'Hide';if(toggle)toggle.setAttribute('aria-expanded',String(!collapsed));shell.dataset.context=context;
}
function v19EnhanceRack(rack){
  if(!rack)return;const select=rack.querySelector('[data-v17-board]');if(select)v19PopulateBoardSelect(select);
  let shell=rack.parentElement?.classList.contains('v19-rack-shell')?rack.parentElement:null;
  if(!shell){
    const context=v19RackContext(rack);shell=document.createElement('section');shell.className='v19-rack-shell';shell.dataset.context=context;
    const toggle=document.createElement('button');toggle.type='button';toggle.className='v19-rack-toggle';toggle.innerHTML=`<span class="v19-rack-icon"><i></i><i></i><i></i></span><span class="v19-rack-copy"><strong>M&B Performance Rack</strong><small data-v19-rack-summary></small></span><span class="v19-rack-action"><b data-v19-rack-word>Hide</b><i>⌄</i></span>`;
    rack.before(shell);shell.append(toggle,rack);shell.classList.toggle('collapsed',v19RackCollapsed(context));
    toggle.addEventListener('click',()=>{const next=!shell.classList.contains('collapsed');shell.classList.toggle('collapsed',next);v19SaveRackCollapsed(shell.dataset.context||context,next);v19SyncRackShell(shell)});
    shell.addEventListener('change',()=>requestAnimationFrame(()=>v19SyncRackShell(shell)));
    shell.addEventListener('click',e=>{if(e.target.closest('[data-v17-stomp]'))requestAnimationFrame(()=>setTimeout(()=>v19SyncRackShell(shell),0))});
  }
  v19SyncRackShell(shell);
}
let v19ScanPending=false;
function v19Scan(){
  v19EnsureRateOptions();document.querySelectorAll('.v17-fx-rack').forEach(v19EnhanceRack);
}
function v19ScheduleScan(){if(v19ScanPending)return;v19ScanPending=true;requestAnimationFrame(()=>{v19ScanPending=false;v19Scan()})}
const v19Observer=new MutationObserver(v19ScheduleScan);v19Observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('pageshow',v19ScheduleScan);
requestAnimationFrame(v19Scan);
