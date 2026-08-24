/* Music & Beats Performance Core — Phase 2
   Bounded ARP voice pool + Web Audio look-ahead scheduler + hot-path cleanup.
   No external dependencies. */
(()=>{
  if(window.MB_CORE_V2)return;

  const CORE={
    version:'phase2',
    pool:null,
    poolSize:40,
    schedulerId:0,
    releaseTimer:0,
    nextTime:0,
    uiQueue:[],
    lastBadgeAt:0,
    lastBadgeText:'',
    running:false,
    metrics:{schedulerWakeups:0,scheduledSteps:0,scheduledNotes:0,poolBuilds:0,poolSteals:0,actualOscillatorStarts:0,maxSchedulerDriftMs:0}
  };
  window.MB_CORE_V2=CORE;

  const perfTotals=()=>window.MB_PERF?.totals||null;
  const perfInc=(key,n=1)=>{const t=perfTotals();if(t)t[key]=(t[key]||0)+n};
  const perfAdd=(key,n)=>{const t=perfTotals();if(t)t[key]=(t[key]||0)+n};
  function perfPoolState(){
    const t=perfTotals();if(!t||!CORE.pool||!ctx)return;
    const live=CORE.pool.slots.filter(s=>s.busyUntil>ctx.currentTime).length;
    t.liveVoices=live;
    t.liveOscillators=CORE.pool.oscillatorCount;
    t.peakLiveVoices=Math.max(t.peakLiveVoices||0,live);
    t.peakLiveOscillators=Math.max(t.peakLiveOscillators||0,CORE.pool.oscillatorCount);
  }

  try{
    const legacyPrime=primeAudio;
    let primed=false;
    primeAudio=function(){
      if(!ctx){legacyPrime();primed=true;return ctx}
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
      if(!primed){
        const badge=document.querySelector('#engineBadge');
        if(badge){badge.classList.add('ready');badge.innerHTML='<span></span>Audio ready'}
        primed=true;
      }
      return ctx;
    };
  }catch{}

  try{
    const legacyUpdateVoiceBadges=updateVoiceBadges;
    let badgeRaf=0;
    updateVoiceBadges=function(){
      if(badgeRaf)return;
      badgeRaf=requestAnimationFrame(()=>{badgeRaf=0;try{legacyUpdateVoiceBadges()}catch{}});
    };
  }catch{}

  try{
    const legacyCurve=v17DriveCurve;
    const cache=new Map();
    v17DriveCurve=function(amount=0){
      const key=Math.round((+amount||0)*1000)/1000;
      if(cache.has(key))return cache.get(key);
      const curve=legacyCurve(key);cache.set(key,curve);return curve;
    };
  }catch{}

  try{
    const legacyApplyFx=v17ApplyFx;
    let lastSig='',applying=false;
    function fxSig(){
      try{
        const s=v17FxState(),x=v4Expr();
        return [
          s?.board||'',s?.drive?.on?1:0,+s?.drive?.amount||0,
          s?.chorus?.on?1:0,+s?.chorus?.amount||0,
          s?.delay?.on?1:0,+s?.delay?.amount||0,
          s?.reverb?.on?1:0,+s?.reverb?.amount||0,
          +(x?.tone||7000),+(x?.space||0)
        ].join('|');
      }catch{return String(performance.now())}
    }
    v17ApplyFx=function(force=false){
      if(!ctx)return;
      if(applying)return legacyApplyFx.apply(this,arguments);
      const sig=fxSig();
      if(!force&&v17SynthRack&&sig===lastSig)return v17SynthRack;
      applying=true;
      try{const out=legacyApplyFx.apply(this,arguments);lastSig=sig;return out}
      finally{applying=false}
    };
  }catch{}

  function destroyPool(){
    const p=CORE.pool;if(!p)return;
    p.slots.forEach(slot=>{
      slot.oscs.forEach(({osc,gain})=>{try{osc.stop()}catch{};try{osc.disconnect()}catch{};try{gain.disconnect()}catch{}});
      try{slot.filter.disconnect()}catch{};try{slot.amp.disconnect()}catch{};
    });
    CORE.pool=null;
    perfPoolState();
  }

  function makeSlot(preset){
    const amp=ctx.createGain(),filter=ctx.createBiquadFilter();
    amp.gain.value=.0001;filter.type='lowpass';filter.frequency.value=1000;filter.Q.value=preset.q||.3;
    filter.connect(amp).connect(synthBus);
    const oscs=preset.oscs.map(def=>{
      const [type,semi,lev,cents=0]=def,osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=type;gain.gain.value=lev;osc.detune.value=cents;
      osc.connect(gain).connect(filter);osc.start();
      CORE.metrics.actualOscillatorStarts++;perfInc('oscStarts');
      return{osc,gain,semi,cents};
    });
    return{amp,filter,oscs,busyUntil:0,lastMidi:null};
  }

  function ensurePool(presetName){
    primeAudio();
    try{v17EnsureSynthRack();v17ApplyFx()}catch{}
    const preset=SOUND_PRESETS[presetName]||SOUND_PRESETS['Studio Grand'];
    if(CORE.pool&&CORE.pool.name===presetName&&CORE.pool.preset===preset)return CORE.pool;
    destroyPool();
    const slots=Array.from({length:CORE.poolSize},()=>makeSlot(preset));
    CORE.pool={name:presetName,preset,slots,cursor:0,oscillatorCount:slots.length*preset.oscs.length};
    CORE.metrics.poolBuilds++;
    perfPoolState();
    return CORE.pool;
  }

  function chooseSlot(when){
    const p=CORE.pool;if(!p)return null;
    for(let n=0;n<p.slots.length;n++){
      const i=(p.cursor+n)%p.slots.length,slot=p.slots[i];
      if(slot.busyUntil<=when-.001){p.cursor=(i+1)%p.slots.length;return slot}
    }
    let slot=p.slots[0];
    for(const s of p.slots)if(s.busyUntil<slot.busyUntil)slot=s;
    CORE.metrics.poolSteals++;
    return slot;
  }

  function cancelFrom(param,when,value=.0001){
    try{
      if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(when);
      else{param.cancelScheduledValues(when);param.setValueAtTime(Math.max(.0001,Number.isFinite(param.value)?param.value:value),when)}
    }catch{try{param.cancelScheduledValues(when)}catch{}}
  }

  function schedulePooledVoice(midi,presetName,velocity,when,duration){
    const p=ensurePool(presetName),slot=chooseSlot(when);if(!slot)return;
    const s=p.preset,x=v4Expr(),amp=slot.amp.gain,filter=slot.filter.frequency;
    const vel=clamp((velocity||.76)*(x?.velocity||.78),.03,1.2),peak=Math.max(.001,s.gain*vel);
    const cut=Math.min(16000,Math.max(500,x?.tone||s.filter));
    const startCut=Math.min(16000,cut*(s.v17?.filterEnv||1));
    duration=Math.max(.004,+duration||.02);
    const attack=Math.max(.001,Math.min(.018,s.attack+.002,duration*.28));
    const decay=Math.max(.003,Math.min(Math.max(.006,s.decay*.42),duration*.34));
    const release=Math.max(.004,Math.min(.045,duration*.34));
    const attackEnd=when+attack,decayEnd=Math.min(when+duration*.72,attackEnd+decay),off=when+duration;
    const sustain=Math.max(.001,peak*Math.max(.08,s.sustain));

    cancelFrom(amp,when);
    try{
      amp.setValueAtTime(.0001,when);
      amp.exponentialRampToValueAtTime(peak,attackEnd);
      amp.exponentialRampToValueAtTime(sustain,Math.max(attackEnd+.001,decayEnd));
      amp.setValueAtTime(sustain,off);
      amp.exponentialRampToValueAtTime(.0001,off+release);
    }catch{}

    try{
      filter.cancelScheduledValues(when);
      filter.setValueAtTime(startCut,when);
      filter.exponentialRampToValueAtTime(Math.max(450,cut),Math.max(when+.004,Math.min(off,when+Math.max(.02,s.decay*.55))));
    }catch{}
    slot.filter.Q.value=s.q||.3;

    slot.oscs.forEach(({osc,semi,cents})=>{
      try{osc.frequency.setValueAtTime(midiToFreq(midi+semi),when);osc.detune.setValueAtTime(cents,when)}catch{}
    });
    slot.busyUntil=off+release;slot.lastMidi=midi;
    CORE.metrics.scheduledNotes++;perfInc('voiceStarts');
    perfPoolState();
  }

  function silencePool(when=null){
    const p=CORE.pool;if(!p||!ctx)return;const t=when??ctx.currentTime;
    p.slots.forEach(slot=>{
      try{cancelFrom(slot.amp.gain,t);slot.amp.gain.linearRampToValueAtTime(0,t+.006)}catch{}
      slot.busyUntil=t+.008;
    });
    perfPoolState();
  }

  function currentStepSeconds(){return Math.max(.004,(typeof v6RateMs==='function'?v6RateMs():300)/1000)}
  function currentVoiceRate(){
    try{
      const notes=v6Arp.mode==='chord'&&v6Arp.target?.chord?v6ChordNotes(v6Arp.target.chord,v6Arp.target.voicing||'close',v6Arp.target.octave).length:1;
      return (1/currentStepSeconds())*Math.max(1,+v6Arp.ratchet||1)*Math.max(1,notes);
    }catch{return 1/currentStepSeconds()}
  }
  function aheadSeconds(){
    const rate=currentVoiceRate();
    return Math.max(.04,Math.min(.085,(CORE.poolSize*.72)/Math.max(1,rate)));
  }
  function arpStepNotes(target,seq,index,transpose){
    if(typeof v17ArpStepNotes==='function')return v17ArpStepNotes(target,seq,index,transpose);
    const midi=v6Arp.mode==='random'?seq[Math.floor(Math.random()*seq.length)]:seq[index%seq.length];return[midi+transpose];
  }
  function arpVelocity(step){return typeof v17ArpVelocity==='function'?v17ArpVelocity(step):.76}
  function motionSemis(step,len){return typeof v17MotionSemis==='function'?v17MotionSemis(step,len):0}

  function scheduleStep(when){
    const t0=performance.now(),target=v6Arp.target;
    if(!v6Arp.enabled||!target)return 0;
    const seq=v6ArpSequence(target);if(!seq?.length)return currentStepSeconds();
    const stepNo=v6Arp.totalSteps||0,mask=v6Arp.pattern||[true,true,true,true,true,true,true,true];
    const playStep=mask[stepNo%mask.length]!==false,transpose=motionSemis(stepNo,seq.length);
    const notes=arpStepNotes(target,seq,v6Arp.index%seq.length,transpose),ratchet=clamp(+v6Arp.ratchet||1,1,4);
    const stepSec=currentStepSeconds(),sub=stepSec/ratchet,gate=clamp(+v6Arp.gate||.62,.08,1.5),vel=arpVelocity(stepNo);

    if(playStep){
      for(let r=0;r<ratchet;r++){
        const noteAt=when+r*sub,duration=Math.max(.004,sub*gate);
        notes.forEach((m,j)=>schedulePooledVoice(m,target.preset||'Studio Grand',clamp(vel-j*.025,.35,1),noteAt,duration));
      }
    }

    CORE.uiQueue.push({when,step:stepNo});
    CORE.metrics.scheduledSteps++;perfInc('arpTicks');
    v6Arp.index=(v6Arp.index||0)+1;v6Arp.totalSteps=stepNo+1;
    if(v6Arp.retrigger==='beat'&&v6Arp.totalSteps%16===0)v6Arp.index=0;
    const swing=clamp(+v6Arp.swing||0,0,70)/100*.58;
    const interval=stepSec*(stepNo%2===0?1+swing:1-swing);
    perfAdd('arpTickMs',performance.now()-t0);
    return interval;
  }

  function paintDueSteps(nowAudio){
    let latest=null;
    while(CORE.uiQueue.length&&CORE.uiQueue[0].when<=nowAudio+.006)latest=CORE.uiQueue.shift();
    if(latest)try{v6PaintArp(latest.step)}catch{}
  }

  function updateArpBadge(){
    if(!ctx)return;const now=performance.now();if(now-CORE.lastBadgeAt<240)return;CORE.lastBadgeAt=now;
    const live=CORE.pool?CORE.pool.slots.filter(s=>s.busyUntil>ctx.currentTime).length:0;
    const el=document.querySelector('#playPolyphony');if(!el)return;
    const text=`${live} arp voice${live===1?'':'s'}`;
    if(text!==CORE.lastBadgeText){el.textContent=text;CORE.lastBadgeText=text}
  }

  function schedulerWake(){
    if(!v6Arp.enabled||!v6Arp.target||!ctx){hardStopArp();return}
    CORE.metrics.schedulerWakeups++;
    const now=ctx.currentTime,ahead=aheadSeconds();
    if(!CORE.nextTime||CORE.nextTime<now-.03){
      CORE.metrics.maxSchedulerDriftMs=Math.max(CORE.metrics.maxSchedulerDriftMs,(now-(CORE.nextTime||now))*1000);
      CORE.nextTime=now+.012;
    }
    let guard=0;
    while(CORE.nextTime<now+ahead&&guard++<256){CORE.nextTime+=scheduleStep(CORE.nextTime)}
    paintDueSteps(now);updateArpBadge();perfPoolState();
  }

  function startScheduler(){
    if(CORE.schedulerId)return;
    CORE.running=true;CORE.nextTime=ctx.currentTime+.018;CORE.uiQueue.length=0;
    CORE.schedulerId=setInterval(schedulerWake,18);v6Arp.timer=CORE.schedulerId;schedulerWake();
  }
  function stopSchedulerOnly(){
    if(CORE.schedulerId){clearInterval(CORE.schedulerId);CORE.schedulerId=0}
    v6Arp.timer=null;CORE.running=false;CORE.uiQueue.length=0;
  }
  function hardStopArp(){
    clearTimeout(CORE.releaseTimer);CORE.releaseTimer=0;stopSchedulerOnly();
    try{v6Arp.target?.pad?.classList.remove('arp-active')}catch{}
    v6Arp.target=null;v6Arp.index=0;v6Arp.totalSteps=0;CORE.nextTime=0;
    silencePool();
    try{v6PaintArp(-1)}catch{}
  }
  function startArp(target){
    clearTimeout(CORE.releaseTimer);CORE.releaseTimer=0;
    if(!v6Arp.enabled||!target)return;
    primeAudio();try{v17EnsureSynthRack();v17ApplyFx()}catch{}
    const previous=v6Arp.target;
    try{previous?.pad?.classList.remove('arp-active')}catch{}
    v6Arp.target=target;try{target.pad?.classList.add('arp-active')}catch{}
    const changed=!previous||previous.chord!==target.chord||previous.rootMidi!==target.rootMidi||previous.preset!==target.preset;
    if(changed){
      if(v6Arp.retrigger==='note'||!CORE.schedulerId){v6Arp.index=0;v6Arp.totalSteps=0}
      if(ctx){silencePool(ctx.currentTime+.003);CORE.nextTime=ctx.currentTime+.012;CORE.uiQueue.length=0}
    }
    ensurePool(target.preset||'Studio Grand');startScheduler();
  }
  function stopArp(force=true){
    const panic=document.activeElement?.matches?.('[data-arp-action="panic"]');
    const immediate=force==='immediate'||!v6Arp.enabled||playInstrument!=='chords'||document.hidden||panic;
    if(immediate){hardStopArp();return}
    clearTimeout(CORE.releaseTimer);
    CORE.releaseTimer=setTimeout(()=>{CORE.releaseTimer=0;hardStopArp()},175);
  }

  try{v6ArpTick=schedulerWake}catch{}
  try{v6StartArp=startArp}catch{}
  try{v6StopArp=stopArp}catch{}
  try{v7HardStopArp=hardStopArp}catch{}

  window.addEventListener('blur',hardStopArp);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hardStopArp()});
  window.addEventListener('pagehide',hardStopArp);

  CORE.snapshot=()=>({
    running:CORE.running,preset:CORE.pool?.name||null,poolSlots:CORE.pool?.slots.length||0,
    persistentOscillators:CORE.pool?.oscillatorCount||0,busySlots:CORE.pool&&ctx?CORE.pool.slots.filter(s=>s.busyUntil>ctx.currentTime).length:0,
    ...CORE.metrics
  });
  console.info('Music & Beats performance core phase 2 active',CORE.snapshot());
})();
