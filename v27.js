/* Music & Beats V27 — premium Play ARP control banks. */
const V27_ARP_PRIMARY=new Set(['mode','rate','octaves','range','gate','swing','motion']);
const V27_ARP_ADVANCED=new Set(['ratchet','offset','steps','distance','velocity','retrigger']);
let v27ArpQueued=false;

function v27ControlKey(label){
  return label?.dataset?.v22Control||label?.dataset?.v18Arp||label?.dataset?.v17Arp||'';
}
function v27BankMarkup(kind){
  const primary=kind==='primary';
  return `<section class="v27-arp-bank ${primary?'primary':'advanced'}" data-v27-bank="${kind}"><div class="v27-bank-head"><span><i></i>${primary?'PLAYBACK':'MOTION & MODULATION'}</span><small>${primary?'Timing · range · feel':'Pattern shaping · movement'}</small></div><div class="v27-bank-grid"></div></section>`;
}
function v27EnsureBank(deck,kind){
  let bank=deck.querySelector(`:scope > [data-v27-bank="${kind}"]`);
  if(!bank){deck.insertAdjacentHTML('beforeend',v27BankMarkup(kind));bank=deck.lastElementChild}
  return bank;
}
function v27DecorateControl(label){
  if(!label)return;
  const key=v27ControlKey(label);if(key)label.dataset.v27Control=key;
  label.classList.toggle('v27-knob-card',!!label.querySelector('.v22-arp-knob'));
  label.classList.toggle('v27-select-card',!!label.querySelector('select'));
  if(['mode','rate','motion'].includes(key))label.classList.add('v27-priority-control');
}
function v27ArrangePlayArp(){
  v27ArpQueued=false;
  if(typeof currentScreen!=='undefined'&&currentScreen!=='play')return;
  const panel=document.querySelector('#playScreen #v6ArpPanel'),deck=panel?.querySelector('.v26-arp-grid');
  if(!panel||!deck)return;
  panel.classList.add('v27-arp-polished');deck.classList.add('v27-arp-banks');
  const primary=v27EnsureBank(deck,'primary'),advanced=v27EnsureBank(deck,'advanced');
  const primaryGrid=primary.querySelector('.v27-bank-grid'),advancedGrid=advanced.querySelector('.v27-bank-grid');
  const labels=[...deck.querySelectorAll('label')];
  labels.forEach(label=>{
    v27DecorateControl(label);
    const key=v27ControlKey(label);
    const target=V27_ARP_ADVANCED.has(key)?advancedGrid:primaryGrid;
    if(label.parentElement!==target)target.appendChild(label);
  });
  primary.hidden=!primaryGrid.children.length;advanced.hidden=!advancedGrid.children.length;
}
function v27ScheduleArpPolish(){if(v27ArpQueued)return;v27ArpQueued=true;requestAnimationFrame(v27ArrangePlayArp)}

if(typeof v26NormalizePlayArpGrid==='function'){
  const v27BaseNormalize=v26NormalizePlayArpGrid;
  v26NormalizePlayArpGrid=function(){const out=v27BaseNormalize.apply(this,arguments);v27ScheduleArpPolish();return out};
}
if(typeof v24NormalizePlayArp==='function'){
  const v27BaseV24Normalize=v24NormalizePlayArp;
  v24NormalizePlayArp=function(arp){const out=v27BaseV24Normalize.apply(this,arguments);if(arp?.id==='v6ArpPanel')v27ScheduleArpPolish();return out};
}

document.addEventListener('musicandbeats:drawerchange',e=>{if(e.detail?.id==='arp'&&!e.detail?.collapsed)v27ScheduleArpPolish()});
window.addEventListener('pageshow',v27ScheduleArpPolish,{passive:true});
window.addEventListener('orientationchange',v27ScheduleArpPolish,{passive:true});
v27ScheduleArpPolish();
