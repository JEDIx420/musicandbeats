/* Music & Beats V35 — deployment/update recovery guard. */
(()=>{
  const BUILD='v35',reloadKey=`musicandbeats:reload:${BUILD}`;
  window.MUSIC_AND_BEATS_BUILD=BUILD;
  async function remoteBuild(){
    try{
      const r=await fetch(`./build-version.json?ts=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)return null;return await r.json();
    }catch{return null}
  }
  async function boot(){
    if(!('serviceWorker' in navigator))return;
    try{
      const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
      let reloading=false;
      const reloadOnce=()=>{
        if(reloading||sessionStorage.getItem(reloadKey)==='1')return;
        reloading=true;sessionStorage.setItem(reloadKey,'1');location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange',reloadOnce);
      await reg.update().catch(()=>{});
      const remote=await remoteBuild();
      if(remote?.build&&remote.build!==BUILD){
        await reg.update().catch(()=>{});
        if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
        setTimeout(reloadOnce,700);
      }else if(reg.waiting){
        reg.waiting.postMessage({type:'SKIP_WAITING'});
      }
      setTimeout(()=>reg.update().catch(()=>{}),2500);
    }catch(e){console.warn('Music & Beats update check skipped',e)}
  }
  if(document.readyState==='complete')boot();else window.addEventListener('load',boot,{once:true});
})();