/*
 * ============================================================================
 * POGI SCRIPTS — HAF Combined (Measure + QC)
 * JavaScript: HAF.js
 * - Merged single-file version
 *
 * Do not edit the code without informing James Pogio
 * Contact: james.pogio@eagleview.com
 * ============================================================================
 */

/* ── TAB SWITCHING ── */
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('panel-active'));
  document.getElementById('tab-' + tab + '-btn').classList.add('tab-active');
  document.getElementById('panel-' + tab).classList.add('panel-active');
  localStorage.setItem('hafActiveTab', tab);
}

/* ── SHARED GLOBALS ── */
let autoReloadEnabled   = true;
let reloadTimerInterval = null;
let reloadTimerStarted  = false;
let loadingDotsInterval = null;
let m_fetchTrainingOnDemand = null;
let q_fetchTrainingOnDemand = null;
let m_trainingFetched = false;
let q_trainingFetched = false;

/* ── DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  const savedTab = localStorage.getItem('hafActiveTab');
  if (savedTab && savedTab !== 'measure') switchTab(savedTab);

  const themeBtn   = document.getElementById('themeToggle');
  const themeIcon  = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');

  function applyTheme(isLight) {
    document.body.classList.toggle('light', isLight);
    if (themeIcon)  themeIcon.textContent  = isLight ? '🌙' : '☀️';
    if (themeLabel) themeLabel.textContent = isLight ? 'Dark' : 'Light';
    localStorage.setItem('hafTheme', isLight ? 'light' : 'dark');
  }
  applyTheme(localStorage.getItem('hafTheme') === 'light');
  if (themeBtn) themeBtn.addEventListener('click', () => applyTheme(!document.body.classList.contains('light')));

  initAutoReloadCheckbox();
  startLoadingDots();

  // Default states: Live ON, Training OFF (unless user already saved a preference)
  [
    { id: 'm-chkLive', defaultOn: true },
    { id: 'm-chkTraining', defaultOn: false },
    { id: 'q-chkLive', defaultOn: true },
    { id: 'q-chkTraining', defaultOn: false }
  ].forEach(({ id, defaultOn }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const isLiveBtn = id.endsWith('chkLive');
    const saved = localStorage.getItem(btn.dataset.key);
    const manualKey = `${btn.dataset.key}_manual`;
    const wasManuallySet = localStorage.getItem(manualKey) === 'true';
    const isStaleLiveOff = isLiveBtn && saved === 'false' && !wasManuallySet;
    const isOn = (saved === null || isStaleLiveOff) ? defaultOn : saved === 'true';
    btn.classList.toggle(btn.dataset.active, isOn);
    if (saved === null || isStaleLiveOff) localStorage.setItem(btn.dataset.key, String(isOn));
  });

  applyAllFilters('m');
  applyAllFilters('q');

  // Restore search
  ['m','q'].forEach(p => {
    const key = 'myInputState_' + p;
    const saved = localStorage.getItem(key);
    if (saved !== null) document.getElementById(p + '-myInput').value = saved;
  });

  // Search keyup
  document.getElementById('m-myInput').addEventListener('keyup', function() {
    localStorage.setItem('myInputState_m', this.value);
    applyAllFilters('m');
  });
  document.getElementById('q-myInput').addEventListener('keyup', function() {
    localStorage.setItem('myInputState_q', this.value);
    applyAllFilters('q');
  });

  // Toggle buttons
  document.querySelectorAll('#panel-measure .toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const isOn = this.classList.toggle(this.dataset.active);
      localStorage.setItem(this.dataset.key, isOn);
      if (this.id === 'm-chkLive') localStorage.setItem(`${this.dataset.key}_manual`, 'true');
      if (this.id === 'm-chkTraining' && isOn && typeof m_fetchTrainingOnDemand === 'function') m_fetchTrainingOnDemand();
      applyAllFilters('m');
    });
  });
  document.querySelectorAll('#panel-qc .toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const isOn = this.classList.toggle(this.dataset.active);
      localStorage.setItem(this.dataset.key, isOn);
      if (this.id === 'q-chkLive') localStorage.setItem(`${this.dataset.key}_manual`, 'true');
      if (this.id === 'q-chkTraining' && isOn && typeof q_fetchTrainingOnDemand === 'function') q_fetchTrainingOnDemand();
      applyAllFilters('q');
    });
  });

  initColumnVisibility('measure-table', 'hiddenCols_measure', 'm-columnControls');
  initColumnVisibility('qc-table',      'hiddenCols_qc',      'q-columnControls');
});

/* ── RELOAD TIMER ── */
function stopReloadTimer() {
  if (reloadTimerInterval) { clearInterval(reloadTimerInterval); reloadTimerInterval = null; }
  reloadTimerStarted = false;
}
function startReloadTimer() {
  if (loadingDotsInterval) { clearInterval(loadingDotsInterval); loadingDotsInterval = null; }
  if (!autoReloadEnabled) {
    const t = document.getElementById('reloadTimer');
    if (t) t.textContent = 'Auto Reload: DISABLED';
    return;
  }
  stopReloadTimer();
  reloadTimerStarted = true;
  let reloadSeconds = 300;
  reloadTimerInterval = setInterval(() => {
    if (!autoReloadEnabled) return;
    reloadSeconds--;
    const m = String(Math.floor(reloadSeconds/60)).padStart(2,'0');
    const s = String(reloadSeconds%60).padStart(2,'0');
    const t = document.getElementById('reloadTimer');
    if (t) t.textContent = `Auto Reload in: ${m}:${s}`;
    if (reloadSeconds <= 0) window.location.reload();
  }, 1000);
}
function initAutoReloadCheckbox() {
  const cb = document.getElementById('enableAutoReload');
  if (!cb) return;
  const saved = localStorage.getItem('autoReloadEnabled');
  if (saved !== null) { autoReloadEnabled = saved === 'true'; cb.checked = autoReloadEnabled; }
  cb.addEventListener('change', e => {
    autoReloadEnabled = e.target.checked;
    localStorage.setItem('autoReloadEnabled', autoReloadEnabled);
    if (autoReloadEnabled) startReloadTimer();
    else { stopReloadTimer(); const t=document.getElementById('reloadTimer'); if(t) t.textContent='Auto Reload: DISABLED'; }
  });
}
function startLoadingDots() {
  const el = document.getElementById('reloadTimer');
  if (!el) return;
  let count = 0; el.textContent = 'Loading';
  loadingDotsInterval = setInterval(() => {
    if (!document.body.contains(el)||!el.textContent.startsWith('Loading')) { clearInterval(loadingDotsInterval); loadingDotsInterval=null; return; }
    count=(count+1)%4; el.textContent='Loading'+'.'.repeat(count);
  }, 500);
}

/* ── UTILITIES ── */
function findElementRecursive(el, tag) {
  tag=tag.toUpperCase(); while(el){if(el.nodeName===tag)return el;el=el.parentNode;} return null;
}
function fetchWithRetry(url,options={},retries=10,delay=1000) {
  return fetch(url,options).then(r=>{if(!r.ok)throw new Error('Network error');return r.json();})
    .catch(err=>{ if(retries>0) return new Promise(res=>setTimeout(res,delay)).then(()=>fetchWithRetry(url,options,retries-1,delay)); throw err; });
}
function fetchJsonRetryNoHealthyUpstream(url,options={},retries=3,delay=700){
  return fetch(url,options)
    .then(async r=>{
      const text=await r.text();
      const hasNoHealthyUpstream=/no healthy upstream/i.test(text||'');

      if ((!r.ok || hasNoHealthyUpstream) && retries>0){
        return new Promise(res=>setTimeout(res,delay)).then(()=>fetchJsonRetryNoHealthyUpstream(url,options,retries-1,delay));
      }
      if (!r.ok) throw new Error('Network error');

      try { return JSON.parse(text); }
      catch (err){
        if (hasNoHealthyUpstream && retries>0){
          return new Promise(res=>setTimeout(res,delay)).then(()=>fetchJsonRetryNoHealthyUpstream(url,options,retries-1,delay));
        }
        throw err;
      }
    });
}
function escapeHtml(value=''){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function fetchMeasureReworkDetails(reportId,locationName){
  if(!/bogota/i.test(locationName||'')) return Promise.resolve('');
  const jobUrl=`https://api.cmh.platform-prod.evinternal.net/inform-measures/hipster/v3/job?requester_id=${encodeURIComponent(reportId)}&source=gov`;
  return fetchJsonRetryNoHealthyUpstream(jobUrl,{},3,700)
    .then(jobData=>{
      const jobId=jobData?.ID;
      if(!jobId) return '';
      const notesUrl=`https://api.cmh.platform-prod.evinternal.net/inform-measures/hipster/v3/note?job_id=${encodeURIComponent(jobId)}`;
      return fetchWithRetry(notesUrl,{},2,500)
        .then(noteData=>{
          const notes=Array.isArray(noteData?.Notes)?noteData.Notes:[];
          const match=notes.find(n=>{
            const value=String(n?.Value||'');
            return value && !/job rejected/i.test(value);
          });
          return match?.Value||'';
        });
    })
    .catch(()=> '');
}

/* ── SORTABLE TABLE ── */
document.addEventListener('click', e => {
  try {
    const altKey = e.shiftKey||e.altKey;
    const th = findElementRecursive(e.target,'TH'); if(!th) return;
    const tr=th.parentNode, thead=tr?.parentNode, table=thead?.parentNode;
    if(!thead||thead.nodeName!=='THEAD') return;
    if(!table||!table.classList.contains('sortable')) return;
    if(th.classList.contains('no-sort')) return;

    function getValue(cell){const v=altKey?cell.dataset.sortAlt:cell.dataset.sort;return v??cell.textContent.trim();}

    let colIndex; const cells=tr.cells;
    for(let i=0;i<cells.length;i++){if(cells[i]===th)colIndex=Number(th.dataset.sortCol)||i;else cells[i].setAttribute('aria-sort','none');}

    let direction='descending'; const current=th.getAttribute('aria-sort');
    if(current==='descending'||(table.classList.contains('asc')&&current!=='ascending')) direction='ascending';
    th.setAttribute('aria-sort',direction); const reverse=direction==='ascending';
    const nullLast=table.classList.contains('n-last');

    const compare=(a,b,index)=>{
      const x=getValue(b.cells[index]),y=getValue(a.cells[index]);
      if(nullLast){if(x===''&&y!=='')return -1;if(y===''&&x!=='')return 1;}
      const num=+x-+y; const result=Number.isNaN(num)?String(x).localeCompare(String(y)):num;
      return reverse?-result:result;
    };
    for(let i=0;i<table.tBodies.length;i++){
      const oldBody=table.tBodies[i]; const rows=Array.from(oldBody.rows); const tbr=Number(th.dataset.sortTbr);
      rows.sort((a,b)=>{
        const aT=a.dataset.type==='training'?1:0,bT=b.dataset.type==='training'?1:0;
        if(aT!==bT)return aT-bT; const r=compare(a,b,colIndex);
        return r===0&&!Number.isNaN(tbr)?compare(a,b,tbr):r;
      });
      const newBody=oldBody.cloneNode(); newBody.append(...rows); table.replaceChild(newBody,oldBody);
    }
  } catch(err){console.error('sortable click handler error:',err);}
});

function sortTableByColumn(tableId,colIndex,ascending=true){
  const table=document.getElementById(tableId); if(!table)return;
  const tbody=table.tBodies[0]; if(!tbody)return;
  const rows=Array.from(tbody.rows);
  rows.sort((a,b)=>{
    const aT=a.dataset.type==='training'?1:0,bT=b.dataset.type==='training'?1:0;
    if(aT!==bT)return aT-bT;
    const x=parseFloat(a.cells[colIndex]?.dataset.seconds||'0'),y=parseFloat(b.cells[colIndex]?.dataset.seconds||'0');
    return ascending?x-y:y-x;
  });
  tbody.innerHTML=''; rows.forEach(r=>tbody.appendChild(r));
}

/* ── COLUMN VISIBILITY ── */
const colVisState={};
function initColumnVisibility(tableId,storageKey,controlsId){
  if(!colVisState[tableId]) colVisState[tableId]={initialized:false,key:storageKey,controlsId};
  if(colVisState[tableId].initialized){reapplyColumnVisibility(tableId);return;}
  const table=document.getElementById(tableId); if(!table)return;
  const thead=table.tHead; if(!thead)return;
  const headerRow=thead.rows[0];
  const controls=document.getElementById(controlsId); if(!controls)return;
  controls.innerHTML='';
  const hiddenCols=getHiddenColumns(tableId);
  [...headerRow.cells].forEach((th,index)=>{
    const colName=th.textContent.replace(/[↑↓]/g,'').replace(/\s*\(\d+\)/,'').trim()||`Col ${index+1}`;
    const isHidden=hiddenCols.includes(index);
    const chip=document.createElement('button');
    chip.className='col-chip'+(isHidden?'':' col-on');
    chip.textContent=colName; chip.title=isHidden?'Show column':'Hide column';
    chip.addEventListener('click',()=>{
      const nowHidden=chip.classList.contains('col-on');
      chip.classList.toggle('col-on',!nowHidden); chip.title=nowHidden?'Show column':'Hide column';
      toggleColumn(tableId,index,nowHidden);
    });
    controls.appendChild(chip);
    if(isHidden)applyColumnHidden(tableId,index,true);
  });
  colVisState[tableId].initialized=true;
}
function reapplyColumnVisibility(tableId){getHiddenColumns(tableId).forEach(ci=>applyColumnHidden(tableId,ci,true));}
function toggleColumn(tableId,colIndex,hide){
  applyColumnHidden(tableId,colIndex,hide);
  let h=getHiddenColumns(tableId);
  if(hide&&!h.includes(colIndex))h.push(colIndex);
  if(!hide)h=h.filter(i=>i!==colIndex);
  localStorage.setItem(colVisState[tableId].key,JSON.stringify(h));
}
function applyColumnHidden(tableId,colIndex,hide){
  const table=document.getElementById(tableId); if(!table)return;
  const method=hide?'add':'remove';
  table.tHead?.rows[0]?.cells[colIndex]?.classList[method]('hidden-column');
  [...table.tBodies].forEach(tb=>[...tb.rows].forEach(row=>row.cells[colIndex]?.classList[method]('hidden-column')));
}
function getHiddenColumns(tableId){
  try{return JSON.parse(localStorage.getItem(colVisState[tableId]?.key))||[];}catch{return [];}
}

/* ── DYNAMIC TIMERS ── */
const dynamicTimersStarted={};
function startDynamicTimers(dataId){
  if(dynamicTimersStarted[dataId])return; dynamicTimersStarted[dataId]=true;
  setInterval(()=>{
    document.querySelectorAll(`#${dataId} td.elapsed`).forEach(td=>{
      let sec=parseInt(td.dataset.seconds||'0',10); sec++; td.dataset.seconds=sec;
      const h=String(Math.floor(sec/3600)).padStart(2,'0');
      const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
      const s=String(sec%60).padStart(2,'0');
      const isTraining=td.closest('tr')?.dataset.type==='training';
      if(sec>=10800&&!isTraining)td.style.color='red';
      else if(sec>=7200)td.style.color='orangered';
      else if(sec>=3600)td.style.color='DarkOrange';
      else td.style.color='';
      td.textContent=`${h}:${m}:${s}`;
    });
  },1000);
  setInterval(()=>{
    document.querySelectorAll(`#${dataId} td.due`).forEach(td=>{
      let sec=parseInt(td.dataset.seconds||'0',10); sec--; td.dataset.seconds=sec;
      const abs=Math.abs(sec);
      const h=abs>=3600?String(Math.floor(abs/3600)).padStart(2,'0'):'00';
      const m=String(Math.floor((abs%3600)/60)).padStart(2,'0');
      const s=String(abs%60).padStart(2,'0');
      if(sec<0){td.style.color='red';td.textContent=`-${h}:${m}:${s}`;}
      else if(sec<3600){td.style.color='red';td.textContent=`${h}:${m}:${s}`;}
      else if(sec<7200){td.style.color='orangered';td.textContent=`${h}:${m}:${s}`;}
      else if(sec<10800){td.style.color='DarkOrange';td.textContent=`${h}:${m}:${s}`;}
      else{td.style.color='';td.textContent=`${h}:${m}:${s}`;}
    });
  },1000);
}

/* ── APPLY ALL FILTERS ── */
function applyAllFilters(prefix){
  const searchValue =(document.getElementById(`${prefix}-myInput`)?.value||'').trim().toLowerCase();
  const defaultValue=(document.getElementById(`${prefix}-defaultFilter`)?.value||'').trim().toLowerCase();
  const showLive    =document.getElementById(`${prefix}-chkLive`)?.classList.contains('active-live')??false;
  const showTraining=document.getElementById(`${prefix}-chkTraining`)?.classList.contains('active-training')??false;
  let visibleLive=0,visibleLate=0,visibleTotal=0;
  $(`#${prefix}-data tr`).each(function(){
    const text=$(this).text().toLowerCase();
    const matchSearch =searchValue===''?true:text.includes(searchValue);
    const matchDefault=defaultValue===''?true:defaultValue.split('|').some(v=>text.includes(v.trim()));
    const rowType=$(this).data('type');
    const isLive=rowType==='live', isTrain=rowType==='training';
    const matchType=(!showLive&&!showTraining)?false:((isLive&&showLive)||(isTrain&&showTraining));
    const show=matchSearch&&matchDefault&&matchType;
    $(this).toggle(show);
    if(show){visibleTotal++;if(isLive)visibleLive++;const d=this.cells[this.cells.length-1];if(d&&d.style.color==='red')visibleLate++;}
  });
  const fc=document.getElementById(`${prefix}-fileCount`); if(fc)fc.innerHTML=`Reports (${visibleTotal})`;
  const pl=document.getElementById(`${prefix}-statLive`),pt=document.getElementById(`${prefix}-statLate`),pn=document.getElementById(`${prefix}-statTotal`);
  if(pl)pl.textContent=`Live: ${visibleLive}`;if(pt)pt.textContent=`Late: ${visibleLate}`;if(pn)pn.textContent=`Total: ${visibleTotal}`;
}

/* ============================================================================
   MEASURE: MAIN DATA FETCH
   ============================================================================ */
let m_pendingFetches=0, m_fileCount=0;

(function measureMain(){
  fetchWithRetry('https://timeapi.io/api/Time/current/zone?timeZone=America/Los_Angeles')
  .then(td=>{
    const ocTime=new Date(td.dateTime);
    return fetch('https://api.cmh.platform-prod2.evinternal.net/operations-center/api/Team')
      .then(r=>r.ok?r.json():Promise.reject()).then(d=>({ocTime,dictTeam:new Map(d.map(t=>[t.teamId,t.name]))}));
  })
  .then(({ocTime,dictTeam})=>fetch('https://api.cmh.platform-prod2.evinternal.net/operations-center/api/Location')
    .then(r=>r.ok?r.json():Promise.reject()).then(d=>({ocTime,dictTeam,dictLocation:new Map(d.map(l=>[l.id,l.description]))})))
  .then(({ocTime,dictTeam,dictLocation})=>{
    const apiBMUrl        ='https://api.cmh.platform-prod.evinternal.net/operations-center/api/TaskTrafficView/?type=16&value=beingmeasured&type=30&value=test&type=30&value=training&type=26&value=true&type=18&value=HQ&type=33&value=3DRoofHipster';
    const apiRTMUrl       ='https://api.cmh.platform-prod.evinternal.net/operations-center/api/TaskTrafficView/?type=16&value=readytomeasure&type=30&value=test&type=30&value=training&type=26&value=true&type=18&value=HQ&type=15&value=null&type=33&value=3DRoofHipster';
    const apiTrainingRTM  ='https://api.cmh.platform-prod.evinternal.net/operations-center/api/TaskTrafficView/?type=16&value=readytomeasure&type=29&value=test&type=29&value=training&type=26&value=true&type=18&value=HQ&type=15&value=null&';
    const apiTrainingBM   ='https://api.cmh.platform-prod.evinternal.net/operations-center/api/TaskTrafficView/?type=16&value=beingmeasured&type=29&value=test&type=29&value=training&type=26&value=true&type=18&value=HQ&';

    function processList(apiData=[],isRTM=false,isTraining=false){
      if(!Array.isArray(apiData))return;
      apiData.forEach(item=>{
        m_pendingFetches++; m_fileCount++;
        fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/Report/${item.reportID}`)
          .then(r=>r.ok?r.json():Promise.reject())
          .then(report=>{
            const pmText=report.pmReportID?' [PM]':'';
            return fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/TaskState/id/${item.taskStateID}`)
              .then(r=>r.ok?r.json():Promise.reject())
              .then(task=>fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/TaskState/${task.taskID}`)
                .then(r=>r.ok?r.json():Promise.reject())
                .then(task2=>{
                  const entries=Array.isArray(task2)?task2:[];
                  const firstRTM=entries.filter(e=>e.description==='ReadyToMeasure-StateTransition').sort((a,b)=>new Date(a.stateTime)-new Date(b.stateTime))[0];
                  const sorted=entries.filter(e=>e.description&&e.description.includes('Rejected')&&firstRTM&&new Date(e.stateTime)>new Date(firstRTM.stateTime)).sort((a,b)=>new Date(a.stateTime)-new Date(b.stateTime));
                  const rejectedCounts=new Map();
                  sorted.forEach(e=>{const match=e.description.match(/Rejected\(([^)]+)\)/);if(match){const t=match[1];rejectedCounts.set(t,(rejectedCounts.get(t)||0)+1);}});
                  return{report,pmText,task,rejectedCounts};
                }));
          })
          .then(({report,pmText,task,rejectedCounts})=>{
            const userID=isRTM?task.preferredUserID:task.userID;
            return fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/User/id?ids=${userID}`)
              .then(r=>r.ok?r.json():Promise.reject()).then(user=>({report,pmText,task,rejectedCounts,user}));
          })
          .then(({report,pmText,task,rejectedCounts,user})=>
            fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/Report/${item.reportID}/measurement-items`)
              .then(r=>r.ok?r.json():Promise.reject()).then(mItems=>({report,pmText,task,rejectedCounts,user,mItems})))
          .then(({report,pmText,task,rejectedCounts,user,mItems})=>{
            const locationName=dictLocation.get(user[0]?.locationId)??'';
            const hasReworkHistory=[...rejectedCounts.keys()].some(type=>/rework/i.test(type));
            if (!hasReworkHistory) {
              return {report,pmText,task,rejectedCounts,user,mItems,reworkDetails:'',locationName};
            }
            return fetchMeasureReworkDetails(item.reportID,locationName)
              .then(reworkDetails=>({report,pmText,task,rejectedCounts,user,mItems,reworkDetails,locationName}));
          })
          .then(({report,pmText,task,rejectedCounts,user,mItems,reworkDetails,locationName})=>{
            const mText=(mItems.measurementItems||[]).map(m=>'*'+(m.name||'').replace(/\s+/g,'')).join('  ');
            const rejectedSuffix=[...rejectedCounts.entries()].map(([type,count])=>`<span style="color:${count>1?'red':isRTM?'var(--text-primary)':'var(--text-secondary)'};">${type} ${count}x</span>`).join('<br>');
            const reworkHtml=escapeHtml(reworkDetails).replace(/\n/g,'<br>');
            let row=`<tr data-type="${isTraining?'training':'live'}">
<td><span class="${isTraining?'badge-training':'badge-live'}">${isTraining?'Training':'Live'}</span></td>
<td>${item.reportID}</td>
<td>${user[0]?.userName??''}</td>
<td style="color:${isRTM?'var(--text-primary)':'var(--text-secondary)'};">${isRTM?'Ready To Measure':'Being Measured'}</td>
<td style="color:${isRTM?'var(--text-primary)':'var(--text-secondary)'};">${rejectedSuffix}</td>
<td style="color:${isRTM?'var(--text-primary)':'var(--text-secondary)'};">${reworkHtml}</td>
<td>${user[0]?.techUsername??''}</td>
<td>${dictTeam.get(user[0]?.teamId)??''}</td><td>${locationName}</td>
<td>${mText}${pmText}</td>`;
            const stateTime=new Date(task.stateTime),minutes=(ocTime-stateTime)/60000;
            const h=String(Math.abs(Math.floor(minutes/60))).padStart(2,'0');
            const m=String(Math.abs(Math.floor(minutes%60))).padStart(2,'0');
            const s=String(Math.abs(Math.floor(((minutes%60)%1)*60))).padStart(2,'0');
            const elapsedSec=Math.floor(minutes*60);
            row+=minutes>=180&&!isTraining?`<td class="elapsed" data-seconds="${elapsedSec}" style="color:red;">${h}:${m}:${s}</td>`:`<td class="elapsed" data-seconds="${elapsedSec}">${h}:${m}:${s}</td>`;
            const due=(new Date(item.dueDate)-ocTime)/60000,dueSec=Math.floor(due*60),abs2=Math.abs(dueSec);
            const hd=String(Math.floor(abs2/3600)).padStart(2,'0'),md=String(Math.floor((abs2%3600)/60)).padStart(2,'0'),sd=String(abs2%60).padStart(2,'0');
            let dc='',dd=`${hd}:${md}:${sd}`;
            if(dueSec<0){dc='red';dd=`-${dd}`;}else if(dueSec<3600)dc='red';else if(dueSec<7200)dc='orangered';else if(dueSec<10800)dc='DarkOrange';
            row+=`<td class="due" data-seconds="${dueSec}" style="color:${dc};">${dd}</td></tr>`;
            const tbody=document.getElementById('m-data');
            if(tbody){const tmp=document.createElement('tbody');tmp.innerHTML=row;const nr=tmp.firstElementChild;if(nr)tbody.appendChild(nr);}
            document.getElementById('m-fileCount').innerHTML=`Reports (${m_fileCount})`;
            applyAllFilters('m');
            initColumnVisibility('measure-table','hiddenCols_measure','m-columnControls');
            m_pendingFetches--;
            if(m_pendingFetches===0){sortTableByColumn('measure-table',11,true);colorDuplicateMeasureUsernames();startDynamicTimers('m-data');if(!reloadTimerStarted)startReloadTimer();}
          })
          .catch(err=>{
            console.error('measure report chain error:',err);
            m_pendingFetches=Math.max(0,m_pendingFetches-1);
            if(m_pendingFetches===0){sortTableByColumn('measure-table',11,true);colorDuplicateMeasureUsernames();startDynamicTimers('m-data');if(!reloadTimerStarted)startReloadTimer();}
          });
      });
    }

    const loadMeasureTrainingData = () => {
      if (m_trainingFetched) return;
      m_trainingFetched = true;
      fetch(apiTrainingBM) .then(r=>r.ok?r.json():Promise.reject()).then(d=>processList(d,false,true)).catch(e=>console.error('apiTrainingBM:',e));
      fetch(apiTrainingRTM).then(r=>r.ok?r.json():Promise.reject()).then(d=>processList(d,true,true)).catch(e=>console.error('apiTrainingRTM:',e));
    };
    m_fetchTrainingOnDemand = loadMeasureTrainingData;

    Promise.all([
      fetch(apiBMUrl) .then(r=>r.ok?r.json():Promise.reject()).then(d=>processList(d,false,false)).catch(e=>console.error('apiBMUrl:',e)),
      fetch(apiRTMUrl).then(r=>r.ok?r.json():Promise.reject()).then(d=>processList(d,true,false)).catch(e=>console.error('apiRTMUrl:',e))
    ]).then(()=>{
      if (document.getElementById('m-chkTraining')?.classList.contains('active-training')) loadMeasureTrainingData();
    });
  }).catch(err=>console.error('measure main chain error:',err));
})();

function colorDuplicateMeasureUsernames(){
  const table=document.getElementById('measure-table'); if(!table)return;
  const tbody=table.tBodies[0]; if(!tbody)return;
  const rows=Array.from(tbody.rows);
  const uC=new Map(),tC=new Map();
  rows.forEach(row=>{
    const cells=row.cells;
    if(cells.length>=7&&cells[3].textContent.trim().includes('Being Measured')&&row.dataset.type!=='training'){
      const u=cells[2].textContent.trim(),t=cells[6].textContent.trim();
      if(u)uC.set(u,(uC.get(u)||0)+1); if(t)tC.set(t,(tC.get(t)||0)+1);
    }
  });
  rows.forEach(row=>{
    const cells=row.cells;
    if(cells.length>=7&&cells[3].textContent.trim().includes('Being Measured')&&row.dataset.type!=='training'){
      const u=cells[2].textContent.trim(),t=cells[6].textContent.trim();
      if(u&&uC.get(u)>1)cells[2].style.color='red';
      if(t&&tC.get(t)>1)cells[6].style.color='red';
    }
  });
}

/* ============================================================================
   QC: MAIN DATA FETCH
   ============================================================================ */
let q_pendingFetches=0, q_fileCount=0;

(function qcMain(){
  fetchWithRetry('https://timeapi.io/api/Time/current/zone?timeZone=America/Los_Angeles')
  .then(td=>{
    const ocTime=new Date(td.dateTime);
    return fetch('https://api.cmh.platform-prod2.evinternal.net/operations-center/api/Team')
      .then(r=>r.ok?r.json():Promise.reject()).then(d=>({ocTime,dictTeam:new Map(d.map(t=>[t.teamId,t.name]))}));
  })
  .then(({ocTime,dictTeam})=>fetch('https://api.cmh.platform-prod2.evinternal.net/operations-center/api/Location')
    .then(r=>r.ok?r.json():Promise.reject()).then(d=>({ocTime,dictTeam,dictLocation:new Map(d.map(l=>[l.id,l.description]))})))
  .then(({ocTime,dictTeam,dictLocation})=>{
    const apiBQced      ='https://api.cmh.platform-prod.evinternal.net/operations-center/api/TaskTrafficView/?type=16&value=beingqced&type=30&value=test&type=30&value=training&type=26&value=true&type=18&value=HQ&';
    const apiRFQC       ='https://api.cmh.platform-prod.evinternal.net/operations-center/api/TaskTrafficView/?type=16&value=readyforqc&type=30&value=test&type=30&value=training&type=26&value=true&type=18&value=HQ&';
    const apiTrainingRFQC ='https://api.cmh.platform-prod.evinternal.net/operations-center/api/TaskTrafficView/?type=16&value=readyforqc&type=29&value=test&type=29&value=training&type=26&value=true&type=18&value=HQ&';
    const apiTrainingBQced='https://api.cmh.platform-prod.evinternal.net/operations-center/api/TaskTrafficView/?type=16&value=beingqced&type=29&value=test&type=29&value=training&type=26&value=true&type=18&value=HQ&';

    function processList(apiData=[],isRFQC=false,isTraining=false){
      if(!Array.isArray(apiData))return;
      apiData.forEach(item=>{
        q_pendingFetches++; q_fileCount++;
        let lastMeasured=null;
        fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/Report/${item.reportID}`)
          .then(r=>r.ok?r.json():Promise.reject())
          .then(report=>{
            const pmText=report.pmReportID?' [PM]':'';
            return fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/TaskState/id/${item.taskStateID}`)
              .then(r=>r.ok?r.json():Promise.reject())
              .then(task=>fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/TaskState/report/${item.reportID}`)
                .then(r=>r.ok?r.json():Promise.reject())
                .then(taskReport=>{
                  if(Array.isArray(taskReport.taskStates)){
                    const measured=taskReport.taskStates.filter(ts=>ts.description&&ts.description.includes('Measured-CheckIn'));
                    if(measured.length>0)lastMeasured=measured[measured.length-1];
                  }
                  return fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/TaskState/${task.taskID}`)
                    .then(r=>r.ok?r.json():Promise.reject())
                    .then(task2=>({report,pmText,task,isRework:JSON.stringify(task2).includes('Rework')}));
                }));
          })
          .then(({report,pmText,task,isRework})=>{
            const userID=isRFQC?task.preferredUserID:task.userID;
            const userPromise=userID
              ?fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/User/id?ids=${userID}`).then(r=>r.ok?r.json():Promise.reject())
              :Promise.resolve([{userName:null,techUsername:null,teamId:null,locationId:null}]);
            return userPromise.then(user=>({report,pmText,task,isRework,user}));
          })
          .then(({report,pmText,task,isRework,user})=>
            fetch(`https://api.cmh.platform-prod2.evinternal.net/operations-center/api/Report/${item.reportID}/measurement-items`)
              .then(r=>r.ok?r.json():Promise.reject()).then(mItems=>({report,pmText,task,isRework,user,mItems})))
          .then(({report,pmText,task,isRework,user,mItems})=>{
            const mText=(mItems.measurementItems||[]).map(m=>'*'+(m.name||'').replace(/\s+/g,'')).join('  ');
            const typeBadge=isTraining?'<span class="badge-training">Training</span>':'<span class="badge-live">Live</span>';
            const stateLabel=isRFQC?`Ready For QC${isRework?' (Rework)':''}`:`Being Qced${isRework?' (Rework)':''}`;
            let row=`<tr data-type="${isTraining?'training':'live'}">
<td>${typeBadge}</td>
<td>${item.reportID}</td>
<td style="color:${isRFQC?'var(--text-primary)':'var(--text-secondary)'};">${stateLabel}</td>
<td>${lastMeasured&&lastMeasured.description?(lastMeasured.description.match(/\(([^)]+)\)/)||[])[1]||'':''}</td>
<td>${user[0]?.userName??''}</td><td>${user[0]?.techUsername??''}</td>
<td>${dictTeam.get(user[0]?.teamId)??''}</td><td>${dictLocation.get(user[0]?.locationId)??''}</td>
<td>${mText}${pmText}</td>`;
            const stateTime=new Date(task.stateTime),minutes=(ocTime-stateTime)/60000;
            const h=String(Math.abs(Math.floor(minutes/60))).padStart(2,'0');
            const m=String(Math.abs(Math.floor(minutes%60))).padStart(2,'0');
            const s=String(Math.abs(Math.floor(((minutes%60)%1)*60))).padStart(2,'0');
            const elapsedSec=Math.floor(minutes*60);
            row+=minutes>=180&&!isTraining?`<td class="elapsed" data-seconds="${elapsedSec}" style="color:red;">${h}:${m}:${s}</td>`:`<td class="elapsed" data-seconds="${elapsedSec}">${h}:${m}:${s}</td>`;
            const due=(new Date(item.dueDate)-ocTime)/60000,dueSec=Math.floor(due*60),abs2=Math.abs(dueSec);
            const hd=String(Math.floor(abs2/3600)).padStart(2,'0'),md=String(Math.floor((abs2%3600)/60)).padStart(2,'0'),sd=String(abs2%60).padStart(2,'0');
            let dc='',dd=`${hd}:${md}:${sd}`;
            if(dueSec<0){dc='red';dd=`-${dd}`;}else if(dueSec<3600)dc='red';else if(dueSec<7200)dc='orangered';else if(dueSec<10800)dc='DarkOrange';
            row+=`<td class="due" data-seconds="${dueSec}" style="color:${dc};">${dd}</td></tr>`;
            const tbody=document.getElementById('q-data');
            if(tbody){const tmp=document.createElement('tbody');tmp.innerHTML=row;const nr=tmp.firstElementChild;if(nr)tbody.appendChild(nr);}
            document.getElementById('q-fileCount').innerHTML=`Reports (${q_fileCount})`;
            applyAllFilters('q');
            initColumnVisibility('qc-table','hiddenCols_qc','q-columnControls');
            q_pendingFetches--;
            if(q_pendingFetches===0){sortTableByColumn('qc-table',10,true);startDynamicTimers('q-data');if(!reloadTimerStarted)startReloadTimer();}
          })
          .catch(err=>{
            console.error('qc report chain error:',err);
            q_pendingFetches=Math.max(0,q_pendingFetches-1);
            if(q_pendingFetches===0){sortTableByColumn('qc-table',10,true);startDynamicTimers('q-data');if(!reloadTimerStarted)startReloadTimer();}
          });
      });
    }

    const loadQcTrainingData = () => {
      if (q_trainingFetched) return;
      q_trainingFetched = true;
      fetch(apiTrainingBQced).then(r=>r.ok?r.json():Promise.reject()).then(d=>processList(d,false,true)).catch(e=>console.error('apiTrainingBQced:',e));
      fetch(apiTrainingRFQC) .then(r=>r.ok?r.json():Promise.reject()).then(d=>processList(d,true,true)).catch(e=>console.error('apiTrainingRFQC:',e));
    };
    q_fetchTrainingOnDemand = loadQcTrainingData;

    Promise.all([
      fetch(apiBQced).then(r=>r.ok?r.json():Promise.reject()).then(d=>processList(d,false,false)).catch(e=>console.error('apiBQced:',e)),
      fetch(apiRFQC) .then(r=>r.ok?r.json():Promise.reject()).then(d=>processList(d,true,false)).catch(e=>console.error('apiRFQC:',e))
    ]).then(()=>{
      if (document.getElementById('q-chkTraining')?.classList.contains('active-training')) loadQcTrainingData();
    });
  }).catch(err=>console.error('qc main chain error:',err));
})();
