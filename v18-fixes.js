/* Music & Beats V18 integration hardening. */

/* Global Smart LATCH keeps the running arp clock alive when changing chords. */
v18LatchSmartPad=function(pad){
  const c=v14PadContext(pad);if(!c)return false;const arp=v18PrepareSmartArp(c.id),old=v14Latch;
  primeAudio();
  if(arp){
    if(old&&!old.arp)v18ReleaseSmartHeld(false);
    else if(old?.arp){old.pad?.classList.remove('v14-latched','v18-latched','arp-active');old.pad?.removeAttribute('aria-pressed');v14Latch=null}
    const target={chord:c.chord,pad:c.pad,preset:c.preset,octave:c.octave,voicing:c.voicing,index:c.index,context:c.id==='#recordChords'?'record':'play',bpm:c.id==='#recordChords'?session.bpm:clamp(+($('#playBpm')?.value||100),40,220)};
    v6Arp.latch=true;v6StartArp(target);v14Latch={...c,arp:true,voices:[]};
  }else{
    v18ReleaseSmartHeld(false);const voices=v6StartSmartChord(c.chord,{voicing:c.voicing,octave:c.octave,preset:c.preset,velocity:.78});v14Latch={...c,arp:false,voices};
  }
  pad.classList.add('v14-latched','v18-latched');pad.setAttribute('aria-pressed','true');return true;
};

/* Keep the rectangular display label correct when moving Smart Keys ↔ Bass. */
const v18BaseFlattenPlayArp=v18FlattenPlayArp;
v18FlattenPlayArp=function(){
  const out=v18BaseFlattenPlayArp();const wave=$('#v6ArpPanel .v18-arp-wave'),label=wave?.querySelector(':scope > span');if(label)label.textContent=playInstrument==='bass'?'BASS MOTION':'CHORD MOTION';return out;
};

/* V15 can still rewrite the Arp title during an instrument switch; make V18 the final presenter. */
if(typeof v15UpdatePlayArpPanel==='function'){
  const v18BaseUpdatePlayArpPanel=v15UpdatePlayArpPanel;
  v15UpdatePlayArpPanel=function(){const out=v18BaseUpdatePlayArpPanel.apply(this,arguments);requestAnimationFrame(v18FlattenPlayArp);return out};
}

/* No legacy arp-latch controls should survive a slow/dynamic render. */
function v18RemoveLegacyLatchControls(){document.querySelectorAll('[data-arp-toggle="latch"],[data-v17-latch],[data-v15-latch]').forEach(el=>el.remove())}
const v18BaseRefreshUI=v18RefreshUI;
v18RefreshUI=function(){const out=v18BaseRefreshUI.apply(this,arguments);v18RemoveLegacyLatchControls();return out};
requestAnimationFrame(v18RefreshUI);
