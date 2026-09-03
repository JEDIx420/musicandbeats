/* Music & Beats V22 — audio-reactive ARP scope + compact hardware control deck. */
const V22_ARP_VIS={analyser:null,tap:null,source:null,data:null,raf:0,lastTrigger:0,step:-1,rms:0};
let v22ArpScanQueued=false;

function v22ArpKind(panel){
  if(panel?.matches?.('[data-v18-record-arp="bass"]'))return'bass';
  if(panel?.matches?.('[data-v18-record-arp="smart"]'))return'smart';
  return typeof playInstrument==='string'&&playInstrument==='bass'?'bass':'smart';
}
function v22EnsureArpAnalyser(){
  try{
    if(!ctx)buildAudio();
    if(!ctx)return null;
    if(typeof v17EnsureSynthRack==='function')v17EnsureSynthRack();
    const source=(typeof v17SynthRack!=='undefined'&&v17SynthRack?.comp)?v17SynthRack.comp:synthBus;
    if(!source)return null;
    if(V22_ARP_VIS.analyser&&V22_ARP_VIS.source===source)return V22_ARP_VIS.analyser;
    const analyser=ctx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.68;
    const tap=ctx.createGain();tap.gain.value=0;
    source.connect(analyser);analyser.connect(tap).connect(ctx.destination);
    V22_ARP_VIS.analyser=analyser;V22_ARP_VIS.tap=tap;V22_ARP_VIS.source=source;V22_ARP_VIS.data=new Uint8Array(analyser.fftSize);
    return analyser;
  }catch(e){console.warn('V22 ARP analyser unavailable',e);return null}
}
function v22ArpBpm(){return v6Arp?.target?.bpm||clamp(+($('#playBpm')?.value||session?.bpm||100),40,220)}
function v22ArpRateLabel(){return v6Arp?.rate||'1/8'}
function v22ResizeCanvas(canvas){
  const box=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}return{w,h,dpr};
}
function v22DrawScope(canvas,now){
  const g=canvas.getContext('2d'),{w,h,dpr}=v22ResizeCanvas(canvas),analyser=v22EnsureArpAnalyser(),data=V22_ARP_VIS.data;
  g.clearRect(0,0,w,h);
  const gridX=w/8,gridY=h/4;g.save();g.strokeStyle='rgba(98,226,255,.075)';g.lineWidth=Math.max(1,dpr*.55);
  for(let i=1;i<8;i++){g.beginPath();g.moveTo(i*gridX,0);g.lineTo(i*gridX,h);g.stroke()}
  for(let i=1;i<4;i++){g.beginPath();g.moveTo(0,i*gridY);g.lineTo(w,i*gridY);g.stroke()}g.restore();
  let rms=0;
  if(analyser&&data){analyser.getByteTimeDomainData(data);for(let i=0;i<data.length;i++){const x=(data[i]-128)/128;rms+=x*x}rms=Math.sqrt(rms/data.length)}
  V22_ARP_VIS.rms=V22_ARP_VIS.rms*.72+rms*.28;
  const pulse=Math.max(0,1-(now-V22_ARP_VIS.lastTrigger)/180),amp=Math.min(1,.15+V22_ARP_VIS.rms*5.5+pulse*.35);
  const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'rgba(100,226,255,.9)');grad.addColorStop(.52,'rgba(144,124,255,1)');grad.addColorStop(1,'rgba(104,244,199,.92)');
  g.save();g.strokeStyle=grad;g.lineWidth=(1.45+amp*1.8)*dpr;g.shadowColor='rgba(102,229,255,.82)';g.shadowBlur=(5+amp*15)*dpr;g.beginPath();
  if(analyser&&data){for(let i=0;i<data.length;i++){const x=i/(data.length-1)*w,y=h*.5+((data[i]-128)/128)*h*(.22+.18*amp);i?g.lineTo(x,y):g.moveTo(x,y)}}else{g.moveTo(0,h*.5);g.lineTo(w,h*.5)}
  g.stroke();g.restore();
  if(V22_ARP_VIS.step>=0){const sx=((V22_ARP_VIS.step%8)+.5)*gridX;g.save();const beam=g.createLinearGradient(sx,0,sx,h);beam.addColorStop(0,'rgba(126,246,211,0)');beam.addColorStop(.5,`rgba(126,246,211,${.2+.62*pulse})`);beam.addColorStop(1,'rgba(126,246,211,0)');g.strokeStyle=beam;g.lineWidth=(1+3*pulse)*dpr;g.shadowColor='#79f7c7';g.shadowBlur=14*pulse*dpr;g.beginPath();g.moveTo(sx,0);g.lineTo(sx,h);g.stroke();g.restore()}
  const active=!!v6Arp?.enabled&&!!v6Arp?.timer;canvas.closest('.v22-arp-scope')?.classList.toggle('running',active);
  const meter=canvas.closest('.v22-arp-scope')?.querySelector('[data-v22-meter]');if(meter)meter.style.setProperty('--level',String(Math.min(1,V22_ARP_VIS.rms*7+pulse*.18)));
  const readout=canvas.closest('.v22-arp-scope')?.querySelector('[data-v22-readout]');if(readout)readout.textContent=`${v22ArpRateLabel()} · ${Math.round(v22ArpBpm())} BPM`;
}
function v22VisualizerLoop(now){
  const canvases=[...document.querySelectorAll('.v22-arp-scope canvas')];
  canvases.forEach(c=>{if(c.offsetParent!==null)v22DrawScope(c,now)});
  if(canvases.length)V22_ARP_VIS.raf=requestAnimationFrame(v22VisualizerLoop);else V22_ARP_VIS.raf=0;
}
function v22StartVisualizer(){if(!V22_ARP_VIS.raf)V22_ARP_VIS.raf=requestAnimationFrame(v22VisualizerLoop)}

const v22BasePaintArp=typeof v6PaintArp==='function'?v6PaintArp:null;
v6PaintArp=function(index=-1){
  try{v22BasePaintArp?.(index)}catch{}
  V22_ARP_VIS.step=index<0?-1:index%8;if(index>=0)V22_ARP_VIS.lastTrigger=performance.now();
  document.querySelectorAll('.v22-rhythm-pattern button').forEach((b,i)=>b.classList.toggle('current',index>=0&&i===index%8));
  v22StartVisualizer();
};

function v22ScopeMarkup(kind){return `<div class="v22-arp-scope ${kind==='bass'?'bass':''}"><canvas aria-label="Live arpeggiator audio visualizer"></canvas><div class="v22-scope-top"><span><i></i>${kind==='bass'?'BASS SIGNAL':'ARP SIGNAL'}</span><b data-v22-readout>1/8 · 100 BPM</b></div><div class="v22-level" data-v22-meter><i></i></div><div class="v22-rhythm-slot"></div></div>`}
function v22UpgradeWave(panel){
  const wave=panel.querySelector('.v18-arp-wave');if(!wave||wave.dataset.v22==='1')return;
  wave.dataset.v22='1';wave.classList.add('v22-wave-host');wave.innerHTML=v22ScopeMarkup(v22ArpKind(panel));
  const pattern=panel.querySelector('.v17-pattern,.v18-arp-pattern');if(pattern){pattern.classList.add('v22-rhythm-pattern');wave.querySelector('.v22-rhythm-slot')?.appendChild(pattern)}
  v22StartVisualizer();
}
function v22ControlKey(label){
  const el=label.querySelector('[data-v18-arp],[data-v17-arp]');return el?.dataset?.v18Arp||el?.dataset?.v17Arp||[...label.childNodes].find(n=>n.nodeType===3)?.textContent?.trim()?.toLowerCase().replace(/\s+/g,'-')||'control';
}
function v22KnobAngle(value,min,max){const p=(+value-min)/(max-min||1);return-135+Math.max(0,Math.min(1,p))*270}
function v22SetKnobVisual(knob,value,min,max,text){knob.style.setProperty('--angle',`${v22KnobAngle(value,min,max)}deg`);const out=knob.querySelector('b');if(out)out.textContent=text}
function v22BindRangeKnob(label,input,key){
  if(label.dataset.v22Knob)return;label.dataset.v22Knob='range';input.classList.add('v22-native-hidden');
  const min=+(input.min||0),max=+(input.max||1),step=+(input.step||.01),knob=document.createElement('button');knob.type='button';knob.className='v22-arp-knob';knob.setAttribute('role','slider');
  const fmt=v=>key==='swing'?`${Math.round(v)}%`:key==='gate'?Number(v).toFixed(2):Number(v).toFixed(step<1?2:0);
  knob.innerHTML='<span><i></i></span><b></b>';input.before(knob);
  const sync=()=>{v22SetKnobVisual(knob,+input.value,min,max,fmt(+input.value));knob.setAttribute('aria-valuenow',input.value)};sync();
  let startY=0,start=0;
  knob.addEventListener('pointerdown',e=>{e.preventDefault();startY=e.clientY;start=+input.value;try{knob.setPointerCapture(e.pointerId)}catch{}});
  knob.addEventListener('pointermove',e=>{if(!knob.hasPointerCapture?.(e.pointerId))return;const range=max-min,next=Math.max(min,Math.min(max,start+(startY-e.clientY)/125*range));input.value=String(Math.round(next/step)*step);input.dispatchEvent(new Event('input',{bubbles:true}));sync()});
  const end=e=>{if(knob.hasPointerCapture?.(e.pointerId)){try{knob.releasePointerCapture(e.pointerId)}catch{}input.dispatchEvent(new Event('change',{bubbles:true}));sync()}};knob.addEventListener('pointerup',end);knob.addEventListener('pointercancel',end);
  knob.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key))return;e.preventDefault();const dir=['ArrowUp','ArrowRight'].includes(e.key)?1:-1;input.value=String(Math.max(min,Math.min(max,+input.value+dir*step)));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));sync()});
}
function v22BindSelectKnob(label,select,key){
  if(label.dataset.v22Knob)return;label.dataset.v22Knob='steps';select.classList.add('v22-native-hidden');
  const opts=[...select.options],knob=document.createElement('button');knob.type='button';knob.className='v22-arp-knob stepped';knob.setAttribute('role','slider');knob.innerHTML='<span><i></i></span><b></b>';select.before(knob);
  const sync=()=>{const idx=Math.max(0,select.selectedIndex),text=opts[idx]?.textContent?.replace(/\s*oct$/i,'')||select.value;v22SetKnobVisual(knob,idx,0,Math.max(1,opts.length-1),text);knob.setAttribute('aria-valuenow',String(idx))};sync();
  let startY=0,start=0;
  const setIndex=idx=>{idx=Math.max(0,Math.min(opts.length-1,idx));if(select.selectedIndex===idx)return;select.selectedIndex=idx;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));sync()};
  knob.addEventListener('pointerdown',e=>{e.preventDefault();startY=e.clientY;start=select.selectedIndex;try{knob.setPointerCapture(e.pointerId)}catch{}});
  knob.addEventListener('pointermove',e=>{if(!knob.hasPointerCapture?.(e.pointerId))return;const delta=Math.round((startY-e.clientY)/28);setIndex(start+delta)});
  knob.addEventListener('pointerup',e=>{try{knob.releasePointerCapture(e.pointerId)}catch{}});knob.addEventListener('pointercancel',e=>{try{knob.releasePointerCapture(e.pointerId)}catch{}});
  knob.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key))return;e.preventDefault();setIndex(select.selectedIndex+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1))});
}
function v22UpgradeControls(panel){
  const deck=panel.querySelector('.v18-arp-deck,.v18-record-arp-deck');if(!deck)return;deck.classList.add('v22-arp-deck');
  const header=panel.querySelector('.panel-head,.v17-record-arp-head');if(header){
    let actions=header.querySelector('.v22-arp-head-actions');if(!actions){actions=document.createElement('div');actions.className='v22-arp-head-actions';header.appendChild(actions)}
    const power=panel.querySelector('.v6-arp-power,.v17-arp-rocker[data-v17-power]');const stop=panel.querySelector('.v18-arp-stop,[data-v15-stop],[data-v17-stop],[data-arp-action="panic"]');
    if(power&&!actions.contains(power))actions.appendChild(power);if(stop&&!actions.contains(stop)){stop.classList.add('v22-stop');actions.appendChild(stop)}
  }
  [...deck.querySelectorAll(':scope > label')].forEach(label=>{
    const key=v22ControlKey(label);label.dataset.v22Control=key;
    const range=label.querySelector('input[type="range"]'),select=label.querySelector('select');
    if(range&&['gate','swing'].includes(key))v22BindRangeKnob(label,range,key);
    else if(select&&['octaves','range','ratchet','steps','offset'].includes(key))v22BindSelectKnob(label,select,key);
    else if(select)label.classList.add('v22-lcd-control');
  });
}
function v22UpgradeArpPanel(panel){
  if(!panel)return;panel.classList.add('v22-arp-machine');if(panel.matches('.v18-record-arp'))panel.classList.add('v22-record-arp');
  v22UpgradeWave(panel);v22UpgradeControls(panel);
}
function v22ScanArpUI(){document.querySelectorAll('#v6ArpPanel.v18-arp-machine,.v18-record-arp').forEach(v22UpgradeArpPanel)}
function v22ScheduleArpScan(){if(v22ArpScanQueued)return;v22ArpScanQueued=true;requestAnimationFrame(()=>{v22ArpScanQueued=false;v22ScanArpUI()})}

/* Keep the scope pulse state honest when the arp transport stops. */
const v22BaseSyncArpUI=typeof v6SyncArpUI==='function'?v6SyncArpUI:null;
v6SyncArpUI=function(){const out=v22BaseSyncArpUI?.();if(!v6Arp?.enabled){V22_ARP_VIS.step=-1;document.querySelectorAll('.v22-rhythm-pattern button.current').forEach(b=>b.classList.remove('current'))}v22ScheduleArpScan();return out};

v22ScanArpUI();
new MutationObserver(v22ScheduleArpScan).observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize',v22ScheduleArpScan,{passive:true});
