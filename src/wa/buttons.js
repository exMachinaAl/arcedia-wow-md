/**
 * WA-WORLD native button experiment (Baileys / unofficial WhatsApp Web transport).
 * A successful relay means "submitted", NOT "visible on recipient device".
 * Keep text alternatives in the SAME message instead of sending a separate fake menu.
 */
export const BUTTONS=Object.freeze([
  {id:'waw:menu',title:'🏠 Menu',command:'.menu'},
  {id:'waw:games',title:'🎮 Games',command:'.games'},
  {id:'waw:wallet',title:'💰 Wallet',command:'.wallet'}
]);

/** Real native quick-reply panels: unique IDs mapped through an explicit allowlist. */
export const PANELS=Object.freeze({
  groupdemo:Object.freeze({title:'WOW Group Button Lab',buttons:[
    {id:'waw:menu',title:'🏠 Menu',command:'.menu'},
    {id:'waw:games',title:'🎮 Games',command:'.games'},
    {id:'waw:more:nav',title:'📚 Jelajah',command:'.nav more'}]}),
  wowgameshub:Object.freeze({title:'WOW • Game Navigator',buttons:[
    {id:'waw:v34:g:bj',title:'🃏 Blackjack',command:'.bj status'},
    {id:'waw:v34:g:chess',title:'♟️ Catur',command:'.chess lobby'},
    {id:'waw:v34:g:world',title:'🌍 World',command:'.hub world'}]}),
  wowworldhub:Object.freeze({title:'WOW • World Life',buttons:[
    {id:'waw:v34:w:mine',title:'⛏️ Mining',command:'.mine'},
    {id:'waw:v34:w:daily',title:'🎁 Daily',command:'.daily'},
    {id:'waw:v34:w:econ',title:'💰 Ekonomi',command:'.hub economy'}]}),
  woweconomyhub:Object.freeze({title:'WOW • Economy Navigator',buttons:[
    {id:'waw:v34:e:wallet',title:'💰 Dompet',command:'.wallet'},
    {id:'waw:v34:e:shop',title:'🛍️ Shop',command:'.dailyshop'},
    {id:'waw:v34:e:identity',title:'🎨 Style',command:'.hub identity'}]}),
  wowidentityhub:Object.freeze({title:'WOW • Chat Identity',buttons:[
    {id:'waw:v34:i:style',title:'🎭 Style',command:'.chatstyle'},
    {id:'waw:v34:i:signature',title:'✨ Signature',command:'.chatstyle signature'},
    {id:'waw:v34:i:profile',title:'👤 Profil',command:'.profile'}]}),
  wowarenahub:Object.freeze({title:'WOW • PvP Arena',buttons:[
    {id:'waw:v34:a:chess',title:'♟️ Catur',command:'.chess lobby'},
    {id:'waw:v34:a:snakes',title:'🎲 Ular Tangga',command:'.queue status'},
    {id:'waw:v34:a:bj',title:'🃏 Blackjack',command:'.bj status'}]}),
  home: Object.freeze({title:'WA-WORLD Beranda',buttons:[
    {id:'waw:games',title:'🎮 Games',command:'.games'},
    {id:'waw:arena:nav',title:'♟️ Arena',command:'.nav arena'},
    {id:'waw:more:nav',title:'📂 Lainnya',command:'.nav more'}]}),
  more:Object.freeze({title:'WA-WORLD Fitur Lainnya',buttons:[
    {id:'waw:daily',title:'🎁 Daily',command:'.daily'},
    {id:'waw:profile',title:'👤 Profil',command:'.profile'},
    {id:'waw:more:next',title:'➡️ Jelajah',command:'.nav explore'}]}),
  worldsocial:Object.freeze({title:'WOW Social World',buttons:[
    {id:'waw:ws:pulse',title:'🌍 World Pulse',command:'.worldpulse'},
    {id:'waw:ws:rep',title:'🌟 Reputasi',command:'.reputation'},
    {id:'waw:ws:group',title:'🏰 Guild Group',command:'.guildgroup'}]}),
  worldintel:Object.freeze({title:'WOW World Intelligence',buttons:[
    {id:'waw:wi:event',title:'🌦️ Event',command:'.world event'},
    {id:'waw:wi:stats',title:'📊 Stats Card',command:'.stats card'},
    {id:'waw:wi:smart',title:'🧠 Smart',command:'.smart recommend'}]}),
  world:Object.freeze({title:'WOW • World of WA',buttons:[
    {id:'waw:world:mine',title:'⛏️ Mining',command:'.mine'},
    {id:'waw:world:market',title:'📈 Bursa',command:'.market'},
    {id:'waw:world:wallet',title:'🏙️ WOW Life',command:'.wow economy'}]}),
  worldseason:Object.freeze({title:'WOW • Season',buttons:[
    {id:'waw:season:info',title:'🌎 Season',command:'.season'},
    {id:'waw:season:progress',title:'🏅 Progress',command:'.season progress'},
    {id:'waw:season:claim',title:'🎁 Klaim',command:'.season claim'}]}),
  guildsupply:Object.freeze({title:'WOW • Guild Supply',buttons:[
    {id:'waw:guildsupply:info',title:'🏰 Supply',command:'.guildshop'},
    {id:'waw:guildsupply:claim',title:'📦 Klaim',command:'.guildshop claim'},
    {id:'waw:guildsupply:guild',title:'🤝 Guild',command:'.guild info'}]}),
  community:Object.freeze({title:'WOW • Community',buttons:[
    {id:'waw:community:guild',title:'🏰 Guild',command:'.guild info'},
    {id:'waw:community:property',title:'🏡 Property',command:'.property list'},
    {id:'waw:community:ranking',title:'🏆 Guild Rank',command:'.guild list'}]}),
  guild:Object.freeze({title:'WOW • Guild',buttons:[
    {id:'waw:guild:info',title:'🏰 Info',command:'.guild info'},
    {id:'waw:guild:quest',title:'📜 Guild Quest',command:'.guild quest'},
    {id:'waw:guild:members',title:'👥 Anggota',command:'.guild members'}]}),
  worldmarket:Object.freeze({title:'WOW Shop & Auction',buttons:[
    {id:'waw:dm:shop',title:'🛒 Daily Shop',command:'.dailyshop'},
    {id:'waw:dm:history',title:'📜 Riwayat',command:'.dailyshop history'},
    {id:'waw:dm:auction',title:'🏷️ Lelang',command:'.auction'}]}),
  property:Object.freeze({title:'WOW • Property',buttons:[
    {id:'waw:property:list',title:'🏡 Properti',command:'.property list'},
    {id:'waw:property:collecthome',title:'🎁 Bonus Rumah',command:'.property collect home'},
    {id:'waw:property:community',title:'🏰 Guild',command:'.wow community'}]}),
  wowlife:Object.freeze({title:'WOW Life & Economy',buttons:[
    {id:'waw:life:shop',title:'🛍️ V Shop',command:'.vshop'},
    {id:'waw:life:craft',title:'🛠️ Craft',command:'.craft'},
    {id:'waw:life:dailyshop',title:'📅 Daily Shop',command:'.dailyshop'}]}),
  varcade:Object.freeze({title:'WOW V Arcade',buttons:[
    {id:'waw:varcade:opt',title:'🔐 Izin',command:'.arcade v'},
    {id:'waw:varcade:slot',title:'🎰 Spin 5V',command:'.slot v'},
    {id:'waw:varcade:risk',title:'🎯 Risk',command:'.risk v help'}]}),
  pvp:Object.freeze({title:'WOW Ranked & Casual',buttons:[
    {id:'waw:pvp:rules',title:'⚔️ Mode',command:'.pvp'},
    {id:'waw:pvp:stats',title:'📊 Statistik',command:'.pvp stats'},
    {id:'waw:pvp:history',title:'📜 Riwayat',command:'.pvp history'}]}),
  market:Object.freeze({title:'WOW • Bursa Fiktif',buttons:[
    {id:'waw:market:list',title:'📊 Harga',command:'.market list'},
    {id:'waw:market:portfolio',title:'💼 Portofolio',command:'.market portfolio'},
    {id:'waw:market:outlook',title:'🧠 Outlook',command:'.market outlook'}]}),
  explore:Object.freeze({title:'WA-WORLD Jelajah',buttons:[
    {id:'waw:explore:packs',title:'🕹️ Game Packs',command:'.packs'},
    {id:'waw:explore:ai',title:'🤖 AI',command:'.ai help'},
    {id:'waw:explore:fun',title:'✨ Arcade/Sosial',command:'.nav fun'}]}),
  fun:Object.freeze({title:'Arcade & Social',buttons:[
    {id:'waw:fun:arcade',title:'🎰 Arcade',command:'.arcade'},
    {id:'waw:fun:social',title:'👥 Social',command:'.social'},
    {id:'waw:fun:inventory',title:'🎒 Inventory',command:'.inventory'}]}),
  arcade:Object.freeze({title:'Free Arcade',buttons:[
    {id:'waw:arc:gacha',title:'🎁 Gacha',command:'.gacha'},
    {id:'waw:arc:slot',title:'🎰 10 Simbol',command:'.slot'},
    {id:'waw:arc:risk',title:'🤝 Risk Rooms',command:'.risk'}]}),
  gacha:Object.freeze({title:'Gacha Gratis',buttons:[
    {id:'waw:gacha:claim',title:'🎁 Klaim',command:'.gacha claim'},
    {id:'waw:gacha:odds',title:'📊 Peluang',command:'.gacha odds'},
    {id:'waw:gacha:collection',title:'🏛️ Koleksi',command:'.gacha collection'}]}),
  slot:Object.freeze({title:'10 Symbol Match',buttons:[
    {id:'waw:slot:spin',title:'🎰 Putar Gratis',command:'.slot spin'},
    {id:'waw:slot:odds',title:'📊 Peluang',command:'.slot odds'},
    {id:'waw:slot:arcade',title:'🏠 Arcade',command:'.arcade'}]}),
  risk:Object.freeze({title:'Risk Rooms Tanpa Taruhan',buttons:[
    {id:'waw:risk:create',title:'➕ Room Baru',command:'.risk create'},
    {id:'waw:risk:help',title:'📜 Aturan',command:'.risk help'},
    {id:'waw:risk:arcade',title:'🏠 Arcade',command:'.arcade'}]}),
  arenanav:Object.freeze({title:'WA-WORLD Arena PvP',buttons:[
    {id:'waw:nav:chess',title:'♟️ Catur',command:'.chess'},
    {id:'waw:nav:snakes',title:'🎲 Ular Tangga',command:'.arena'},
    {id:'waw:nav:blackjack',title:'🃏 Blackjack',command:'.bj help'}]}),
  games: Object.freeze({title:'WA-WORLD Game Hub',buttons:[
    {id:'waw:coin',title:'🪙 Koin',command:'.coin'},
    {id:'waw:rps',title:'✊ Suit',command:'.rps'},
    {id:'waw:guess',title:'🔢 Tebak Angka',command:'.guess start'}]}),
  coin: Object.freeze({title:'Lempar Koin',buttons:[
    {id:'waw:coin:kepala',title:'🪙 Kepala',command:'.coin kepala'},
    {id:'waw:coin:ekor',title:'🪙 Ekor',command:'.coin ekor'},
    {id:'waw:menu',title:'🏠 Beranda',command:'.menu'}]}),
  rps: Object.freeze({title:'Batu Gunting Kertas',buttons:[
    {id:'waw:rps:batu',title:'✊ Batu',command:'.rps batu'},
    {id:'waw:rps:gunting',title:'✌️ Gunting',command:'.rps gunting'},
    {id:'waw:rps:kertas',title:'🖐️ Kertas',command:'.rps kertas'}]}),
  packs: Object.freeze({title:'WA-WORLD Game Packs',buttons:[
    {id:'waw:pack:lucky',title:'🎲 Lucky',command:'.pack lucky'},
    {id:'waw:pack:brain',title:'🧠 Brain',command:'.pack brain'},
    {id:'waw:packs2',title:'➡️ Lanjut',command:'.packs2'}]}),
  packs2:Object.freeze({title:'WA-WORLD Game Packs 2/2',buttons:[
    {id:'waw:pack:word',title:'🔤 Word',command:'.pack word'},
    {id:'waw:pack:numbers',title:'🔢 Numbers',command:'.pack numbers'},
    {id:'waw:packs3',title:'➡️ Pack 03',command:'.packs3'}]}),
  packs3:Object.freeze({title:'WA-WORLD Game Pack 03',buttons:[
    {id:'waw:pack:puzzles',title:'🧮 Puzzle',command:'.pack puzzles'},
    {id:'waw:pack:words3',title:'🔤 Word',command:'.pack words3'},
    {id:'waw:packs4',title:'➡️ Pack 04',command:'.packs4'}]}),
  packs4:Object.freeze({title:'WA-WORLD Game Pack 04',buttons:[
    {id:'waw:pack:exploration',title:'🧭 Explorer',command:'.pack exploration'},
    {id:'waw:pack:data4',title:'🧩 Data/Cipher',command:'.pack data4'},
    {id:'waw:games:all',title:'📚 Daftar',command:'.games all'}]}),
  exploration:Object.freeze({title:'WA-WORLD Explorer',buttons:[
    {id:'waw:primefactors',title:'🔢 Faktor Prima',command:'.primefactors start'},
    {id:'waw:manhattan',title:'📍 Manhattan',command:'.manhattan start'},
    {id:'waw:chance',title:'🎲 Peluang',command:'.chance start'}]}),
  data4:Object.freeze({title:'WA-WORLD Data/Cipher',buttons:[
    {id:'waw:median',title:'🧮 Median',command:'.median start'},
    {id:'waw:caesar',title:'🔐 Caesar',command:'.caesar start'},
    {id:'waw:setunion',title:'🔗 Himpunan',command:'.setunion start'}]}),
  puzzle3:Object.freeze({title:'WA-WORLD Puzzles',buttons:[
    {id:'waw:factorial',title:'🔢 Faktorial',command:'.factorial start'},
    {id:'waw:discount',title:'💯 Diskon',command:'.discount start'},
    {id:'waw:quadrant',title:'📍 Kuadran',command:'.quadrant start'}]}),
  word3:Object.freeze({title:'WA-WORLD Word 03',buttons:[
    {id:'waw:morse',title:'📡 Morse',command:'.morse start'},
    {id:'waw:palindrome',title:'🔄 Palindrom',command:'.palindrome start'},
    {id:'waw:reverse',title:'🪞 Cermin',command:'.reverse start'}]}),
  lucky: Object.freeze({title:'Lucky Pack',buttons:[
    {id:'waw:dice',title:'🎲 Dadu',command:'.dice 4'},
    {id:'waw:parity',title:'🔢 Genap',command:'.parity genap'},
    {id:'waw:highlow',title:'🃏 Naik',command:'.highlow naik'}]}),
  brain: Object.freeze({title:'Brain Pack',buttons:[
    {id:'waw:math',title:'➕ Math',command:'.math start'},
    {id:'waw:trivia',title:'🧩 Trivia',command:'.trivia start'},
    {id:'waw:pattern',title:'🔢 Pola',command:'.pattern start'}]}),
  word: Object.freeze({title:'Word Pack',buttons:[
    {id:'waw:scramble',title:'🔤 Susun',command:'.scramble start'},
    {id:'waw:hangman',title:'🔡 Huruf',command:'.hangman start'},
    {id:'waw:chain',title:'🔗 Sambung',command:'.chain start'}]}),
  numbers: Object.freeze({title:'WA-WORLD Number Pack',buttons:[
    {id:'waw:binary',title:'🧮 Biner',command:'.binary start'},
    {id:'waw:roman',title:'🏛️ Romawi',command:'.roman start'},
    {id:'waw:sort',title:'🔢 Urutkan',command:'.sort start'}]}),
  logic: Object.freeze({title:'WA-WORLD Logic Pack',buttons:[
    {id:'waw:equation',title:'➕ Persamaan',command:'.equation start'},
    {id:'waw:prime',title:'🧠 Prima',command:'.prime start'},
    {id:'waw:logic',title:'💡 Boolean',command:'.logic start'}]}),
  ai: Object.freeze({title:'WA-WORLD AI Lokal',buttons:[
    {id:'waw:ai:status',title:'📊 Status',command:'.ai status'},
    {id:'waw:ai:consent',title:'✅ Izin',command:'.ai consent'},
    {id:'waw:menu',title:'🏠 Beranda',command:'.menu'}]}),
  social: Object.freeze({title:'WA-WORLD Social Hub',buttons:[
    {id:'waw:social:friends',title:'🤝 Teman',command:'.friend'},
    {id:'waw:social:duels',title:'⚔️ Duel',command:'.duel'},
    {id:'waw:social:worldshop',title:'🛍️ V Shop',command:'.vshop'}]}),
  friends: Object.freeze({title:'WA-WORLD Teman',buttons:[
    {id:'waw:friends:inbox',title:'📨 Inbox',command:'.friend inbox'},
    {id:'waw:friends:list',title:'🤝 Daftar',command:'.friend list'},
    {id:'waw:social',title:'🌐 Social',command:'.social'}]}),
  duels: Object.freeze({title:'WA-WORLD Duel',buttons:[
    {id:'waw:duel:inbox',title:'⚔️ Tantangan',command:'.duel inbox'},
    {id:'waw:duel:help',title:'📖 Cara main',command:'.duel help'},
    {id:'waw:social',title:'🌐 Social',command:'.social'}]}),
  transfers: Object.freeze({title:'V transfers disabled',buttons:[
    {id:'waw:pay:status',title:'🔒 Aturan',command:'.pay status'},
    {id:'waw:vshop',title:'🛍️ V Shop',command:'.vshop'},
    {id:'waw:social',title:'🌐 Social',command:'.social'}]}),
  chess: Object.freeze({title:'WA-WORLD Chess Arena',buttons:[
    {id:'waw:chess:join',title:'♟️ Cari Lawan',command:'.chess join'},
    {id:'waw:chess:rating',title:'🏅 Rating',command:'.chess rating'},
    {id:'waw:chess:status',title:'🔎 Status',command:'.chess status'}]}),
  chessqueue: Object.freeze({title:'Catur • Menunggu Lawan',buttons:[
    {id:'waw:chessq:status',title:'🔎 Antrean',command:'.chess status'},
    {id:'waw:chessq:leave',title:'🚪 Keluar',command:'.chess leave'},
    {id:'waw:chessq:lobby',title:'👥 Lobby',command:'.chess lobby'}]}),
  chesspending: Object.freeze({title:'Catur • Konfirmasi',buttons:[
    {id:'waw:chessp:accept',title:'✅ Terima',command:'.chess accept'},
    {id:'waw:chessp:cancel',title:'❌ Batal',command:'.chess cancel'},
    {id:'waw:chessp:status',title:'🔎 Status',command:'.chess status'}]}),
  chessactive: Object.freeze({title:'Catur • Berlangsung',buttons:[
    {id:'waw:chessa:board',title:'♟️ Papan',command:'.chess board'},
    {id:'waw:chessa:status',title:'🔎 Status',command:'.chess status'},
    {id:'waw:chessa:resign',title:'🏳️ Menyerah',command:'.chess resign'}]}),
  chessmatch: Object.freeze({title:'WA-WORLD Chess Match',buttons:[
    {id:'waw:chess:accept',title:'✅ Terima',command:'.chess accept'},
    {id:'waw:chess:board',title:'♟️ Papan',command:'.chess board'},
    {id:'waw:chess:status2',title:'🔎 Match',command:'.chess status'}]}),
  arena: Object.freeze({title:'WA-WORLD Multiplayer Arena',buttons:[
    {id:'waw:arena:join',title:'🎲 Cari Lawan',command:'.queue join snakes'},
    {id:'waw:arena:status',title:'🔎 Status',command:'.queue status'},
    {id:'waw:arena:match',title:'🎮 Match',command:'.match current'}]}),
  blackjack: Object.freeze({title:'WA-WORLD Blackjack',buttons:[
    {id:'waw:bj:create',title:'🃏 Buat Meja',command:'.bj create'},
    {id:'waw:bj:status',title:'🔎 Status',command:'.bj status'},
    {id:'waw:bj:help',title:'📖 Cara Main',command:'.bj help'}]}),
  bjlobby: Object.freeze({title:'Blackjack Lobby',buttons:[
    {id:'waw:bj:start',title:'▶️ Mulai',command:'.bj start'},
    {id:'waw:bj:lobby',title:'🔎 Status',command:'.bj status'},
    {id:'waw:bj:leave',title:'🚪 Keluar',command:'.bj leave'}]}),
  bjplay: Object.freeze({title:'Blackjack Hand',buttons:[
    {id:'waw:bj:hit',title:'➕ Hit',command:'.bj hit'},
    {id:'waw:bj:stand',title:'✋ Stand',command:'.bj stand'},
    {id:'waw:bj:hand',title:'🂡 Kartu',command:'.bj hand'}]}),
  match: Object.freeze({title:'WA-WORLD Ular Tangga',buttons:[
    {id:'waw:match:accept',title:'✅ Terima',command:'.match accept'},
    {id:'waw:match:roll',title:'🎲 Lempar Dadu',command:'.match roll'},
    {id:'waw:match:board',title:'🗺️ Papan',command:'.match board'}]}),
  inventory: Object.freeze({title:'WA-WORLD Inventory',buttons:[
    {id:'waw:inv:show',title:'🎒 Inventaris',command:'.inventory'},
    {id:'waw:inv:daily',title:'🎁 Item Harian',command:'.item daily'},
    {id:'waw:inv:items',title:'🧩 Katalog',command:'.item list'}]}),
  profile: Object.freeze({title:'WA-WORLD Profil',buttons:[
    {id:'waw:wallet',title:'💰 Dompet',command:'.wallet'},
    {id:'waw:inventory',title:'🎒 Inventory',command:'.inventory'},
    {id:'waw:menu',title:'🏠 Beranda',command:'.menu'}]})
});
/** Allowed group navigation only. This is NOT a permission bypass for economic commands. */
export const GROUP_MIXED_ROWS=Object.freeze([
 {id:'waw:menu',title:'Beranda',command:'.menu'},
 {id:'waw:games',title:'Permainan',command:'.games'},
 {id:'waw:more:nav',title:'Menu Lainnya',command:'.nav more'},
 {id:'waw:arena:nav',title:'Arena',command:'.nav arena'},
 {id:'waw:more:next',title:'Jelajah',command:'.nav explore'},
 {id:'waw:ws:pulse',title:'World Pulse',command:'.worldpulse'},
 {id:'waw:ws:rep',title:'Reputasi',command:'.reputation'},
 {id:'waw:ws:group',title:'Informasi Guild',command:'.guildgroup'},
 {id:'waw:ws:season',title:'Musim Dunia',command:'.season'},
 {id:'waw:ws:shop',title:'Daily Shop (DM)',command:'.dailyshop'},
 {id:'waw:ws:inventory',title:'Inventory (DM)',command:'.inventory'},
 {id:'waw:ws:arcade',title:'Arcade (DM)',command:'.arcade'}
]);
// v3.2.4: genuine hierarchical group navigation (no recursive groupdemo loop).
// ONLY public navigation and information. Economy/player transactions stay in DM.
export const GROUP_NAV_PANELS=Object.freeze({
 groupgames:Object.freeze({title:'WOW • Permainan Grup',buttons:[
  {id:'waw:games',title:'🎮 Daftar Game',command:'.games'},
  {id:'waw:g:arena',title:'♟️ Arena',command:'.nav arena'},
  {id:'waw:g:home',title:'🏠 Beranda',command:'.menu'}],rows:[
  {id:'waw:g:list',title:'Semua Game',command:'.games all'},
  {id:'waw:g:arena2',title:'Arena PvP',command:'.nav arena'},
  {id:'waw:g:world',title:'Dunia WOW',command:'.nav explore'},
  {id:'waw:g:more',title:'Menu Lainnya',command:'.nav more'}]}),
 groupmore:Object.freeze({title:'WOW • Menu Lainnya',buttons:[
  {id:'waw:more:world',title:'🌍 Dunia',command:'.nav explore'},
  {id:'waw:more:arena2',title:'⚔️ Arena',command:'.nav arena'},
  {id:'waw:more:home2',title:'🏠 Beranda',command:'.menu'}],rows:[
  {id:'waw:more:pulse',title:'World Pulse',command:'.worldpulse'},
  {id:'waw:more:season',title:'Musim WOW',command:'.season'},
  {id:'waw:more:rep',title:'Reputasi Pemain',command:'.reputation'},
  {id:'waw:more:guild',title:'Guild Grup',command:'.guildgroup'},
  {id:'waw:more:games',title:'Daftar Game',command:'.games'},
  {id:'waw:more:home3',title:'Kembali Beranda',command:'.menu'}]}),
 grouparena:Object.freeze({title:'WOW • Arena PvP',buttons:[
  {id:'waw:a:games',title:'🎮 Game',command:'.games'},
  {id:'waw:a:world',title:'🌍 Jelajah',command:'.nav explore'},
  {id:'waw:a:home',title:'🏠 Beranda',command:'.menu'}],rows:[
  {id:'waw:a:info',title:'Info Arena',command:'.nav arena'},
  {id:'waw:a:games2',title:'Daftar Game',command:'.games all'},
  {id:'waw:a:season',title:'Musim Dunia',command:'.season'},
  {id:'waw:a:rep',title:'Reputasi',command:'.reputation'}]}),
 groupexplore:Object.freeze({title:'WOW • Jelajah Dunia',buttons:[
  {id:'waw:e:pulse',title:'🌐 Pulse',command:'.worldpulse'},
  {id:'waw:e:more',title:'📚 Lainnya',command:'.nav more'},
  {id:'waw:e:home',title:'🏠 Beranda',command:'.menu'}],rows:[
  {id:'waw:e:season',title:'Musim Dunia',command:'.season'},
  {id:'waw:e:rep',title:'Reputasi',command:'.reputation'},
  {id:'waw:e:guild',title:'Informasi Guild',command:'.guildgroup'},
  {id:'waw:e:games',title:'Permainan',command:'.games'},
  {id:'waw:e:arena',title:'Arena PvP',command:'.nav arena'}]})
});
/** WOW v3.3: shared DM navigation for text, group and gameplay. All IDs are allowlisted. */
export const DM_SELECTOR_ROWS=Object.freeze({
 home:[
  {id:'waw:dm:world',title:'🌍 World of WA',command:'.hub world'},
  {id:'waw:dm:games',title:'🎮 Seluruh Game',command:'.hub games'},
  {id:'waw:dm:bj',title:'🃏 Blackjack',command:'.bj status'},
  {id:'waw:dm:arena',title:'⚔️ PvP Arena',command:'.hub arena'},
  {id:'waw:dm:profile',title:'👤 Profile',command:'.profile'},
  {id:'waw:dm:inventory',title:'🎒 Inventory',command:'.inventory'},
  {id:'waw:dm:shop',title:'🛍️ Daily Shop',command:'.dailyshop'},
  {id:'waw:dm:guild',title:'🛡️ Guild',command:'.guild'},
  {id:'waw:dm:property',title:'🏠 Property',command:'.property list'},
  {id:'waw:dm:mine',title:'⛏️ Mining',command:'.mine'},
  {id:'waw:dm:stats',title:'📊 Player Stats',command:'.stats'},
  {id:'waw:dm:style',title:'🎨 Chat Style',command:'.chatstyle'}
 ],
 games:[
  {id:'waw:dm:g:bj',title:'🃏 Blackjack',command:'.bj status'},
  {id:'waw:dm:g:chess',title:'♟️ Catur',command:'.chess lobby'},
  {id:'waw:dm:g:snakes',title:'🎲 Ular Tangga',command:'.queue status'},
  {id:'waw:dm:g:arcade',title:'🎰 Arcade',command:'.arcade'},
  {id:'waw:dm:g:coin',title:'🪙 Coin Toss',command:'.coin'},
  {id:'waw:dm:g:rps',title:'✊ Suit',command:'.rps'},
  {id:'waw:dm:g:all',title:'📚 Semua Game',command:'.games all'},
  {id:'waw:dm:g:home',title:'🏠 Kembali',command:'.menu'}
 ],
 blackjack:[
  {id:'waw:dm:bj:new',title:'🃏 Buat Meja',command:'.bj create'},
  {id:'waw:dm:bj:state',title:'🔎 Status',command:'.bj status'},
  {id:'waw:dm:bj:cards',title:'🂡 Lihat Kartu',command:'.bj hand'},
  {id:'waw:dm:bj:rules',title:'📖 Cara Main',command:'.bj help'},
  {id:'waw:dm:bj:home',title:'🏠 Beranda',command:'.menu'}
 ],
 bjlobby:[
  {id:'waw:dm:bjl:start',title:'▶️ Mulai Ronde',command:'.bj start'},
  {id:'waw:dm:bjl:status',title:'🔎 Status Meja',command:'.bj status'},
  {id:'waw:dm:bjl:leave',title:'🚪 Keluar',command:'.bj leave'},
  {id:'waw:dm:bjl:rules',title:'📖 Bantuan',command:'.bj help'}
 ],
 bjplay:[
  {id:'waw:dm:bjp:hit',title:'➕ Hit',command:'.bj hit'},
  {id:'waw:dm:bjp:stand',title:'✋ Stand',command:'.bj stand'},
  {id:'waw:dm:bjp:hand',title:'🂡 Kartu Saya',command:'.bj hand'},
  {id:'waw:dm:bjp:status',title:'🔎 Status',command:'.bj status'},
  {id:'waw:dm:bjp:rules',title:'📖 Aturan',command:'.bj help'}
 ]
});
// v3.4 multi-screen, server-side allowlisted DM navigation; no dynamic command strings from clients.
export const DM_HUB_PANELS=Object.freeze({games:'wowgameshub',world:'wowworldhub',economy:'woweconomyhub',identity:'wowidentityhub',arena:'wowarenahub'});
export const DM_V340_ROWS={};
DM_V340_ROWS.wowgameshub=Object.freeze([
 {id:'waw:v34:gs:bjnew',title:'🃏 Buat Blackjack',command:'.bj create'},
 {id:'waw:v34:gs:bjstatus',title:'🂡 Kartu / Meja',command:'.bj status'},
 {id:'waw:v34:gs:chess',title:'♟️ Chess Lobby',command:'.chess lobby'},
 {id:'waw:v34:gs:snakes',title:'🎲 Snakes Queue',command:'.queue status'},
 {id:'waw:v34:gs:arcade',title:'🎰 Arcade',command:'.arcade'},
 {id:'waw:v34:gs:rps',title:'✊ Suit',command:'.rps'},
 {id:'waw:v34:gs:coin',title:'🪙 Coin',command:'.coin'},
 {id:'waw:v34:gs:packs',title:'🕹️ Game Packs',command:'.packs'},
 {id:'waw:v34:gs:all',title:'📚 Semua Game',command:'.games all'},
 {id:'waw:v34:gs:arena',title:'⚔️ Arena Hub',command:'.hub arena'},
 {id:'waw:v34:gs:home',title:'🏠 Home',command:'.menu'}
]);
DM_V340_ROWS.wowworldhub=Object.freeze([
 {id:'waw:v34:ws:events',title:'🌦️ Event',command:'.world event'},
 {id:'waw:v34:ws:quest',title:'🗺️ Expedition',command:'.world quest'},
 {id:'waw:v34:ws:mine',title:'⛏️ Mining',command:'.mine'},
 {id:'waw:v34:ws:career',title:'🧑‍🔧 Career',command:'.career'},
 {id:'waw:v34:ws:season',title:'🏆 Season',command:'.season'},
 {id:'waw:v34:ws:worldpulse',title:'📊 World Pulse',command:'.worldpulse'},
 {id:'waw:v34:ws:guild',title:'🛡️ Guild',command:'.guild'},
 {id:'waw:v34:ws:property',title:'🏡 Property',command:'.property list'},
 {id:'waw:v34:ws:economy',title:'💰 Economy Hub',command:'.hub economy'},
 {id:'waw:v34:ws:home',title:'🏠 Home',command:'.menu'}
]);
DM_V340_ROWS.woweconomyhub=Object.freeze([
 {id:'waw:v34:es:wallet',title:'💰 V Wallet',command:'.wallet'},
 {id:'waw:v34:es:vshop',title:'🛍️ V Shop',command:'.vshop'},
 {id:'waw:v34:es:daily',title:'📅 Daily Shop',command:'.dailyshop'},
 {id:'waw:v34:es:market',title:'📈 Market',command:'.market'},
 {id:'waw:v34:es:portfolio',title:'💼 Portfolio',command:'.market portfolio'},
 {id:'waw:v34:es:craft',title:'🔨 Craft',command:'.craft'},
 {id:'waw:v34:es:shop',title:'✨ Chat Signature',command:'.chatstyle signature shop'},
 {id:'waw:v34:es:stats',title:'📊 Economy Audit',command:'.wow economy'},
 {id:'waw:v34:es:home',title:'🏠 Home',command:'.menu'}
]);
DM_V340_ROWS.wowidentityhub=Object.freeze([
 {id:'waw:v34:is:preview',title:'🎭 Preview',command:'.chatstyle preview'},
 {id:'waw:v34:is:on',title:'✅ Chat ON',command:'.chatstyle on'},
 {id:'waw:v34:is:off',title:'🔕 Chat OFF',command:'.chatstyle off'},
 {id:'waw:v34:is:presets',title:'📂 Presets',command:'.chatstyle preset list'},
 {id:'waw:v34:is:signature',title:'✨ Signature',command:'.chatstyle signature shop'},
 {id:'waw:v34:is:buy-spark',title:'🛍️ Beli Spark 40V',command:'.chatstyle signature buy spark'},
 {id:'waw:v34:is:buy-royal',title:'🛍️ Beli Royal 120V',command:'.chatstyle signature buy royal'},
 {id:'waw:v34:is:buy-guild',title:'🛍️ Beli Guild 180V',command:'.chatstyle signature buy guild'},
 {id:'waw:v34:is:sign-spark',title:'✦ Aktif Spark',command:'.chatstyle signature use spark'},
 {id:'waw:v34:is:sign-off',title:'🚫 Lepas Signature',command:'.chatstyle signature off'},
 {id:'waw:v34:is:stats',title:'📊 Usage Stats',command:'.chatstyle stats'},
 {id:'waw:v34:is:card',title:'🪪 Player Card',command:'.stats card'},
 {id:'waw:v34:is:home',title:'🏠 Home',command:'.menu'}
]);
DM_V340_ROWS.wowarenahub=Object.freeze([
 {id:'waw:v34:as:chess',title:'♟️ Chess Lobby',command:'.chess lobby'},
 {id:'waw:v34:as:chess-join',title:'♟️ Cari Lawan',command:'.chess join'},
 {id:'waw:v34:as:snake',title:'🎲 Ular Tangga',command:'.queue status'},
 {id:'waw:v34:as:bj',title:'🃏 Blackjack Status',command:'.bj status'},
 {id:'waw:v34:as:bjnew',title:'🃏 Buat Blackjack',command:'.bj create'},
 {id:'waw:v34:as:rank',title:'🏅 PvP Stats',command:'.pvp stats'},
 {id:'waw:v34:as:home',title:'🏠 Home',command:'.menu'}
]);
export const GROUP_PUBLIC_COMMANDS=Object.freeze(new Set([
 '.menu','.wowmenu','.help','.games','.games all','.nav more','.nav arena','.nav explore',
 '.worldpulse','.reputation','.guildgroup','.season'
]));
export const GROUP_BUTTON_SAFE_IDS=Object.freeze(new Set([
 ...GROUP_MIXED_ROWS.map(x=>x.id),
 ...Object.values(GROUP_NAV_PANELS).flatMap(p=>[...p.buttons,...p.rows].map(x=>x.id))
]));
export const GROUP_DM_ONLY_IDS=Object.freeze(new Set(['waw:ws:shop','waw:ws:inventory','waw:ws:arcade']));
export const BUTTON_COMMANDS=Object.freeze(Object.fromEntries(
  [...BUTTONS,...Object.values(PANELS).flatMap(p=>p.buttons),...GROUP_MIXED_ROWS,...Object.values(DM_SELECTOR_ROWS).flatMap(rows=>rows),...Object.values(DM_V340_ROWS).flatMap(rows=>rows),...Object.values(GROUP_NAV_PANELS).flatMap(p=>[...p.buttons,...p.rows])].map(b=>[b.id,b.command])
));
export function resolvePanel(name){return PANELS[name]??null;}
function choiceText(panel){return panel.buttons.map((b,i)=>`${i+1}. ${b.title}: ${b.command}`).join('\n');}

export function fallbackText(mode='text',panelName=null) {
  const panel=resolvePanel(panelName);
  if(panel) return `🌍 *${panel.title}*\n${choiceText(panel)}\n\nJika tombol tidak tampil, ketik perintah di atas.\n.menu = beranda.`;
  return `🌍 *WA-WORLD Button Lab* [${mode}]\n`+
    `1. Menu: .tap 1\n2. Games: .tap 2\n3. Wallet: .tap 3\n\n`+
    `Jika tombol asli tidak muncul, ketik perintah di atas.\n`+
    `Laporkan dengan .buttoncheck native hidden atau .buttoncheck native shown.`;
}
export function tapCommand(input) {
  return ({'1':'.menu','2':'.games','3':'.wallet'}[String(input??'').trim().toLowerCase()] ?? null);
}
export function buttonCheck(value) {
  const v=String(value??'').trim().toLowerCase();
  return ['shown','hidden','clicked'].includes(v)?v:null;
}
export function legacyPayload({panelName=null,body=null}={}) {
  const buttons=resolvePanel(panelName)?.buttons??BUTTONS;
  return {text:body?`${body}\n\n${fallbackText('legacy',panelName)}`:fallbackText('legacy',panelName),footer:'WA-WORLD • legacy (eksperimental)',
    buttons:buttons.map(b=>({buttonId:b.id,buttonText:{displayText:b.title},type:1})),headerType:1};
}
/** Protobuf payload stays OUTSIDE viewOnce; some clients hid the buttons when viewOnce wrapped it. */
export function nativePayload(proto,{panelName=null,body=null,selector=false,mixed=false}={}) {
  if(!proto?.Message?.InteractiveMessage) throw Error('Baileys InteractiveMessage protobuf unavailable');
  const IM=proto.Message.InteractiveMessage;
  const panel=mixed?(GROUP_NAV_PANELS[panelName]??resolvePanel(panelName)):resolvePanel(panelName);
  const primary=panel?.buttons??BUTTONS;
  const quickReplies=primary.slice(0,3).map(b=>({name:'quick_reply',buttonParamsJson:JSON.stringify({display_text:b.title,id:b.id})}));
  // Reference-tested XLICON layout: 3 quick replies + one expandable single-select.
  // 8 choices are ROWS inside one selector, not eight simultaneously visible buttons.
  const selectRows=(mixed?(panel?.rows??DM_SELECTOR_ROWS[panelName]??DM_V340_ROWS[panelName]??GROUP_MIXED_ROWS):primary).map(b=>({header:'WOW',title:b.title,description:b.command,id:b.id}));
  const selectButton={name:'single_select',buttonParamsJson:JSON.stringify({
    title:'Jelajahi WOW',sections:[{title:'WOW • Group Menu',rows:selectRows}]
  })};
  const buttons=mixed?[...quickReplies,selectButton]:selector?[selectButton]:quickReplies;
  const sheet=mixed?JSON.stringify({bottom_sheet:{in_thread_buttons_limit:2,divider_indices:[1],list_title:'Pilihan WOW',button_title:'Buka Menu'}}):undefined;
  // Mixed mode uses its OWN per-screen navigation, unlike the legacy one-page fallback.
  const fallback=mixed && (GROUP_NAV_PANELS[panelName] || DM_SELECTOR_ROWS[panelName] || DM_V340_ROWS[panelName])
    ? `${panel.title}\n${(panel.rows??DM_SELECTOR_ROWS[panelName]??DM_V340_ROWS[panelName]??[]).map(r=>`${r.title}: ${r.command}`).join('\n')}`
    : fallbackText('native',panelName);
  const maxCore=1000-fallback.length-3;
  const messageBody=body ? (String(body).length>maxCore?String(body).slice(0,maxCore-36)+'\n… Lihat lengkap: .games all':String(body))+'\n\n'+fallback :fallback;
  return {
    interactiveMessage:IM.create({
      header:IM.Header.create({title:panel?.title??'WA-WORLD',hasMediaAttachment:false}),
      body:IM.Body.create({text:messageBody}),
      footer:IM.Footer.create({text:'WA-WORLD • quick-reply experimental'}),
      nativeFlowMessage:IM.NativeFlowMessage.create({...((mixed&&sheet)?{messageParamsJson:sheet}:{}),buttons,messageVersion:1})
    })
  };
}
/**
 * Business relay metadata used for ordinary quick replies, not payments or checkout.
 * Structural compatibility with some WhatsApp clients is experimental and can change.
 */
export function nativeRelayNodes(jid,nowSeconds=Math.floor(Date.now()/1000),profile='wow') {
  if(!jid || typeof jid!=='string') throw Error('Invalid recipient JID');
  const attrs=profile==='reference'?{}:{actual_actors:'2',host_storage:'2',privacy_mode_ts:String(Math.max(0,nowSeconds-77980457))};
  const biz={tag:'biz',attrs,content:[
    {tag:'interactive',attrs:{type:'native_flow',v:'1'},content:[{tag:'native_flow',attrs:{v:'9',name:'mixed'}}]}
  ]};
  if(jid.endsWith('@g.us')) return [biz];
  return [biz,{tag:'bot',attrs:{biz_bot:'1'}}];
}
export async function sendButtonExperiment({sock,jid,mode,quoted,baileys,panelName=null,body=null}) {
  if(mode==='text') {
    await sock.sendMessage(jid,{text:body?`${body}\n\n${fallbackText('text',panelName)}`:fallbackText('text',panelName)},{quoted});
    return {transport:'text',attempted:false,sent:true,stage:'text-sent'};
  }
  try {
    if(mode==='legacy') {
      await sock.sendMessage(jid,legacyPayload({panelName,body}),{quoted});
    } else if(mode==='native'||mode==='selector'||mode==='mixed') {
      const {proto,generateWAMessageFromContent}=baileys??{};
      if(typeof generateWAMessageFromContent!=='function') throw Error('Baileys generateWAMessageFromContent unavailable');
      if(typeof sock.relayMessage!=='function') throw Error('Socket relayMessage unavailable');
      const outgoing=generateWAMessageFromContent(jid,nativePayload(proto,{panelName,body,selector:mode==='selector',mixed:mode==='mixed'}),{userJid:sock.user?.id,quoted});
      if(!outgoing?.key?.id || !outgoing?.message) throw Error('Baileys message generator returned invalid message');
      await sock.relayMessage(jid,outgoing.message,{
        messageId:outgoing.key.id,
        additionalNodes:nativeRelayNodes(jid,Math.floor(Date.now()/1000),mode==='mixed'?'reference':'wow')
      });
    } else throw Error('Unknown button mode');
    // Never claim the user actually saw the button: only the client can confirm rendering.
    return {transport:mode,attempted:true,sent:true,stage:'relayed-unverified'};
  } catch(error) {
    const details=String(error?.message??error).slice(0,120);
    // Fallback only when the transport fails. Do not simulate visual button UI.
    try {await sock.sendMessage(jid,{text:`⚠️ Tombol ${mode} gagal dikirim.\n\n${body?body+'\n\n':''}${fallbackText('text',panelName)}`},{quoted});}
    catch { /* original error remains available for terminal diagnostics */ }
    return {transport:mode,attempted:true,sent:false,stage:'relay-failed',error:details};
  }
}
