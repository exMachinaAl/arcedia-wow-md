const $ = id => document.getElementById(id);
let tasks=[];
let filter='ALL';
function row(label,status,meta){
  const item=document.createElement('div'); item.className='track-row';
  const left=document.createElement('div');left.className='track-left';
  const title=document.createElement('b'); title.textContent=label;
  const line=document.createElement('small');line.textContent=meta||'';
  const badge=document.createElement('span');badge.className='tag '+status.toLowerCase().replace(/_/g,'-');badge.textContent=status.replaceAll('_',' ');
  left.append(title,line);item.append(left,badge);return item;
}
function showTasks(){
  const out=$('task-list');out.replaceChildren();
  const visible=tasks.filter(t=>filter==='ALL'||t.status===filter);
  $('task-caption').textContent=`${visible.length} of ${tasks.length} tasks`;
  for(const t of visible) out.append(row(`${t.id} · ${t.title}`,t.status,t.milestone));
  if(!visible.length)out.append(row('Tidak ada pekerjaan untuk filter ini','EMPTY',''));
}
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{
  filter=b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));
  showTasks();
});
(async()=>{
  try {
    const res=await fetch('/api/status',{cache:'no-store'});
    if(!res.ok)throw Error('HTTP '+res.status);
    const d=await res.json();
    $('tasks').textContent=d.taskCounts.done+' / '+d.taskCounts.total;
    $('games').textContent=d.games.playable+' / '+d.games.target;
    $('users').textContent=d.users;
    $('money').textContent=d.virtualCurrencyIssued.toLocaleString('id-ID');
    $('version').textContent='v'+d.version;
    const milestones=$('milestones');milestones.replaceChildren();
    d.milestones.forEach(m=>{
      const el=document.createElement('div');el.className='milestone';
      const ico=document.createElement('div');ico.className='marker '+(m.status==='DONE'?'done':m.status==='IN_PROGRESS'?'progress':'');
      ico.textContent=m.status==='DONE'?'✓':m.status==='IN_PROGRESS'?'◉':'○';
      const content=document.createElement('div'); const h=document.createElement('h3');h.textContent=m.id+' · '+m.name;
      const p=document.createElement('p');p.textContent=m.status.replace('_',' ');
      content.append(h,p);el.append(ico,content);milestones.append(el);
    });
    tasks=d.tasks;showTasks();
    const s=d.waStatus || {connection:'not-started'}, b=d.buttonStats||{};
    const economy=$('economy-lab');
    if(economy){economy.replaceChildren();economy.append(
      row('Daily claims: '+(d.dailyClaims??0),'DONE','Reset klaim per 00:00 WIB; hadiah 10 V + 5 XP'),
      row('Leaderboard opt-in: '+(d.rankedPlayers??0)+' pemain','DONE','Nickname saja; nomor WhatsApp tidak ditampilkan'),
      row('Total XP: '+(d.totalXP??0),'DONE','Data lokal; bukan metrik produksi')
    );}
    const wa=$('wa-lab');
    if(wa){wa.replaceChildren();wa.append(
      row('Koneksi: '+s.connection,'IN_PROGRESS','Update: '+(s.updatedAt||'Belum pernah dijalankan')),
      row('Button attempts: '+(b.attempts||0)+' | panels: '+(b.panelAttempts||0)+' | relayed (unverified): '+(b.relayed||0),'IN_PROGRESS','Relay success does NOT prove buttons rendered on WhatsApp'),
      row('Button clicks: '+(b.clicked||0)+' | shown: '+(b.shown||0)+' | hidden: '+(b.hidden||0),'IN_PROGRESS','Reported by tester, not automatically verified: '+(b.clickReports||0)+' clicked')
    );}

    const qa=d.qa;
    const qaList=$('qa-list');
    if(qaList){
      qaList.replaceChildren();
      $('qa-gate').textContent=qa?`AUTO: ${qa.offlineGate} · LIVE: ${qa.liveGate}`:'Jalankan QA-ONE-CLICK.bat';
      if(qa)for(const item of qa.checks){
        qaList.append(row(`${item.flag} · ${item.name}`,item.status,`${item.method} / ${item.id} · ${item.detail}`));
      }
      else qaList.append(row('Belum ada report lokal','PENDING_LIVE','QA-ONE-CLICK.bat → data/qa-report.json'));
    }
    const histories=$('updates-history');
    if(d.updateHistory.length){histories.replaceChildren();for(const h of d.updateHistory.slice().reverse())histories.append(row(`${h.before} → ${h.after}`,h.status,h.installedAt));}
  }catch(e){$('version').textContent='Dashboard error: '+e.message;}
})();
