/* Music & Beats V8 — Record command bar and premium session settings. */
function v8ActionMarkup(icon,label){return`<span class="v8-action-icon" aria-hidden="true">${icon}</span><span class="v8-action-text">${label}</span>`}

function v8InstallRecordToolbar(){
  const top=$('#recordScreen .record-topline');
  if(!top||top.dataset.v8==='1')return false;
  const home=top.querySelector('.back-home'),progress=top.querySelector('.session-progress'),timeline=$('#v6TimelineToggle'),settings=$('#sessionSettingsBtn');
  if(!home||!progress||!settings||!timeline)return false;
  top.dataset.v8='1';top.classList.add('v8-record-toolbar');
  const nav=document.createElement('div'),center=document.createElement('div'),actions=document.createElement('div');
  nav.className='v8-record-nav';center.className='v8-progress-shell';actions.className='v8-record-actions';
  const kicker=document.createElement('span');kicker.className='v8-progress-kicker';kicker.textContent='RECORD SESSION';
  center.append(kicker,progress);nav.append(home);actions.append(timeline,settings);top.replaceChildren(nav,center,actions);
  timeline.innerHTML=v8ActionMarkup('▤','Timeline');timeline.setAttribute('aria-label','Toggle tracks timeline');
  settings.innerHTML=v8ActionMarkup('⚙','Session settings');settings.setAttribute('aria-label','Open session settings');
  settings.addEventListener('click',()=>{settings.classList.add('v8-settings-open');setTimeout(v8SyncSettingPills,0)});
  return true;
}

function v8SettingCopy(icon,title,description){
  const wrap=document.createElement('div');wrap.className='v8-setting-copy';
  wrap.innerHTML=`<span class="v8-setting-icon" aria-hidden="true">${icon}</span><span><strong>${title}</strong><small>${description}</small></span>`;
  return wrap;
}
function v8PillGroup(select,values,countIn=false){
  select.classList.add('v8-settings-hidden-select');select.setAttribute('aria-hidden','true');
  const group=document.createElement('div');group.className=`v8-choice-group${countIn?' v8-countin-group':''}`;
  values.forEach(([value,label])=>{const b=document.createElement('button');b.type='button';b.dataset.value=String(value);b.textContent=label;b.addEventListener('click',()=>{select.value=String(value);v8SyncSettingPills()});group.appendChild(b)});
  group.appendChild(select);return group;
}
function v8SyncSettingPills(){
  const dlg=$('#settingsDialog');if(!dlg)return;
  dlg.querySelectorAll('.v8-choice-group').forEach(group=>{const select=group.querySelector('select');if(!select)return;group.querySelectorAll('button[data-value]').forEach(b=>b.classList.toggle('active',b.dataset.value===select.value))});
}
function v8InstallSettingsDialog(){
  const dlg=$('#settingsDialog'),form=dlg?.querySelector('form');if(!dlg||!form||dlg.dataset.v8==='1')return;
  dlg.dataset.v8='1';dlg.classList.add('v8-settings-dialog');
  const oldHead=form.querySelector('.dialog-head'),labels=[...form.querySelectorAll(':scope > label')],note=form.querySelector('.dialog-note'),apply=$('#applySettingsBtn');
  if(!oldHead||labels.length<3||!note||!apply)return;
  oldHead.classList.add('v8-settings-head');const titleWrap=oldHead.firstElementChild,close=oldHead.querySelector('button');
  if(titleWrap&&!titleWrap.querySelector('p')){const p=document.createElement('p');p.textContent='Change the musical grid without leaving your recording session.';titleWrap.appendChild(p)}
  if(close){close.classList.add('v8-dialog-close');close.setAttribute('aria-label','Close settings')}
  const body=document.createElement('div');body.className='v8-settings-body';
  const [bpmLabel,barsLabel,countLabel]=labels,bpm=$('#editSessionBpm'),bars=$('#editSessionBars'),count=$('#editCountIn');
  bpmLabel.className='v8-setting-card';bpmLabel.replaceChildren(v8SettingCopy('♩','Tempo','Sets the speed of the whole session.'));
  const step=document.createElement('div');step.className='v8-bpm-stepper';const down=document.createElement('button'),up=document.createElement('button'),unit=document.createElement('em');down.type=up.type='button';down.textContent='−';up.textContent='+';unit.textContent='BPM';down.setAttribute('aria-label','Decrease BPM');up.setAttribute('aria-label','Increase BPM');down.addEventListener('click',()=>{bpm.value=clamp((+bpm.value||session.bpm||100)-1,40,220)});up.addEventListener('click',()=>{bpm.value=clamp((+bpm.value||session.bpm||100)+1,40,220)});step.append(down,bpm,unit,up);bpmLabel.append(step);
  barsLabel.className='v8-setting-card';barsLabel.replaceChildren(v8SettingCopy('▥','Loop length','Every recorded layer follows this number of bars.'),v8PillGroup(bars,[[1,'1'],[2,'2'],[4,'4'],[8,'8'],[16,'16']]));
  countLabel.className='v8-setting-card';countLabel.replaceChildren(v8SettingCopy('⏱','Count-in','How much lead-in you get before recording begins.'),v8PillGroup(count,[[0,'Off'],[1,'1 bar'],[2,'2 bars'],[4,'4 bars']],true));
  body.append(bpmLabel,barsLabel,countLabel);note.classList.add('v8-settings-note');const footer=document.createElement('div');footer.className='v8-settings-footer';footer.append(apply);
  form.replaceChildren(oldHead,body,note,footer);v8SyncSettingPills();
  dlg.addEventListener('close',()=>$('#sessionSettingsBtn')?.classList.remove('v8-settings-open'));
  apply.addEventListener('click',()=>setTimeout(()=>{$('#sessionSettingsBtn')?.classList.remove('v8-settings-open');v8SyncSettingPills()},0));
}

function v8Init(){
  v8InstallSettingsDialog();
  if(!v8InstallRecordToolbar())setTimeout(v8InstallRecordToolbar,80);
  /* Timeline is installed by V6; a second retry covers slow/stale script activation without duplicating controls. */
  setTimeout(v8InstallRecordToolbar,260);
}
v8Init();
