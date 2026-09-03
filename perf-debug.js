/* Music & Beats performance diagnostics — loaded only with ?debug=perf. */
(()=>{
  const params=new URLSearchParams(location.search);
  if(params.get('debug')!=='perf'||window.MB_PERF)return;

  const now=()=>performance.now();
  const totals={
    arpTicks:0,arpTickMs:0,voiceStarts:0,voiceStartMs:0,oscStarts:0,
    liveVoices:0,liveOscillators:0,peakLiveVoices:0,peakLiveOscillators:0,
    fxCalls:0,fxMs:0,primeCalls:0,primeMs:0,scopeFrames:0,scopeMs:0,
    playBuilds:0,playBuildMs:0,arpNormalizes:0,arpNormalizeMs:0,
    v28Restores:0,v28RestoreMs:0,domMutations:0,domAdded:0,domRemoved:0,
    longTasks:0,longTaskMs:0,eventLoopLagMax:0
  };
  const last={...totals};
  const rates={};
  const samples=[];
  const reports=[];
  let sampleTimer=0,sampleEndsAt=0,sampleLabel='';
  let fps=0,frames=0,fpsWindow=now();
  let panel=null,lastSnapshot=null;

  function inc(key,n=1){totals[key]=(totals[key]||0)+n}
  function timed(key,countKey,fn,ctx,args){
    const t=now();
    try{return fn.apply(ctx,args)}finally{inc(countKey);totals[key]+=now()-t}
  }
  function presetForVoice(name){try{return SOUND_PRESETS?.[name]||SOUND_PRESETS?.['Studio Grand']||null}catch{return null}}
  function estimateReleaseMs(presetName){
    try{
      const p=presetForVoice(presetName),x=typeof v4Expr==='function'?v4Expr():{sustain:.8};
      return Math.max(35,((x?.sustain||.8)*.68+(p?.release||.4)*.34)*1000+55);
    }catch{return 450}
  }
  function trackVoiceLifetime(voice,presetName,oscCount){
    if(!voice||typeof voice!=='object')return voice;
    inc('liveVoices');inc('liveOscillators',oscCount);
    totals.peakLiveVoices=Math.max(totals.peakLiveVoices,totals.liveVoices);
    totals.peakLiveOscillators=Math.max(totals.peakLiveOscillators,totals.liveOscillators);
    let releaseScheduled=false,finished=false;
    const finish=()=>{
      if(finished)return;finished=true;
      totals.liveVoices=Math.max(0,totals.liveVoices-1);
      totals.liveOscillators=Math.max(0,totals.liveOscillators-oscCount);
    };
    const scheduleFinish=ms=>{
      if(releaseScheduled)return;releaseScheduled=true;
      window.setTimeout(finish,Math.max(0,ms));
    };
    if(typeof voice.stop==='function'){
      const base=voice.stop;
      voice.stop=function(){scheduleFinish(estimateReleaseMs(presetName));return base.apply(this,arguments)};
    }
    if(typeof voice.hardStop==='function'){
      const base=voice.hardStop;
      voice.hardStop=function(){scheduleFinish(24);return base.apply(this,arguments)};
    }
    return voice;
  }

  function wrapRuntime(){
    try{
      if(typeof startVoice==='function'&&!startVoice.__mbPerf){
        const base=startVoice;
        const wrapped=function(m,p='Studio Grand',v=.86){
          const preset=presetForVoice(p),oscCount=Math.max(1,preset?.oscs?.length||1),t=now();
          inc('voiceStarts');inc('oscStarts',oscCount);
          const voice=base.apply(this,arguments);
          totals.voiceStartMs+=now()-t;
          return trackVoiceLifetime(voice,p,oscCount);
        };
        wrapped.__mbPerf=true;startVoice=wrapped;
      }
    }catch(e){console.warn('MB perf: startVoice hook unavailable',e)}
    try{
      if(typeof v6ArpTick==='function'&&!v6ArpTick.__mbPerf){
        const base=v6ArpTick;
        const wrapped=function(){return timed('arpTickMs','arpTicks',base,this,arguments)};
        wrapped.__mbPerf=true;v6ArpTick=wrapped;
      }
    }catch(e){console.warn('MB perf: arp tick hook unavailable',e)}
    try{
      if(typeof v17ApplyFx==='function'&&!v17ApplyFx.__mbPerf){
        const base=v17ApplyFx;
        const wrapped=function(){return timed('fxMs','fxCalls',base,this,arguments)};
        wrapped.__mbPerf=true;v17ApplyFx=wrapped;
      }
    }catch{}
    try{
      if(typeof primeAudio==='function'&&!primeAudio.__mbPerf){
        const base=primeAudio;
        const wrapped=function(){return timed('primeMs','primeCalls',base,this,arguments)};
        wrapped.__mbPerf=true;primeAudio=wrapped;
      }
    }catch{}
    try{
      if(typeof v22DrawScope==='function'&&!v22DrawScope.__mbPerf){
        const base=v22DrawScope;
        const wrapped=function(){return timed('scopeMs','scopeFrames',base,this,arguments)};
        wrapped.__mbPerf=true;v22DrawScope=wrapped;
      }
    }catch{}
    try{
      if(typeof v24BuildPlayStack==='function'&&!v24BuildPlayStack.__mbPerf){
        const base=v24BuildPlayStack;
        const wrapped=function(){return timed('playBuildMs','playBuilds',base,this,arguments)};
        wrapped.__mbPerf=true;v24BuildPlayStack=wrapped;
      }
    }catch{}
    try{
      if(typeof v26NormalizePlayArpGrid==='function'&&!v26NormalizePlayArpGrid.__mbPerf){
        const base=v26NormalizePlayArpGrid;
        const wrapped=function(){return timed('arpNormalizeMs','arpNormalizes',base,this,arguments)};
        wrapped.__mbPerf=true;v26NormalizePlayArpGrid=wrapped;
      }
    }catch{}
    try{
      if(typeof v28RestorePlayArp==='function'&&!v28RestorePlayArp.__mbPerf){
        const base=v28RestorePlayArp;
        const wrapped=function(){return timed('v28RestoreMs','v28Restores',base,this,arguments)};
        wrapped.__mbPerf=true;v28RestorePlayArp=wrapped;
      }
    }catch{}
  }

  function state(){
    let arp={};
    try{arp={
      enabled:!!v6Arp?.enabled,rate:v6Arp?.rate||'1/8',ratchet:+v6Arp?.ratchet||1,
      mode:v6Arp?.mode||'up',gate:+v6Arp?.gate||0,octaves:+v6Arp?.octaves||1,
      preset:v6Arp?.target?.preset||document.querySelector('#playSound')?.value||document.querySelector('#playBassSound')?.value||'—'
    }}catch{}
    let bpm=100,stepMs=null;
    try{bpm=+(v6Arp?.target?.bpm||document.querySelector('#playBpm')?.value||session?.bpm||100);stepMs=typeof v6RateMs==='function'?v6RateMs():null}catch{}
    return{screen:typeof currentScreen==='string'?currentScreen:'—',bpm,stepMs,arp};
  }
  function scenario(){
    const s=state(),a=s.arp;
    return `${a.rate||'—'} · ${s.bpm} BPM · ratchet x${a.ratchet||1} · ${a.mode||'—'} · ${a.preset||'—'}`;
  }
  function updateRates(){
    const keys=['arpTicks','voiceStarts','oscStarts','fxCalls','primeCalls','scopeFrames','playBuilds','arpNormalizes','v28Restores','domMutations','domAdded','domRemoved'];
    keys.forEach(k=>{rates[k]=Math.max(0,(totals[k]||0)-(last[k]||0));last[k]=totals[k]||0});
  }
  function avgMs(totalKey,countKey){return totals[countKey]?totals[totalKey]/totals[countKey]:0}
  function memoryMb(){try{return performance.memory?performance.memory.usedJSHeapSize/1048576:null}catch{return null}}
  function snapshot(){
    const s=state(),mem=memoryMb();
    return{
      at:new Date().toISOString(),scenario:scenario(),screen:s.screen,bpm:s.bpm,stepMs:s.stepMs,
      fps:+fps.toFixed(1),eventLoopLagMax:+totals.eventLoopLagMax.toFixed(1),
      arpTicksPerSec:rates.arpTicks||0,voicesPerSec:rates.voiceStarts||0,oscillatorsPerSec:rates.oscStarts||0,
      fxCallsPerSec:rates.fxCalls||0,primeCallsPerSec:rates.primeCalls||0,scopeFramesPerSec:rates.scopeFrames||0,
      playBuildsPerSec:rates.playBuilds||0,arpNormalizesPerSec:rates.arpNormalizes||0,v28RestoresPerSec:rates.v28Restores||0,
      domMutationsPerSec:rates.domMutations||0,domAddedPerSec:rates.domAdded||0,domRemovedPerSec:rates.domRemoved||0,
      liveVoices:totals.liveVoices,liveOscillators:totals.liveOscillators,
      peakLiveVoices:totals.peakLiveVoices,peakLiveOscillators:totals.peakLiveOscillators,
      avgVoiceStartMs:+avgMs('voiceStartMs','voiceStarts').toFixed(3),avgArpTickMs:+avgMs('arpTickMs','arpTicks').toFixed(3),
      avgFxMs:+avgMs('fxMs','fxCalls').toFixed(3),avgScopeMs:+avgMs('scopeMs','scopeFrames').toFixed(3),
      longTasks:totals.longTasks,longTaskMs:+totals.longTaskMs.toFixed(1),memoryMb:mem==null?null:+mem.toFixed(1)
    };
  }

  function aggregate(list,label){
    if(!list.length)return null;
    const numeric=Object.keys(list[0]).filter(k=>typeof list[0][k]==='number');
    const avg={},max={};
    numeric.forEach(k=>{
      const vals=list.map(x=>x[k]).filter(Number.isFinite);
      if(!vals.length)return;avg[k]=vals.reduce((a,b)=>a+b,0)/vals.length;max[k]=Math.max(...vals);
    });
    return{label,startedAt:list[0].at,endedAt:list.at(-1).at,scenario:list.at(-1).scenario,samples:list.length,average:avg,max};
  }
  function reset(){
    Object.keys(totals).forEach(k=>totals[k]=0);
    Object.keys(last).forEach(k=>last[k]=0);
    Object.keys(rates).forEach(k=>rates[k]=0);
    samples.length=0;reports.length=0;
    render();
  }
  function startSample(seconds=10){
    clearInterval(sampleTimer);samples.length=0;sampleLabel=scenario();sampleEndsAt=Date.now()+seconds*1000;
    const take=()=>{samples.push(snapshot());if(Date.now()>=sampleEndsAt){clearInterval(sampleTimer);sampleTimer=0;const report=aggregate(samples,sampleLabel);if(report)reports.push(report);render()}};
    take();sampleTimer=setInterval(take,1000);render();
  }
  async function copyReport(){
    const report={build:'performance-core-phase1',userAgent:navigator.userAgent,devicePixelRatio:devicePixelRatio||1,audio:{state:ctx?.state||'not-created',sampleRate:ctx?.sampleRate||null,baseLatency:ctx?.baseLatency||null,outputLatency:ctx?.outputLatency||null},latest:lastSnapshot,reports,totals};
    const text=JSON.stringify(report,null,2);
    try{await navigator.clipboard.writeText(text);flash('COPIED')}catch{console.log('Music & Beats performance report',report);flash('LOGGED')}
  }
  function flash(text){const el=panel?.querySelector('[data-perf-status]');if(!el)return;const old=el.textContent;el.textContent=text;setTimeout(()=>el.textContent=old,1000)}

  function render(){
    if(!panel)return;lastSnapshot=snapshot();const s=lastSnapshot;
    const sampling=!!sampleTimer,left=sampling?Math.max(0,Math.ceil((sampleEndsAt-Date.now())/1000)):0;
    const values={
      scenario:s.scenario,fps:s.fps.toFixed(0),lag:s.eventLoopLagMax.toFixed(1),ticks:s.arpTicksPerSec,
      voices:s.voicesPerSec,oscs:s.oscillatorsPerSec,live:`${s.liveVoices} / ${s.liveOscillators}`,
      peaks:`${s.peakLiveVoices} / ${s.peakLiveOscillators}`,fx:s.fxCallsPerSec,prime:s.primeCallsPerSec,
      scope:`${s.scopeFramesPerSec} @ ${s.avgScopeMs.toFixed(2)}ms`,dom:s.domMutationsPerSec,
      builds:`${s.playBuildsPerSec} / ${s.arpNormalizesPerSec} / ${s.v28RestoresPerSec}`,
      long:`${s.longTasks} · ${s.longTaskMs.toFixed(0)}ms`,mem:s.memoryMb==null?'n/a':`${s.memoryMb.toFixed(0)} MB`
    };
    Object.entries(values).forEach(([k,v])=>{const el=panel.querySelector(`[data-perf="${k}"]`);if(el)el.textContent=String(v)});
    const sampleBtn=panel.querySelector('[data-perf-sample]');if(sampleBtn){sampleBtn.textContent=sampling?`Sampling ${left}s…`:'Run 10s sample';sampleBtn.disabled=sampling}
  }
  function mount(){
    panel=document.createElement('aside');panel.id='mbPerfPanel';panel.innerHTML=`
      <div class="mb-perf-head"><div><small>PERFORMANCE LAB</small><strong>Music & Beats</strong></div><button type="button" data-perf-collapse aria-label="Collapse performance panel">−</button></div>
      <div class="mb-perf-body">
        <div class="mb-perf-scenario" data-perf="scenario">Waiting for audio…</div>
        <div class="mb-perf-grid">
          <span>FPS <b data-perf="fps">—</b></span><span>Loop lag <b data-perf="lag">—</b></span>
          <span>ARP ticks/s <b data-perf="ticks">0</b></span><span>Voices/s <b data-perf="voices">0</b></span>
          <span>Osc/s <b data-perf="oscs">0</b></span><span>Live V/O <b data-perf="live">0 / 0</b></span>
          <span>Peak V/O <b data-perf="peaks">0 / 0</b></span><span>FX calls/s <b data-perf="fx">0</b></span>
          <span>primeAudio/s <b data-perf="prime">0</b></span><span>Scope <b data-perf="scope">0</b></span>
          <span>DOM mut/s <b data-perf="dom">0</b></span><span>Build/Nrm/Rst <b data-perf="builds">0 / 0 / 0</b></span>
          <span>Long tasks <b data-perf="long">0</b></span><span>JS heap <b data-perf="mem">n/a</b></span>
        </div>
        <div class="mb-perf-actions"><button type="button" data-perf-sample>Run 10s sample</button><button type="button" data-perf-copy>Copy report</button><button type="button" data-perf-reset>Reset</button></div>
        <small class="mb-perf-status" data-perf-status>Diagnostics only · audio behavior unchanged</small>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('[data-perf-collapse]').onclick=()=>panel.classList.toggle('collapsed');
    panel.querySelector('[data-perf-sample]').onclick=()=>startSample(10);
    panel.querySelector('[data-perf-copy]').onclick=copyReport;
    panel.querySelector('[data-perf-reset]').onclick=reset;
  }

  function installObservers(){
    try{
      const mo=new MutationObserver(records=>{
        inc('domMutations',records.length);
        records.forEach(r=>{inc('domAdded',r.addedNodes?.length||0);inc('domRemoved',r.removedNodes?.length||0)});
      });
      mo.observe(document.body,{childList:true,subtree:true});
    }catch{}
    try{
      if(PerformanceObserver.supportedEntryTypes?.includes('longtask')){
        const po=new PerformanceObserver(list=>list.getEntries().forEach(e=>{inc('longTasks');totals.longTaskMs+=e.duration}));
        po.observe({entryTypes:['longtask']});
      }
    }catch{}
    let expected=now()+250;
    setInterval(()=>{const t=now(),lag=Math.max(0,t-expected);totals.eventLoopLagMax=Math.max(totals.eventLoopLagMax,lag);expected=t+250},250);
    const raf=t=>{frames++;if(t-fpsWindow>=1000){fps=frames*1000/(t-fpsWindow);frames=0;fpsWindow=t}requestAnimationFrame(raf)};
    requestAnimationFrame(raf);
  }

  window.MB_PERF={totals,rates,snapshot,startSample,copyReport,reset,reports,wrapRuntime};
  wrapRuntime();mount();installObservers();
  setInterval(()=>{updateRates();render()},1000);
  window.addEventListener('musicandbeats:ready',()=>{wrapRuntime();render()},{once:true});
  console.info('Music & Beats performance diagnostics enabled. Use MB_PERF.snapshot() or the on-screen panel.');
})();
