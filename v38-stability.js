/* V38 stability: keep the new Lead instrument authoritative without observer churn. */
(()=>{
  const R=window.MB_V38;if(!R)return;
  /* Disable V38's broad compatibility observer after initial boot; this targeted observer owns only the Lead card. */
  R.state.rendering=true;
  let queued=false;
  function patch(){queued=false;const card=document.querySelector('#v37LeadTrack'),button=card?.querySelector('.v37-track-select');if(!button)return;if(button.dataset.v38Owned!=='1'){button.dataset.v38Owned='1';button.onclick=e=>{e.preventDefault();document.querySelectorAll('#v34Tracks .v34-track,#v37LeadTrack').forEach(x=>x.classList.remove('active'));card.classList.add('active');R.renderLead()}}const small=button.querySelector('small'),copy='Piano / keytar · sampled voices · deep FX';if(small&&small.textContent!==copy)small.textContent=copy}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(patch)}
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('musicandbeats:v35change',queue);window.addEventListener('pageshow',queue);patch();
})();