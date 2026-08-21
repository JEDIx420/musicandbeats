/* Music & Beats V28 — restore live ARP control topology while preserving V27 visual hierarchy. */
const V28_PRIMARY_ORDER=['mode','rate','octaves','range','gate','swing','motion'];
const V28_ADVANCED_ORDER=['ratchet','offset','steps','distance','velocity','retrigger'];
let v28Queued=false;

function v28Key(label){return label?.dataset?.v27Control||label?.dataset?.v22Control||label?.dataset?.v18Arp||label?.dataset?.v17Arp||''}
function v28Header(kind){
  const primary=kind==='primary';
  const el=document.createElement('div');
  el.className=`v28-bank-header ${kind}`;
  el.dataset.v28Header=kind;
  el.innerHTML=`<span><i></i>${primary?'PLAYBACK':'MOTION & MODULATION'}</span><small>${primary?'Timing · range · feel':'Pattern shaping · movement'}</small>`;
  return el;
}
function v28SortControls(labels,order){
  return [...labels].sort((a,b)=>{
    const ak=v28Key(a),bk=v28Key(b),ai=order.indexOf(ak),bi=order.indexOf(bk);
    return (ai<0?999:ai)-(bi<0?999:bi);
  });
}
function v28RestorePlayArp(){
  v28Queued=false;
  if(typeof currentScreen!=='undefined'&&currentScreen!=='play')return;
  const panel=document.querySelector('#playScreen #v6ArpPanel');
  const deck=panel?.querySelector('.v26-arp-grid');
  if(!panel||!deck)return;

  panel.classList.remove('v27-arp-polished');
  panel.classList.add('v28-arp-live');
  deck.classList.remove('v27-arp-banks');
  deck.classList.add('v28-arp-deck');

  /* Pull the original, already-bound controls out of V27 wrappers. */
  const labels=[...deck.querySelectorAll('label')];
  const primary=[],advanced=[];
  labels.forEach(label=>{
    const key=v28Key(label);
    label.dataset.v28Control=key;
    label.classList.add('v28-live-control');
    label.removeAttribute('inert');
    try{label.inert=false}catch{}
    const select=label.querySelector('select');
    if(select){select.disabled=false;select.removeAttribute('inert');try{select.inert=false}catch{}}
    const knob=label.querySelector('.v22-arp-knob');
    if(knob){knob.disabled=false;knob.removeAttribute('inert');try{knob.inert=false}catch{}}
    (V28_ADVANCED_ORDER.includes(key)?advanced:primary).push(label);
  });

  /* Remove only V27's presentation wrappers, never clone/replace a live control. */
  deck.querySelectorAll(':scope > .v27-arp-bank,:scope > .v28-bank-header').forEach(n=>n.remove());

  const pHead=v28Header('primary'),aHead=v28Header('advanced');
  deck.appendChild(pHead);
  v28SortControls(primary,V28_PRIMARY_ORDER).forEach(label=>deck.appendChild(label));
  deck.appendChild(aHead);
  v28SortControls(advanced,V28_ADVANCED_ORDER).forEach(label=>deck.appendChild(label));

  pHead.hidden=!primary.length;aHead.hidden=!advanced.length;

  /* Explicitly restore interaction on Safari/iPad after prior inert drawer states. */
  deck.removeAttribute('inert');try{deck.inert=false}catch{}
  deck.style.pointerEvents='auto';
}
function v28Schedule(){if(v28Queued)return;v28Queued=true;requestAnimationFrame(v28RestorePlayArp)}

/* V28 owns the final Play-ARP presentation after V26/V27 normalization. */
if(typeof v24NormalizePlayArp==='function'){
  const base=v24NormalizePlayArp;
  v24NormalizePlayArp=function(arp){const out=base.apply(this,arguments);if(arp?.id==='v6ArpPanel')v28Schedule();return out};
}
if(typeof v26NormalizePlayArpGrid==='function'){
  const base=v26NormalizePlayArpGrid;
  v26NormalizePlayArpGrid=function(){const out=base.apply(this,arguments);v28Schedule();return out};
}

/* If a selector/knob is touched, do not let a later cosmetic scan interrupt it. */
let v28Interacting=false;
document.addEventListener('pointerdown',e=>{if(e.target.closest?.('#playScreen #v6ArpPanel .v28-live-control'))v28Interacting=true},true);
document.addEventListener('pointerup',()=>{v28Interacting=false},true);
document.addEventListener('pointercancel',()=>{v28Interacting=false},true);
document.addEventListener('change',e=>{if(e.target.closest?.('#playScreen #v6ArpPanel'))setTimeout(v28Schedule,0)},true);
document.addEventListener('musicandbeats:drawerchange',e=>{if(e.detail?.id==='arp'&&!e.detail?.collapsed)v28Schedule()});
window.addEventListener('pageshow',v28Schedule,{passive:true});
window.addEventListener('orientationchange',v28Schedule,{passive:true});
requestAnimationFrame(v28RestorePlayArp);
