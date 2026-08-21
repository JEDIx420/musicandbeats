/* Music & Beats V29 — authoritative Play ARP interaction bridge. */
(()=>{
  const panel=()=>document.querySelector('#playScreen #v6ArpPanel');
  const numeric=new Set(['octaves','gate','swing','ratchet','offset','steps','distance']);
  const keyOf=el=>el?.dataset?.arp||el?.dataset?.v17Arp||el?.dataset?.v18Arp||'';
  const normalizeKey=k=>k==='velocity'?'velocityMode':k;
  function commit(el){
    if(!el||!panel()?.contains(el))return;
    let k=normalizeKey(keyOf(el));if(!k)return;
    const value=numeric.has(k)?+el.value:el.value;
    try{v6Arp[k]=value}catch{}
    try{if(typeof V17_PLAY_ARP!=='undefined')V17_PLAY_ARP[k]=value}catch{}
    try{if(typeof v17CaptureArpState==='function'&&typeof V17_PLAY_ARP!=='undefined')v17CaptureArpState(V17_PLAY_ARP)}catch{}
    try{v18SyncArpPresentation?.()}catch{}
  }
  document.addEventListener('input',e=>{const el=e.target.closest?.('#playScreen #v6ArpPanel [data-arp],#playScreen #v6ArpPanel [data-v17-arp],#playScreen #v6ArpPanel [data-v18-arp]');if(el)commit(el)},true);
  document.addEventListener('change',e=>{const el=e.target.closest?.('#playScreen #v6ArpPanel [data-arp],#playScreen #v6ArpPanel [data-v17-arp],#playScreen #v6ArpPanel [data-v18-arp]');if(el)commit(el)},true);
  document.addEventListener('click',e=>{
    const power=e.target.closest?.('#playScreen #v6ArpPanel .v6-arp-power');
    if(power)setTimeout(()=>{try{if(typeof V17_PLAY_ARP!=='undefined')V17_PLAY_ARP.enabled=!!v6Arp.enabled}catch{}},0);
  },true);

  function knobSource(knob){return knob?.closest('label')?.querySelector('[data-arp],[data-v17-arp],[data-v18-arp]')||null}
  function knobText(source){
    if(source?.tagName==='SELECT')return source.options[source.selectedIndex]?.textContent?.trim()||source.value;
    const k=normalizeKey(keyOf(source)),v=+source.value;
    if(k==='swing')return `${Math.round(v)}%`;
    if(k==='gate')return v.toFixed(2);
    return String(Math.round(v*100)/100);
  }
  function paintKnob(knob,source){
    if(!knob||!source)return;
    let min,max,val;
    if(source.tagName==='SELECT'){min=0;max=Math.max(1,source.options.length-1);val=Math.max(0,source.selectedIndex)}
    else{min=+(source.min||0);max=+(source.max||1);val=+source.value}
    const p=Math.max(0,Math.min(1,(val-min)/(max-min||1))),deg=-135+p*270;
    knob.style.setProperty('--angle',`${deg}deg`);
    knob.setAttribute('aria-valuenow',String(val));
    const out=knob.querySelector('b');if(out)out.textContent=knobText(source);
  }
  function setSource(source,nextIndexOrValue){
    if(source.tagName==='SELECT'){
      const idx=Math.max(0,Math.min(source.options.length-1,Math.round(nextIndexOrValue)));
      if(source.selectedIndex===idx)return;source.selectedIndex=idx;
    }else{
      const min=+(source.min||0),max=+(source.max||1),step=+(source.step||.01);
      const v=Math.max(min,Math.min(max,Math.round(nextIndexOrValue/step)*step));
      if(+source.value===v)return;source.value=String(v);
    }
    source.dispatchEvent(new Event('input',{bubbles:true}));
    source.dispatchEvent(new Event('change',{bubbles:true}));
  }
  let drag=null;
  function begin(e,knob){
    const source=knobSource(knob);if(!source)return;
    e.preventDefault();e.stopPropagation();
    drag={knob,source,pointerId:e.pointerId,startY:e.clientY,start:source.tagName==='SELECT'?source.selectedIndex:+source.value};
    knob.classList.add('v29-turning');paintKnob(knob,source);
  }
  function move(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    e.preventDefault();
    const {knob,source,startY,start}=drag,dy=startY-e.clientY;
    if(source.tagName==='SELECT')setSource(source,start+Math.round(dy/28));
    else{const min=+(source.min||0),max=+(source.max||1);setSource(source,start+(dy/130)*(max-min))}
    paintKnob(knob,source);
  }
  function end(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    paintKnob(drag.knob,drag.source);drag.knob.classList.remove('v29-turning');drag=null;
  }
  document.addEventListener('pointerdown',e=>{const knob=e.target.closest?.('#playScreen #v6ArpPanel .v22-arp-knob');if(knob)begin(e,knob)},true);
  window.addEventListener('pointermove',move,{capture:true,passive:false});
  window.addEventListener('pointerup',end,true);window.addEventListener('pointercancel',end,true);
  document.addEventListener('keydown',e=>{
    const knob=e.target.closest?.('#playScreen #v6ArpPanel .v22-arp-knob');if(!knob||!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key))return;
    const source=knobSource(knob);if(!source)return;e.preventDefault();
    const dir=['ArrowUp','ArrowRight'].includes(e.key)?1:-1;
    if(source.tagName==='SELECT')setSource(source,source.selectedIndex+dir);
    else setSource(source,+source.value+dir*+(source.step||.01));
    paintKnob(knob,source);
  },true);
  function revive(){
    const p=panel();if(!p)return;
    p.removeAttribute('inert');try{p.inert=false}catch{}
    p.querySelectorAll('.v6-arp-body,.v26-arp-grid,.v28-arp-deck,.v28-live-control,select,.v22-arp-knob').forEach(el=>{el.removeAttribute('inert');try{el.inert=false}catch{};if('disabled'in el&&el.matches('select,.v22-arp-knob'))el.disabled=false});
    p.querySelectorAll('.v22-arp-knob').forEach(k=>{k.dataset.v29='1';paintKnob(k,knobSource(k))});
  }
  const mo=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.v22-arp-knob,.v28-live-control,.v26-arp-grid')||n.querySelector?.('.v22-arp-knob,.v28-live-control,.v26-arp-grid')))))requestAnimationFrame(revive)});
  const host=document.querySelector('#playScreen');if(host)mo.observe(host,{childList:true,subtree:true});
  window.addEventListener('pageshow',()=>requestAnimationFrame(revive),{passive:true});
  window.addEventListener('orientationchange',()=>requestAnimationFrame(revive),{passive:true});
  requestAnimationFrame(revive);
})();
