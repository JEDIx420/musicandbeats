/* Music & Beats V16 — cross-device UI stability sweep. */
let v16ViewportResize=false;
let v16LastArpPaint=-2;

function v16WidthBucket(){
  const w=window.innerWidth||document.documentElement.clientWidth||1024;
  return w<560?'phone':w<700?'compact':w<1050?'tablet':'desktop';
}
let v16LastWidthBucket=v16WidthBucket();

/* Safari/iPad changes the visual viewport when browser chrome appears/disappears.
   The legacy resize listener rebuilds whole instrument panels on every such event.
   Mark resize delivery in capture phase, then only permit a rebuild if a real
   responsive breakpoint was crossed. */
window.addEventListener('resize',()=>{
  v16ViewportResize=true;
  requestAnimationFrame(()=>{v16ViewportResize=false});
},true);
window.visualViewport?.addEventListener('resize',()=>{
  v16ViewportResize=true;
  requestAnimationFrame(()=>{v16ViewportResize=false});
},{passive:true});

const v16BaseRenderPlayInstrument=renderPlayInstrument;
renderPlayInstrument=function(){
  if(v16ViewportResize){
    const next=v16WidthBucket();
    if(next===v16LastWidthBucket)return;
    v16LastWidthBucket=next;
  }
  return v16BaseRenderPlayInstrument.apply(this,arguments);
};

const v16BaseRenderLayerTools=renderLayerTools;
renderLayerTools=function(){
  if(v16ViewportResize){
    const next=v16WidthBucket();
    if(next===v16LastWidthBucket)return;
    v16LastWidthBucket=next;
  }
  return v16BaseRenderLayerTools.apply(this,arguments);
};

/* Arp visualisation: mutate only the old/new lane rather than all eight lanes
   every note. Keeping this as a cheap class swap prevents whole-panel repaints
   on iPad Safari. */
v6PaintArp=function(index=-1){
  const lanes=$$('.v6-arp-lane');
  const next=index<0?-1:index%Math.max(1,lanes.length);
  if(next===v16LastArpPaint)return;
  if(v16LastArpPaint>=0)lanes[v16LastArpPaint]?.classList.remove('hot');
  if(next>=0)lanes[next]?.classList.add('hot');
  v16LastArpPaint=next;
};

/* Record beat controls: keep genre/energy in layer state and update only the
   sequencer. Do not rebuild the entire layer tool DOM after Generate. */
v15EnhanceRecordBeat=function(){
  if(currentScreen!=='record'||!session.layers?.length)return;
  const l=sessionLayer();if(l.source!=='beats')return;
  const style=$('#recordBeatStyle'),energy=$('#recordEnergy'),box=$('#layerSourceTools .tool-box');
  if(!style||!energy||!box)return;
  const s=v15BeatState(l);style.value=s.style;energy.value=s.energy;
  const styleLabel=style.closest('label');
  if(styleLabel&&styleLabel.firstChild?.nodeType===3)styleLabel.firstChild.textContent='Genre';
  let feel=box.querySelector('.v15-beat-feel');
  if(!feel){styleLabel?.insertAdjacentHTML('beforeend',v15BeatFeelMarkup(s.style));feel=box.querySelector('.v15-beat-feel')}
  const refreshFeel=()=>{
    const f=V15_BEAT_FEELS[l.beatStyle]||V15_BEAT_FEELS.Worship;
    if(feel){
      feel.dataset.feel=f.accent;
      const text=[...feel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
      if(text)text.nodeValue=f.tag;
    }
  };
  style.onchange=()=>{l.beatStyle=style.value;refreshFeel()};
  energy.oninput=()=>{l.beatEnergy=+energy.value};
  const old=$('#generateRecordBeat');
  if(old&&!old.dataset.v16){
    const fresh=old.cloneNode(true);fresh.dataset.v16='1';old.replaceWith(fresh);
    fresh.addEventListener('click',()=>{
      l.beatStyle=style.value;l.beatEnergy=+energy.value;
      l.pattern=loadBeat(l.beatStyle,l.beatEnergy,true);
      renderSequencer('#recordSequencer',l.pattern);
      refreshFeel();
    });
  }
  const clear=$('#clearRecordBeat');
  if(clear&&!clear.dataset.v16){
    const fresh=clear.cloneNode(true);fresh.dataset.v16='1';clear.replaceWith(fresh);
    fresh.addEventListener('click',()=>{clearPattern(l.pattern);renderSequencer('#recordSequencer',l.pattern)});
  }
};

/* Record Bass Arp: toggles and settings update in place. The V15 version
   rebuilt the whole bass tool/keyboard when ARP power changed, which caused
   the exact screen jump seen when enabling it. */
v15EnhanceRecordBass=function(){
  if(currentScreen!=='record'||!session.layers?.length)return;
  const l=sessionLayer();if(l.source!=='bass')return;
  const host=$('#recordKeyboard'),box=$('#layerSourceTools .tool-box');if(!host||!box)return;
  let panel=box.querySelector('[data-v15-record-arp]');
  if(!panel){host.insertAdjacentHTML('beforebegin',v15RecordBassArpMarkup(l));panel=box.querySelector('[data-v15-record-arp]')}
  v15ApplyRecordArpState(l);v15BindBassKeyboard(host,'record');
  const sync=()=>{
    const s=v15RecordArpState(l),power=panel.querySelector('[data-v15-arp-power]'),latch=panel.querySelector('[data-v15-latch]');
    panel.classList.toggle('active',!!s.enabled);
    if(power)power.textContent=s.enabled?'ON':'OFF';
    if(latch){latch.classList.toggle('active',!!s.latch);latch.textContent=s.latch?'Latch ON':'Latch'}
  };
  const power=panel.querySelector('[data-v15-arp-power]');
  power.onclick=()=>{const s=v15RecordArpState(l);s.enabled=!s.enabled;if(!s.enabled)v15HardStopArp();v15ApplyRecordArpState(l);sync()};
  panel.querySelectorAll('[data-v15-arp]').forEach(el=>el.oninput=()=>{const s=v15RecordArpState(l),k=el.dataset.v15Arp;s[k]=k==='octaves'?+el.value:k==='gate'?+el.value:el.value;v15ApplyRecordArpState(l)});
  panel.querySelector('[data-v15-latch]').onclick=()=>{const s=v15RecordArpState(l);s.latch=!s.latch;v15ApplyRecordArpState(l);sync()};
  panel.querySelector('[data-v15-stop]').onclick=()=>v15HardStopArp();
  sync();
};

window.addEventListener('orientationchange',()=>requestAnimationFrame(()=>{v16LastWidthBucket=v16WidthBucket()}),{passive:true});
document.documentElement.classList.add('v16-ui-stable');
requestAnimationFrame(()=>document.documentElement.classList.add('v16-ui-ready'));
