/* Music & Beats Performance Core — Phase 2 hardening. */
(()=>{
  const core=window.MB_CORE_V2;if(!core)return;

  function clearFuturePitch(at){
    const pool=core.pool;if(!pool||!ctx)return;
    pool.slots.forEach(slot=>slot.oscs.forEach(({osc})=>{
      try{const f=osc.frequency.value;osc.frequency.cancelScheduledValues(at);osc.frequency.setValueAtTime(f,at)}catch{}
      try{const d=osc.detune.value;osc.detune.cancelScheduledValues(at);osc.detune.setValueAtTime(d,at)}catch{}
    }));
  }

  function disposePool(){
    const pool=core.pool;if(!pool)return;
    pool.slots.forEach(slot=>{
      slot.oscs.forEach(({osc,gain})=>{try{osc.stop()}catch{};try{osc.disconnect()}catch{};try{gain.disconnect()}catch{}});
      try{slot.filter.disconnect()}catch{};try{slot.amp.disconnect()}catch{};
    });
    core.pool=null;
    const t=window.MB_PERF?.totals;if(t){t.liveVoices=0;t.liveOscillators=0}
  }
  core.disposePool=disposePool;

  if(typeof v6StartArp==='function'){
    const base=v6StartArp;
    v6StartArp=function(target){
      const old=v6Arp?.target,changed=old&&(old.chord!==target?.chord||old.rootMidi!==target?.rootMidi||old.preset!==target?.preset);
      if(changed&&ctx)clearFuturePitch(ctx.currentTime+.002);
      return base.apply(this,arguments);
    };
  }

  let idleSince=0;
  setInterval(()=>{
    if(core.running){idleSince=0;return}
    if(!core.pool){idleSince=0;return}
    if(!idleSince){idleSince=performance.now();return}
    if(performance.now()-idleSince>=2600){disposePool();idleSince=0}
  },900);

  window.addEventListener('pagehide',disposePool);
})();