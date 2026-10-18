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
      row('PvP Ranked: '+(d.pvp?.rankedMatches??0)+' pertandingan | '+(d.pvp?.rewards??0)+' V kompetitif','IN_PROGRESS','Reward from valid skill wins only; no stakes, cap 24V/day'),
      row('WOW mining: '+(d.world?.mined??0)+' kegiatan | Starter: '+(d.world?.starters??0),'IN_PROGRESS','V virtual dari aktivitas, bukan top-up'),
      row('Bursa fiktif: '+(d.world?.marketTrades??0)+' transaksi | Arcade V terikat: '+(d.world?.boundIssued??0),'IN_PROGRESS','Arcade V hanya kosmetik, tidak dapat ditransfer'),
      row('Leaderboard opt-in: '+(d.rankedPlayers??0)+' pemain','DONE','Nickname saja; nomor WhatsApp tidak ditampilkan'),
      row('🌍 World Pulse: '+(d.worldSocial?.pulse?.tier??'CALM')+' · Mining kemarin '+(d.worldSocial?.pulse?.mines??0),'DONE','Bonus guild rally berdasarkan hari sebelumnya: +'+(d.worldSocial?.pulse?.rallyBonus??0)+' XP; tidak mengubah peluang acak'),
      row('🤝 Guild Groups: '+(d.worldSocial?.linkedGroups??0)+' · Rally: '+(d.worldSocial?.rallies??0),'IN_PROGRESS','Owner guild + admin grup terverifikasi; V transfer tetap nonaktif'),
      row('🏰 Guild: '+(d.community?.guilds??0)+' · Anggota: '+(d.community?.members??0)+' · Kas: '+(d.community?.treasury??0)+' V','IN_PROGRESS','Kas guild adalah pengeluaran pemain untuk upgrade Hall, tidak dapat ditarik'),
      row('🏡 Properti: '+(d.community?.properties??0)+' · Quest guild: '+(d.community?.guildQuests??0),'IN_PROGRESS','Bonus properti sekali sehari; kepemilikan account-bound'),
      row('🌦️ World Event: '+(d.worldEvent?.title??'unknown'),'DONE','Event server-wide deterministik, historis dan auditable'),
      row('🌍 Ekspedisi: '+(d.worldIntelligence?.completed??0)+' · Rekomendasi opt-in: '+(d.worldIntelligence?.activeRecommend??0),'DONE','Statistik agregat WOW 2.0, tanpa menampilkan nomor pemain'),
      row('Total XP: '+(d.totalXP??0),'DONE','Data lokal; bukan metrik produksi'),
      row('Teman mutual: '+(d.social?.friendships??0)+' · Duel aktif: '+(d.social?.activeDuels??0),'IN_PROGRESS','Fitur Social Hub, tidak menampilkan nomor telepon'),
      row('Transfer historis (dinonaktifkan): '+(d.social?.transferCount??0)+' transaksi · '+(d.social?.transferVolume??0)+' V','IN_PROGRESS','Bukan V hasil mint: jumlah transfer antar wallet, transfer dilarang dan tanpa top-up'),
      row('AI lokal: '+(d.ai?.successfulCalls??0)+' permintaan berhasil','IN_PROGRESS',
          'Pemakai setuju: '+(d.ai?.consentingPlayers??0)+' · model Ollama opsional, default OFF')
    );}
    const multi=$('multi-lab');
    if(multi){multi.replaceChildren();multi.append(
      row('Antrean sukarela: '+(d.multiplayer?.waiting??0),'IN_PROGRESS','Hanya akun yang mengetik .queue join snakes'),
      row('Pending accept: '+(d.multiplayer?.pending??0)+' · Aktif: '+(d.multiplayer?.active??0),'IN_PROGRESS','Tidak ada notifikasi DM otomatis ke lawan'),
      row('Selesai: '+(d.multiplayer?.completed??0),'DONE','Match history tersimpan dalam SQLite; visual PNG secara on demand'),
      row('📊 Catur selesai: '+(d.intelligence?.chessCompleted??0)+' · Ular Tangga: '+(d.intelligence?.snakesCompleted??0),'IN_PROGRESS','Statistik hasil pertandingan dalam database lokal'),
      row('🧠 Matchmaking: '+(d.intelligence?.matchmaker?.mode??'ELO_FALLBACK'),'IN_PROGRESS','Sampel valid: '+(d.intelligence?.trainingSamples??0)+'; pelatihan ML opsional di mesin lokal')
    );}
    const dev=$('dev-lab');
    if(dev){dev.replaceChildren();dev.append(
      row('Aktif API key: '+(d.developer?.activeKeys??0),'DONE','Terproteksi Bearer + scope. Buat melalui DEV-KEYS.bat'),
      row('Ekstensi JSON aktif: '+(d.developer?.extensions??0),'DONE','Coba .ext list atau .ext hello-world hello'),
      row('Integritas registri: '+(d.developer?.registryHealthy?'OK':'PERIKSA'),'IN_PROGRESS','API hanya read-only; tidak ada endpoint wallet-write')
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
