/* Music & Beats V9 — iPad touch hardening + collapsible expression controls. */
const V9_TOUCH_SURFACE='.chord-pad,.piano-key,.instrument-tab,.v6-smart-toolbar button,.source-card,.v6-arp-panel button,.v6-pedal button';
let v9ExpressionSeq=0,v9ScanQueued=false;

function v9IsEditableTarget(target){return !!target?.closest?.('input,select,textarea,[contenteditable="true"],[role="textbox"]')}
function v9IsPerformanceTarget(target){return !!target?.closest?.(V9_TOUCH_SURFACE)}
function v9IsTouchFirst(){
  try{return (navigator.maxTouchPoints||0)>0&&(matchMedia('(pointer:coarse)').matches||matchMedia('(hover:none)').matches)}catch{return (navigator.maxTouchPoints||0)>0}
}
function v9ReadState(kind){try{const v=localStorage.getItem(`musicandbeats:expression:${kind}`);return v===null?null:v==='collapsed'}catch{return null}}
function v9WriteState(kind,collapsed){try{localStorage.setItem(`musicandbeats:expression:${kind}`,collapsed?'collapsed':'expanded')}catch{}}

function v9ExpressionSummary(strip){
  const read=(k,fallback)=>strip.querySelector(`[data-out="${k}"]`)?.textContent?.trim()||fallback;
  return `Vel ${read('velocity','100')} · Sus ${read('sustain','0.80s')} · Tone ${read('tone','7.0k')} · Space ${read('space','18%')}`;
}
function v9SyncExpressionShell(shell){
  if(!shell)return;const strip=shell.querySelector('.expression-strip'),summary=shell.querySelector('.v9-expression-summary'),action=shell.querySelector('.v9-expression-word'),toggle=shell.querySelector('.v9-expression-toggle');
  if(summary&&strip)summary.textContent=v9ExpressionSummary(strip);
  const collapsed=shell.classList.contains('collapsed');if(action)action.textContent=collapsed?'Show':'Hide';if(toggle)toggle.setAttribute('aria-expanded',String(!collapsed));
}
function v9EnhanceExpression(strip){
  if(!strip||strip.closest('.v9-expression-shell'))return;
  const kind=strip.id==='playExpression'?'play':'record';
  const shell=document.createElement('section');shell.className='v9-expression-shell';shell.dataset.expressionKind=kind;
  const id=strip.id||`v9Expression${++v9ExpressionSeq}`;strip.id=id;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='v9-expression-toggle';toggle.setAttribute('aria-controls',id);
  toggle.innerHTML=`<span class="v9-expression-icon">⌁</span><span class="v9-expression-copy"><strong>Performance controls</strong><small class="v9-expression-summary"></small></span><span class="v9-expression-action"><span class="v9-expression-word">Hide</span><span class="v9-expression-chevron">⌄</span></span>`;
  strip.before(shell);shell.append(toggle,strip);
  const stored=v9ReadState(kind),collapsed=stored===null?v9IsTouchFirst():stored;shell.classList.toggle('collapsed',collapsed);
  toggle.addEventListener('click',()=>{const next=!shell.classList.contains('collapsed');shell.classList.toggle('collapsed',next);v9WriteState(kind,next);v9SyncExpressionShell(shell)});
  strip.addEventListener('input',()=>requestAnimationFrame(()=>v9SyncExpressionShell(shell)));
  v9SyncExpressionShell(shell);
}
function v9ScanExpressionControls(){document.querySelectorAll('.expression-strip').forEach(v9EnhanceExpression)}
function v9ScheduleScan(){if(v9ScanQueued)return;v9ScanQueued=true;requestAnimationFrame(()=>{v9ScanQueued=false;v9ScanExpressionControls()})}

function v9InstallTouchGuards(){
  document.addEventListener('selectstart',e=>{if(v9IsPerformanceTarget(e.target)&&!v9IsEditableTarget(e.target))e.preventDefault()},true);
  document.addEventListener('contextmenu',e=>{if(v9IsPerformanceTarget(e.target)&&!v9IsEditableTarget(e.target))e.preventDefault()},true);
  document.addEventListener('dragstart',e=>{if(v9IsPerformanceTarget(e.target))e.preventDefault()},true);
  /* Clear any stale Safari selection when a musical control is pressed. */
  document.addEventListener('pointerdown',e=>{if(!v9IsPerformanceTarget(e.target)||v9IsEditableTarget(e.target))return;try{const s=window.getSelection?.();if(s&&!s.isCollapsed)s.removeAllRanges()}catch{}},true);
}

function v9LoadV10(){
  if(!document.querySelector('link[data-v10]')){const link=document.createElement('link');link.rel='stylesheet';link.href='v10.css';link.dataset.v10='1';document.head.appendChild(link)}
  if(!document.querySelector('script[data-v10]')){const script=document.createElement('script');script.src='v10.js';script.dataset.v10='1';document.body.appendChild(script)}
}
function v9LoadV12(){
  if(!document.querySelector('link[data-v12]')){const link=document.createElement('link');link.rel='stylesheet';link.href='v12.css';link.dataset.v12='1';document.head.appendChild(link)}
  if(!document.querySelector('script[data-v12]')){const script=document.createElement('script');script.src='v12.js';script.dataset.v12='1';document.body.appendChild(script)}
}
function v9Init(){
  v9InstallTouchGuards();v9ScanExpressionControls();
  const observer=new MutationObserver(v9ScheduleScan);observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pageshow',v9ScheduleScan);v9LoadV10();v9LoadV12();
}
v9Init();
