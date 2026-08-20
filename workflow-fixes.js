// V3 musical-timing and iPad input refinements layered on top of app.js.
let recordBeatPreviewRunning=false;

function exactLoopBuffer(source,targetSeconds){
  const length=Math.max(1,Math.round(targetSeconds*ctx.sampleRate));
  const out=ctx.createBuffer(source.numberOfChannels,length,ctx.sampleRate);
  for(let c=0;c<source.numberOfChannels;c++){
    const src=source.getChannelData(c),dst=out.getChannelData(c);
    dst.set(src.subarray(0,Math.min(src.length,dst.length)));
  }
  return out;
}
function setSessionPlayingUI(on){
  sessionPlaying=on;
  const b=$('#playSessionBtn');if(!b)return;
  b.classList.toggle('active',on);b.textContent=on?'■ Stop session':'▶ Play session';
}
function startBackingAt(time,current){
  const backing=session.layers.filter(l=>l!==current&&l.buffer);
  if(!backing.length)return false;
  backing.forEach(l=>startSingleLayer(l,time));setSessionPlayingUI(true);return true;
}
async function recordLayerQuantized(){
  const l=sessionLayer();if(recordBusy||!l.source)return;
  await ensureAudio();
  if(l.source==='input'&&!micStream){const ok=await setupInput();if(!ok){updateRecordDisplay('INPUT','!','Connect or allow your audio input first');return}}
  if(!window.MediaRecorder){updateRecordDisplay('ERROR','!','Recording is unavailable in this browser');return}
  stopSession();stopScheduler();panic();recordBusy=true;renderSession();$('#recordLayerBtn').classList.add('counting');
  const countStart=ctx.currentTime+.12;
  if(session.countIn)countInVisual(countStart,session.countIn);else updateRecordDisplay('ARMED','1','Recording starts now');
  const recordStart=countStart+barSeconds(session.countIn,session.bpm),duration=barSeconds(session.bars,session.bpm),dest=ctx.createMediaStreamDestination(),source=getLayerBus(l);
  source.connect(dest);
  const types=['audio/mp4','audio/webm;codecs=opus','audio/webm'],mime=types.find(t=>MediaRecorder.isTypeSupported?.(t))||'';let rec;
  try{rec=new MediaRecorder(dest.stream,mime?{mimeType:mime}:undefined)}catch(e){console.warn(e);try{source.disconnect(dest)}catch{}recordBusy=false;renderSession();return}
  const chunks=[];let cycleStart=null,hadBacking=false;
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=async()=>{
    try{
      const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'}),decoded=await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      l.buffer=exactLoopBuffer(decoded,duration);l.blob=blob;l.recordedBpm=session.bpm;l.recordedBars=session.bars;ensureLayerGain(l);
    }catch(e){console.warn(e)}
    try{source.disconnect(dest)}catch{}
    recordBusy=false;$('#recordLayerBtn').classList.remove('recording','counting');updateRecordDisplay('CAPTURED','✓',`${session.bars} bars locked to the grid`);renderSession();
    if(l.buffer){
      if(hadBacking&&cycleStart){const elapsed=Math.max(0,ctx.currentTime-cycleStart),next=cycleStart+Math.ceil(elapsed/duration)*duration;startSingleLayer(l,next)}
      else{startSingleLayer(l);setSessionPlayingUI(true)}
    }
  };
  setTimeout(()=>{
    if(!recordBusy)return;
    cycleStart=ctx.currentTime+.035;rec.start(60);hadBacking=startBackingAt(cycleStart,l);
    $('#recordLayerBtn').classList.remove('counting');$('#recordLayerBtn').classList.add('recording');updateRecordDisplay('RECORDING','1.1','The layer will stop automatically on the bar line');
    if(l.source==='beats')scheduleBeatWindow(l.pattern,cycleStart,session.bars,session.bpm);
    for(let i=0;i<session.bars*4;i++)setTimeout(()=>{if(recordBusy)$('#recordCount').textContent=`${Math.floor(i/4)+1}.${i%4+1}`},Math.max(0,(cycleStart-ctx.currentTime)*1000)+i*60000/session.bpm);
    currentRecordTimer=setTimeout(()=>{if(rec.state!=='inactive')rec.stop()},duration*1000+35);
  },Math.max(0,(recordStart-ctx.currentTime)*1000));
}

// Replace the original record/redo button behavior without disturbing the rest of the app.
$('#recordLayerBtn').addEventListener('click',e=>{e.stopImmediatePropagation();recordLayerQuantized()},true);
$('#redoLayerBtn').addEventListener('click',e=>{e.stopImmediatePropagation();if(recordBusy)return;clearCurrentLayer();recordLayerQuantized()},true);

// Keep generated/style-switched beats live while Play mode is already running.
['playBeatStyle','generatePlayBeat','clearPlayBeat'].forEach(id=>$('#'+id)?.addEventListener('click',()=>setTimeout(()=>{
  if(playBeatRunning)startScheduler({mode:'play',pattern:playPattern,bpm:+$('#playBpm').value,metronome:$('#playMetronome').checked});
},0)));

async function setupInputDevice(deviceId=''){
  await ensureAudio();if(!navigator.mediaDevices?.getUserMedia)return false;
  try{
    if(micSource)try{micSource.disconnect()}catch{};if(micStream)micStream.getTracks().forEach(t=>t.stop());
    const audio={echoCancellation:false,noiseSuppression:false,autoGainControl:false};if(deviceId)audio.deviceId={exact:deviceId};
    micStream=await navigator.mediaDevices.getUserMedia({audio});micSource=ctx.createMediaStreamSource(micStream);micSource.connect(inputGain);return true;
  }catch(e){console.warn(e);return false}
}
async function listInputs(select){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'),current=select.value;
  select.innerHTML='<option value="">Default iPad input</option>'+devices.map(d=>`<option value="${d.deviceId}">${d.label||'Audio input'}</option>`).join('');
  if(devices.some(d=>d.deviceId===current))select.value=current;
}
function enhanceInputTool(){
  const box=$('#layerSourceTools .input-connect-box');if(!box||box.dataset.enhanced)return;box.dataset.enhanced='1';
  const old=$('#connectRecordInput');if(!old)return;
  const select=document.createElement('select');select.id='recordInputDevice';select.innerHTML='<option value="">Default iPad input</option>';box.insertBefore(select,old);
  const monitor=document.createElement('label');monitor.className='switch';monitor.innerHTML='<input id="recordMonitor" type="checkbox"><span></span><em>Monitor</em>';box.insertBefore(monitor,old);
  const fresh=old.cloneNode(true);old.replaceWith(fresh);
  fresh.addEventListener('click',async()=>{const ok=await setupInputDevice(select.value);fresh.textContent=ok?'Input ready ✓':'Try again';if(ok)await listInputs(select)});
  select.addEventListener('change',async()=>{const ok=await setupInputDevice(select.value);fresh.textContent=ok?'Input ready ✓':'Try again'});
  monitor.querySelector('input').addEventListener('change',e=>{if(!ctx)return;try{inputGain.disconnect(master)}catch{}if(e.target.checked)inputGain.connect(master)});
}
function enhanceBeatTool(){
  const seq=$('#recordSequencer');if(!seq)return;const row=seq.parentElement?.querySelector('.tool-row');if(!row||row.querySelector('#previewRecordBeat'))return;
  const b=document.createElement('button');b.id='previewRecordBeat';b.type='button';b.textContent='▶ Preview';row.appendChild(b);
  b.addEventListener('click',async()=>{await ensureAudio();recordBeatPreviewRunning=!recordBeatPreviewRunning;if(recordBeatPreviewRunning){startScheduler({mode:'recordTool',pattern:sessionLayer().pattern,bpm:session.bpm});b.textContent='■ Stop'}else{stopScheduler();b.textContent='▶ Preview'}});
}
const toolObserver=new MutationObserver(()=>{if(!$('#recordSequencer')&&recordBeatPreviewRunning){recordBeatPreviewRunning=false;stopScheduler()}enhanceInputTool();enhanceBeatTool()});
toolObserver.observe($('#layerSourceTools'),{childList:true,subtree:true});
