// script.js — обновлённый код с бонусами (registration, login, profile, items, marketplace, bots, admin)

// ---------- Utility ----------
const STORAGE = {
  USERS: 'tg_users_v2',
  MARKET: 'tg_market_v2',
  STATE: 'tg_state_v2', // chats + balance if needed
  SESSION: 'tg_session_v2'
};

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8) }
function now(){ return new Date().toLocaleTimeString() }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)) }
function load(key, def){ try { return JSON.parse(localStorage.getItem(key)) || def } catch(e){ return def } }
function todayStr(){ const d = new Date(); return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}` }

// ---------- Base data (gifts / phone / username templates) ----------
const BASE_GIFTS = [
  { id: 'g_hbd', name: 'Happy Birthday', emoji: '🎉', base: 200 },
  { id: 'g_cal', name: 'Birthday Calendar', emoji: '📆', base: 500 },
  { id: 'g_egg', name: 'Dragon Egg', emoji: '🥚', base: 1500 },
  { id: 'g_crys', name: 'Crystal', emoji: '💎', base: 3000 },
  { id: 'g_pepe', name: 'Plush Pepe', emoji: '🐸', base: 10000 }
];

const SYMBOLS = ['★','✦','✪','❤','✔','⚡','❦','☯','✿','♪'];
const BG_OPTIONS = ['linear-gradient(135deg,#a8ff78,#78ffd6)','linear-gradient(135deg,#f6d365,#fda085)','linear-gradient(135deg,#fbc2eb,#a6c1ee)','linear-gradient(135deg,#cfd9df,#e2ebf0)'];
const MODEL_COLORS = ['#22c55e','#ef4444','#f59e0b','#6366f1','#06b6d4','#a78bfa'];

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)] }
function calcRarityScore(bg, modelColor, symbol){
  let score=0; const bgLower=(bg||'').toLowerCase();
  if (bgLower.includes('78ffd6')||bgLower.includes('a8ff78')) score += (modelColor === '#22c55e')?2:0;
  if (bgLower.includes('f6d365')||bgLower.includes('fda085')) score += (modelColor === '#ef4444')?2:0;
  if (bgLower.includes('a78bfa')||bgLower.includes('f093fb')) score += (modelColor === '#6366f1')?2:0;
  if (['✪','⚡','✿'].includes(symbol)) score += 3; else if (['★','❤','♪'].includes(symbol)) score += 1;
  score += Math.random()*3;
  return Math.min(100, Math.round(score/6*100));
}
function randomHue(){ return Math.floor(Math.random()*360) + 'deg' }

// ---------- persist / init ----------
let users = load(STORAGE.USERS, null);
let market = load(STORAGE.MARKET, []);
let session = load(STORAGE.SESSION, null); // {username}
let state = load(STORAGE.STATE, { chats: [] }); // chats etc

if (!users) {
  // create default users incl. commission account "strssler"
  users = [
    { username: "strssler", pass: "admin", balance: 0, display: "STRSSLER", banned:false, inventory: [], admin:true, phoneNumbers: [], userNames: [], lastDailyBonusDate: null, lastZeroBonusDate: null },
    { username: "demo", pass: "demo", balance: 1000, display: "DemoUser", banned:false, inventory: [], admin:false, phoneNumbers: [], userNames: [], lastDailyBonusDate: null, lastZeroBonusDate: null }
  ];
  save(STORAGE.USERS, users);
}
save(STORAGE.MARKET, market);
save(STORAGE.STATE, state);

// helper: find user
function findUser(username){ return users.find(u=>u.username===username) }

// ---------- chats UI ----------
const chatBody = document.getElementById('chatBody');
function pushChat(text){
  if (!state.chats[0]) state.chats[0] = { id:'bot', messages: [] };
  state.chats[0].messages.push({ id: uid(), text, time: now() });
  save(STORAGE.STATE, state);
  renderChat();
}
function renderChat(){
  if (!chatBody) return;
  chatBody.innerHTML = '';
  const msgs = (state.chats[0] && state.chats[0].messages) || [];
  msgs.forEach(m=>{
    const d = document.createElement('div'); d.className='message';
    d.innerHTML = `<div>${m.text}</div><div class="small muted" style="margin-top:6px">${m.time}</div>`;
    chatBody.appendChild(d);
  });
  chatBody.scrollTop = chatBody.scrollHeight;
}

// ---------- DOM refs ----------
const openMiniBtn = document.getElementById('openMiniBtn');
const miniApp = document.getElementById('miniApp');
const closeMini = document.getElementById('closeMini');
const balanceView = document.getElementById('balanceView');
const miniContent = document.getElementById('miniContent');

if (openMiniBtn) openMiniBtn.addEventListener('click', ()=> { openMini(); renderMini('shop'); });
if (closeMini) closeMini.addEventListener('click', ()=> miniApp && miniApp.classList.add('hidden'));

// nav
document.querySelectorAll('.nav-btn').forEach(b=>{
  b.addEventListener('click', (e)=>{
    document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderMini(e.currentTarget.getAttribute('data-tab'));
  });
});

// ---------- BONUS LOGIC ----------
// grant zero-balance bonus (1000★) once per day when user has 0 balance
// grant daily bonus (5000★) once per day
function checkAndGrantBonuses(u){
  if (!u) return;
  const today = todayStr();
  let changed = false;

  // Daily bonus: once per calendar day
  if (!u.lastDailyBonusDate || u.lastDailyBonusDate !== today) {
    // give daily 5000
    u.balance = (u.balance || 0) + 5000;
    u.lastDailyBonusDate = today;
    pushChat(`🎁 Daily bonus: @${u.username} received 5000★`);
    changed = true;
  }

  // Zero-balance bonus: if balance is exactly 0 => give 1000 once per day when at zero
  if ((u.balance || 0) === 0) {
    if (!u.lastZeroBonusDate || u.lastZeroBonusDate !== today) {
      u.balance += 1000;
      u.lastZeroBonusDate = today;
      pushChat(`🎉 Zero-balance bonus: @${u.username} received 1000★`);
      changed = true;
    }
  }

  if (changed) {
    save(STORAGE.USERS, users);
    updateBalanceView();
  }
}

// ---------- Authentication UI (register/login) ----------
function renderAuth(){
  const logged = session && findUser(session.username) && !findUser(session.username).banned;
  if (logged) {
    miniContent.innerHTML = `
      <h3>Account</h3>
      <div class="card">
        <div><strong>${session.username}</strong> ${findUser(session.username).admin?'<span class="badge-admin">ADMIN</span>':''}</div>
        <div class="small muted">Display: ${findUser(session.username).display}</div>
        <div style="margin-top:8px">Balance: <strong>${findUser(session.username).balance}</strong> ★</div>
        <div style="margin-top:8px;">
          <button id="logoutBtn" class="btn">Logout</button>
        </div>
      </div>

      <h4>Your phones</h4>
      <div id="phonesList"></div>
      <div style="margin-top:8px">
        <button id="createPhone" class="btn">Create random +888 number (cost 100)</button>
      </div>

      <h4 style="margin-top:12px">Your usernames</h4>
      <div id="namesList"></div>
      <div style="margin-top:8px">
        <button id="createName" class="btn">Create random username (cost 80)</button>
      </div>

      <div style="margin-top:12px">
        <button id="openProfileBtn" class="btn primary">Open full profile</button>
      </div>
    `;
    document.getElementById('logoutBtn').onclick = ()=> { session=null; save(STORAGE.SESSION, null); renderMini('users'); updateBalanceView(); };
    document.getElementById('createPhone').onclick = createRandomPhone;
    document.getElementById('createName').onclick = createRandomUserName;
    renderPhonesAndNames();
    return;
  }

  miniContent.innerHTML = `
    <h3>Register / Login</h3>
    <div class="card">
      <div><input id="regUser" placeholder="username" class="input" /></div>
      <div style="margin-top:8px"><input id="regPass" placeholder="password" type="password" class="input" /></div>
      <div style="margin-top:8px"><input id="regDisplay" placeholder="display name (optional)" class="input" /></div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button id="regBtn" class="btn primary">Register</button>
        <button id="loginBtn" class="btn">Login</button>
      </div>
    </div>
    <div class="small muted" style="margin-top:8px">Note: accounts stored locally. Admin: username <strong>strssler</strong> pass <strong>admin</strong></div>
  `;
  document.getElementById('regBtn').onclick = doRegister;
  document.getElementById('loginBtn').onclick = doLogin;
}

function doRegister(){
  const u = document.getElementById('regUser').value.trim();
  const p = document.getElementById('regPass').value;
  const d = document.getElementById('regDisplay').value.trim() || u;
  if (!u||!p) return alert('Введите логин и пароль');
  if (findUser(u)) return alert('Пользователь уже существует');
  const newUser = { username: u, pass: p, balance: 500, display: d, banned:false, inventory: [], admin:false, phoneNumbers: [], userNames: [], lastDailyBonusDate: null, lastZeroBonusDate: null };
  users.push(newUser); save(STORAGE.USERS, users);
  session = { username: u }; save(STORAGE.SESSION, session);
  // grant bonuses immediately for new user
  checkAndGrantBonuses(newUser);
  pushChat(`Новый пользователь зарегистрирован: @${u}`);
  renderMini('users'); updateBalanceView();
}
function doLogin(){
  const u = document.getElementById('regUser').value.trim();
  const p = document.getElementById('regPass').value;
  const found = findUser(u);
  if (!found || found.pass !== p) return alert('Неверный логин/пароль');
  if (found.banned) return alert('Ваш аккаунт заблокирован');
  session = { username: u }; save(STORAGE.SESSION, session);
  // grant bonuses on login
  checkAndGrantBonuses(found);
  pushChat(`Пользователь @${u} вошёл в систему`);
  renderMini('users'); updateBalanceView();
}

// ---------- helper — profile components ----------
function renderPhonesAndNames(){
  const u = findUser(session.username);
  const phonesDiv = document.getElementById('phonesList');
  const namesDiv = document.getElementById('namesList');
  phonesDiv.innerHTML = (u.phoneNumbers.length ? u.phoneNumbers.map(p=>`<div class="small card">${p.value} · Rarity:${p.rarity} <button class="btn" onclick="listPhone('${p.id}')">List</button></div>`).join('') : '<div class="small muted">No phones</div>');
  namesDiv.innerHTML = (u.userNames.length ? u.userNames.map(n=>`<div class="small card">${n.value} · Rarity:${n.rarity} <button class="btn" onclick="listName('${n.id}')">List</button></div>`).join('') : '<div class="small muted">No names</div>');
}

// create random phone (+888 X)
function createRandomPhone(){
  const u = currentUser();
  if (!u) return alert('Login required');
  if (u.balance < 100) return alert('Недостаточно баланса');
  if (!confirm('Создать анонимный номер +888 (100★)?')) return;
  u.balance -= 100;
  const val = `+888 ${Math.floor(1000+Math.random()*9000)} ${Math.floor(100+Math.random()*900)} ${Math.floor(100+Math.random()*900)}`;
  const rarity = Math.ceil(Math.random()*4);
  const id = uid();
  u.phoneNumbers.push({ id, value: val, rarity });
  save(STORAGE.USERS, users); renderAuth(); updateBalanceView();
}

// create random username
function createRandomUserName(){
  const u = currentUser();
  if (!u) return alert('Login required');
  if (u.balance < 80) return alert('Недостаточно баланса');
  if (!confirm('Создать username (80★)?')) return;
  u.balance -= 80;
  const val = `user${Math.floor(1000+Math.random()*9000)}`;
  const rarity = Math.ceil(Math.random()*4);
  const id = uid();
  u.userNames.push({ id, value: val, rarity });
  save(STORAGE.USERS, users); renderAuth(); updateBalanceView();
}

// listing phone/name from profile
function listPhone(pid){
  const u = currentUser(); if(!u) return alert('login');
  const item = u.phoneNumbers.find(p=>p.id===pid);
  if (!item) return;
  const price = prompt('Price for phone (+888 ...):', item.rarity * 500);
  if (!price) return;
  // listing fee 50
  if (u.balance < 50) return alert('Недостаточно на плату 50★ для листинга');
  if (!confirm(`Выставить ${item.value} за ${price}? Списание 50★`)) return;
  u.balance -= 50;
  // create market item
  const marketItem = { marketId: uid(), type:'phone', seller:u.username, phone: item, price: Number(price) };
  market.unshift(marketItem); save(STORAGE.MARKET, market);
  // remove from user
  u.phoneNumbers = u.phoneNumbers.filter(x=>x.id!==pid);
  save(STORAGE.USERS, users); renderAuth(); renderMini('market'); updateBalanceView();
}

function listName(nid){
  const u = currentUser(); if(!u) return alert('login');
  const item = u.userNames.find(n=>n.id===nid);
  if (!item) return;
  const price = prompt('Price for username:', item.rarity * 400);
  if (!price) return;
  if (u.balance < 50) return alert('Недостаточно на плату 50★ для листинга');
  if (!confirm(`Выставить ${item.value} за ${price}? Списание 50★`)) return;
  u.balance -= 50;
  const marketItem = { marketId: uid(), type:'username', seller:u.username, name: item, price: Number(price) };
  market.unshift(marketItem); save(STORAGE.MARKET, market);
  u.userNames = u.userNames.filter(x=>x.id!==nid);
  save(STORAGE.USERS, users); renderAuth(); renderMini('market'); updateBalanceView();
}

// ---------- main shop / gifts logic ----------
function renderShop(){
  // show base gifts with buy buttons
  const gridHtml = BASE_GIFTS.map(g=>{
    return `<div class="card">
      <div class="icon" style="background:#f8fafc;font-size:28px">${g.emoji}</div>
      <div class="body"><div class=""><strong>${g.name}</strong></div><div class="small muted">Price: ${g.base}★</div></div>
      <div><button class="btn" onclick="buyBaseGift('${g.id}', ${g.base})">Buy</button></div>
    </div>`;
  }).join('');
  miniContent.innerHTML = `<h3>Gift Shop</h3><div class="grid">${gridHtml}</div>`;
}

// buy base gift
function buyBaseGift(baseId, price){
  const u = currentUser();
  if (!u) return alert('Please register/login');
  if (u.balance < price) return alert('Недостаточно баланса');
  if (!confirm(`Купить ${baseId} за ${price}★?`)) return;
  u.balance -= price;
  // make instance
  const base = BASE_GIFTS.find(b=>b.id===baseId);
  const inst = {
    instanceId: uid(), baseId: base.id, name: base.name, emoji: base.emoji,
    upgraded:false, unique:null, basePrice: base.base
  };
  u.inventory.unshift(inst); save(STORAGE.USERS, users);
  pushChat(`@${u.username} купил ${base.name} за ${price}★`);
  updateBalanceView(); renderMini('shop');
}

// upgrade gift (produce unique)
function upgradeGift(instanceId){
  const u = currentUser(); if(!u) return alert('login');
  const g = u.inventory.find(i=>i.instanceId===instanceId);
  if (!g) return alert('gift not found');
  if (g.upgraded) return alert('already upgraded');
  const fee = 50;
  if (u.balance < fee) return alert('Нет 50★ на апгрейд');
  if (!confirm(`Потратить ${fee}★ на апгрейд?`)) return;
  u.balance -= fee;
  const bg = rand(BG_OPTIONS); const symbol = rand(SYMBOLS); const modelColor = rand(MODEL_COLORS);
  const rarity = calcRarityScore(bg, modelColor, symbol);
  let upgradedPrice = Math.floor(3000 + rarity*50 + Math.random()*5000);
  if (g.name === 'Plush Pepe') upgradedPrice = 1_000_000 + Math.floor(Math.random()*800_000);
  g.upgraded = true;
  g.unique = { id: uid(), bg, symbol, modelColor, rarity, price: upgradedPrice, hue: randomHue() };
  save(STORAGE.USERS, users); updateBalanceView(); pushChat(`@${u.username} улучшил ${g.name} (rarity ${g.unique.rarity})`); renderMini('profile');
}

// ---------- marketplace ----------
// render market
function renderMarket(){
  updateBalanceView();
  if (!market || market.length===0){ miniContent.innerHTML = `<h3>Marketplace</h3><div class="small muted">Marketplace is empty.</div>`; return; }
  const html = market.map(it=>{
    if (it.type === 'phone'){
      return `<div class="card">
        <div class="icon" style="background:#fff">${it.phone.value}</div>
        <div class="body"><div><strong>Phone</strong></div><div class="small muted">Rarity: ${it.phone.rarity}</div><div class="small muted">Seller: @${it.seller}</div></div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="small muted">Price: <strong>${it.price}</strong>★</div>
          <button class="btn" onclick="buyMarket('${it.marketId}')">Buy</button>
          ${it.seller===currentUserName() ? `<button class="btn" onclick="removeFromMarket('${it.marketId}')">Remove (-25★)</button>` : ''}
        </div>
      </div>`;
    } else if (it.type === 'username'){
      return `<div class="card">
        <div class="icon" style="background:#fff">${it.name.value}</div>
        <div class="body"><div><strong>Username</strong></div><div class="small muted">Rarity: ${it.name.rarity}</div><div class="small muted">Seller: @${it.seller}</div></div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="small muted">Price: <strong>${it.price}</strong>★</div>
          <button class="btn" onclick="buyMarket('${it.marketId}')">Buy</button>
          ${it.seller===currentUserName() ? `<button class="btn" onclick="removeFromMarket('${it.marketId}')">Remove (-25★)</button>` : ''}
        </div>
      </div>`;
    } else {
      // gift
      const gift = it.gift;
      const bg = (gift.upgraded && gift.unique) ? gift.unique.bg : '#fff';
      const hue = (gift.upgraded && gift.unique) ? gift.unique.hue : '0deg';
      const symbol = (gift.upgraded && gift.unique) ? gift.unique.symbol : '';
      return `<div class="card" style="background:${bg}">
        <div class="icon" style="background:${gift.upgraded?gift.unique.modelColor:'#f1f5f9'}"><div class="emoji" style="--hue:${hue}">${gift.emoji}</div></div>
        <div class="body"><div><strong>${gift.name}</strong> ${symbol?`<span class="small"> ${symbol}</span>`:''}</div><div class="small muted">Seller: @${it.seller}</div></div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="small muted">Price: <strong>${it.price}</strong>★</div>
          <button class="btn" onclick="buyMarket('${it.marketId}')">Buy</button>
          ${it.seller===currentUserName() ? `<button class="btn" onclick="removeFromMarket('${it.marketId}')">Remove (-25★)</button>` : ''}
        </div>
      </div>`;
    }
  }).join('');
  miniContent.innerHTML = `<h3>Marketplace</h3><div class="grid">${html}</div>`;
}

// buy from market
function buyMarket(marketId){
  const buyer = currentUser(); if(!buyer) return alert('Login required');
  const item = market.find(m=>m.marketId===marketId);
  if (!item) return alert('Item not found');
  if (item.seller === buyer.username) return alert('You are the seller');
  if (buyer.balance < item.price) return alert('Недостаточно средств');
  if (!confirm(`Купить за ${item.price}★?`)) return;
  // process commission 20% to strssler
  const commission = Math.round(item.price * 0.2);
  const payout = item.price - commission;
  // deduct buyer
  buyer.balance -= item.price;
  // credit seller if exists
  const seller = findUser(item.seller);
  if (seller){
    seller.balance += payout;
  }
  // credit commission to strssler
  const str = findUser('strssler');
  if (str) str.balance += commission;
  // transfer item to buyer inventory (or phones/names)
  if (item.type === 'phone'){
    buyer.phoneNumbers.push(item.phone);
  } else if (item.type === 'username'){
    buyer.userNames.push(item.name);
  } else {
    // gift
    buyer.inventory = buyer.inventory || [];
    buyer.inventory.unshift(item.gift);
  }
  // remove from market
  market = market.filter(m=>m.marketId!==marketId);
  save(STORAGE.MARKET, market);
  save(STORAGE.USERS, users);
  // after purchase, check bonuses for buyer (if balance now 0 etc)
  checkAndGrantBonuses(buyer);
  updateBalanceView();
  renderMarket();
  pushChat(`@${buyer.username} купил товар у @${item.seller} за ${item.price}★ (комиссия ${commission}★ → @strssler)`);
}

// remove from market by seller -> return 25 to seller, move back to inventory/phones
function removeFromMarket(marketId){
  const u = currentUser(); if(!u) return alert('login');
  const item = market.find(m=>m.marketId===marketId);
  if (!item) return alert('not found');
  if (item.seller !== u.username) return alert('Только продавец может снять listing');
  if (!confirm('Снять с маркетплейса? При снятии вы получите 25★ обратно.')) return;
  u.balance += 25;
  // return item to user's inventory / collection
  if (item.type === 'phone'){ u.phoneNumbers.push(item.phone) }
  else if (item.type === 'username'){ u.userNames.push(item.name) }
  else { u.inventory.unshift(item.gift) }
  market = market.filter(m=>m.marketId!==marketId);
  save(STORAGE.MARKET, market); save(STORAGE.USERS, users); updateBalanceView(); renderMarket();
  pushChat(`@${u.username} снял свой лот ${item.marketId} и получил 25★`);
}

// ---------- admin panel ----------
function renderAdmin(){
  const me = currentUser(); if(!me || !me.admin) { miniContent.innerHTML = `<div class="small muted">Admin only.</div>`; return; }
  // admin: list users, buttons to block/add balance/add NFT, add stars
  const usersHtml = users.map(u=>{
    return `<div class="card"><div><strong>@${u.username}</strong> ${u.admin?'<span class="badge-admin">ADMIN</span>':''} ${u.banned?'<span style="color:#ef4444">BANNED</span>':''}</div>
      <div class="small muted">Balance: ${u.balance}★ · Inventory: ${u.inventory.length} · phones:${u.phoneNumbers.length} names:${u.userNames.length}</div>
      <div style="margin-top:6px"><button class="btn" onclick="adminToggleBan('${u.username}')">${u.banned?'Unban':'Ban'}</button>
      <button class="btn" onclick="adminAddBalancePrompt('${u.username}')">Add balance</button>
      <button class="btn" onclick="adminAddStarsPrompt('${u.username}')">Add stars</button>
      <button class="btn" onclick="adminAddNFTPrompt('${u.username}')">Add NFT</button>
      </div></div>`;
  }).join('');
  miniContent.innerHTML = `<h3>Admin panel</h3><div>${usersHtml}</div>`;
}

function adminToggleBan(username){
  const u = findUser(username);
  if (!u) return;
  u.banned = !u.banned; save(STORAGE.USERS, users); renderAdmin(); pushChat(`Admin toggled ban for @${username} => ${u.banned}`);
}
function adminAddBalancePrompt(username){
  const v = prompt('Add amount to balance (number):', '1000');
  if (!v) return;
  const amt = Number(v);
  if (isNaN(amt)) return alert('invalid');
  const u = findUser(username); if(!u) return;
  u.balance += amt; save(STORAGE.USERS, users); renderAdmin();
}
function adminAddStarsPrompt(username){
  // synonym for add balance but named "stars"
  const v = prompt('Add stars to account (number):', '100');
  if (!v) return;
  const amt = Number(v);
  if (isNaN(amt)) return alert('invalid');
  const u = findUser(username); if(!u) return;
  u.balance += amt; save(STORAGE.USERS, users); renderAdmin(); pushChat(`Admin added ${amt}★ to @${username}`);
}
function adminAddNFTPrompt(username){
  // create custom NFT with properties
  const name = prompt('NFT name:', 'Custom Gift');
  if (!name) return;
  const emoji = prompt('Emoji (one char):', '✨');
  const rarity = Number(prompt('rarity (1-100):', '90')) || 50;
  const hue = prompt('hue for emoji (e.g. 120deg):', '120deg');
  const bg = prompt('bg css (linear-gradient) or color:', 'linear-gradient(135deg,#a8ff78,#78ffd6)');
  const modelColor = prompt('modelColor hex:', '#06b6d4');
  const price = Number(prompt('base unique price:', '5000')) || 5000;
  const u = findUser(username); if (!u) return;
  const inst = { instanceId: uid(), baseId: 'admin_add', name, emoji, upgraded:true, unique:{id:uid(), bg, symbol: rand(SYMBOLS), modelColor, rarity, price, hue} };
  u.inventory.unshift(inst); save(STORAGE.USERS, users); renderAdmin(); pushChat(`Admin added NFT to @${username}`);
}

// ---------- helpers ----------
function currentUserName(){ return session ? session.username : null }
function currentUser(){ return session ? findUser(session.username) : null }

function updateBalanceView(){
  const u = currentUser();
  // check bonuses when viewing balance (will trigger daily / zero if eligible)
  if (u) checkAndGrantBonuses(u);
  const bal = u ? u.balance : 0;
  if (balanceView) balanceView.textContent = bal;
}

// ---------- render profile and my gifts ----------
function renderMyGifts(){
  const u = currentUser(); if(!u) return miniContent.innerHTML = '<div class="small muted">Login first</div>';
  const invHtml = (u.inventory.length===0) ? '<div class="small muted">No gifts</div>' : u.inventory.map(g=>{
    const bg = g.upgraded && g.unique ? g.unique.bg : '#fff';
    const hue = g.upgraded && g.unique ? g.unique.hue : '0deg';
    const symbol = g.upgraded && g.unique ? g.unique.symbol : '';
    return `<div class="card" style="background:${bg}"><div class="icon" style="background:${g.upgraded?g.unique.modelColor:'#f1f5f9'}"><div class="emoji" style="--hue:${hue}">${g.emoji}</div></div>
      <div class="body"><div><strong>${g.name}</strong> ${symbol?`<span class="small">${symbol}</span>`:''}</div><div class="small muted">Upgraded: ${g.upgraded?g.unique.rarity:'no'}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${g.upgraded ? `<button class="btn" onclick="prepareListGift('${g.instanceId}')">List</button>` : `<button class="btn" onclick="upgradeGift('${g.instanceId}')">Upgrade (50★)</button>`}
      </div></div>`;
  }).join('');
  miniContent.innerHTML = `<h3>My Gifts</h3><div class="grid">${invHtml}</div>`;
}

// prepare sell unique gift
function prepareListGift(instanceId){
  const u = currentUser(); if(!u) return;
  const g = u.inventory.find(i=>i.instanceId===instanceId);
  if (!g) return alert('not found');
  if (!g.upgraded) return alert('only upgraded can be listed');
  const price = prompt('Price to list:', g.unique.price || 3000);
  if (!price) return;
  const p = Number(price);
  if (isNaN(p) || p<=0) return alert('invalid price');
  if (u.balance < 50) return alert('not enough for listing fee 50★');
  if (!confirm(`List ${g.name} for ${p}★? Listing fee 50★ will be taken.`)) return;
  u.balance -= 50;
  const item = { marketId: uid(), type:'gift', seller:u.username, gift:g, price: p };
  market.unshift(item); save(STORAGE.MARKET, market);
  u.inventory = u.inventory.filter(x=>x.instanceId!==instanceId);
  save(STORAGE.USERS, users); updateBalanceView(); renderMyGifts(); renderMarket();
  pushChat(`@${u.username} listed ${g.name} for ${p}★ (fee50)`);
}

// ---------- bots / marketplace auto-buy ----------
let pepeBuyTimer = Date.now() + (5*60_000) + Math.floor(Math.random()*(5*60_000));

function botsLoop(){
  setInterval(()=>{
    if (!market || market.length===0) return;
    const shuffled = market.slice().sort(()=>Math.random()-0.5);
    for (const it of shuffled){
      if (it.type === 'phone' || it.type === 'username'){
        const payload = it.type === 'phone' ? it.phone : it.name;
        const estBase = (it.type==='phone' ? 500 : 400) * payload.rarity;
        if (it.price <= estBase * 0.6 && Math.random() < 0.45){
          market = market.filter(m => m.marketId !== it.marketId);
          const bot = findUser('demo') || users[0];
          bot.balance += it.price;
          pushChat(`🤖 Bot bought ${it.type==='phone' ? it.phone.value : it.name.value} for ${it.price}★`);
          save(STORAGE.MARKET, market); save(STORAGE.USERS, users); renderMarket(); updateBalanceView();
          return;
        } else {
          if (Math.random() < 0.02) {
            market = market.filter(m => m.marketId !== it.marketId);
            const bot = findUser('demo') || users[0];
            bot.balance += it.price;
            pushChat(`🤖 Bot rarely bought ${it.type==='phone' ? it.phone.value : it.name.value} for ${it.price}★`);
            save(STORAGE.MARKET, market); save(STORAGE.USERS, users); renderMarket(); updateBalanceView();
            return;
          }
        }
      } else if (it.type === 'gift'){
        const gift = it.gift;
        const est = gift.upgraded && gift.unique ? gift.unique.price : gift.basePrice || 1000;
        if (gift.upgraded && gift.unique){
          if (gift.name === 'Plush Pepe' && it.price >= 1_000_000){
            if (Date.now() >= pepeBuyTimer && Math.random() < 0.25){
              market = market.filter(m => m.marketId !== it.marketId);
              const bot = findUser('demo') || users[0];
              bot.balance += it.price;
              pushChat(`🤖 A legendary Plush Pepe was bought for ${it.price}★`);
              pepeBuyTimer = Date.now() + (5*60_000) + Math.floor(Math.random()*(5*60_000));
              save(STORAGE.MARKET, market); save(STORAGE.USERS, users); renderMarket(); updateBalanceView();
              return;
            }
          } else {
            if (it.price <= gift.unique.price * 0.6 && Math.random() < 0.25){
              market = market.filter(m => m.marketId !== it.marketId);
              const bot = findUser('demo') || users[0];
              bot.balance += it.price;
              pushChat(`🤖 Bot bought ${gift.name} for ${it.price}★`);
              save(STORAGE.MARKET, market); save(STORAGE.USERS, users); renderMarket(); updateBalanceView();
              return;
            }
            if (it.price > gift.unique.price * 0.6 && it.price <= gift.unique.price * 1.2 && Math.random() < 0.05){
              market = market.filter(m => m.marketId !== it.marketId);
              const bot = findUser('demo') || users[0];
              bot.balance += it.price;
              pushChat(`🤖 Bot occasionally bought ${gift.name} for ${it.price}★`);
              save(STORAGE.MARKET, market); save(STORAGE.USERS, users); renderMarket(); updateBalanceView();
              return;
            }
          }
        } else {
          const base = gift.basePrice || 1000;
          if (it.price <= base * 1.2 && it.price <= 2000 && Math.random() < 0.45){
            market = market.filter(m => m.marketId !== it.marketId);
            const bot = findUser('demo') || users[0];
            bot.balance += it.price;
            pushChat(`🤖 Bot bought ${gift.name} for ${it.price}★`);
            save(STORAGE.MARKET, market); save(STORAGE.USERS, users); renderMarket(); updateBalanceView();
            return;
          }
        }
      }
    }
  }, 5000);
}
botsLoop();

// ---------- main render dispatcher ----------
function openMini(){ miniApp && miniApp.classList.remove('hidden'); updateBalanceView(); renderMini('shop'); renderChat(); }
function renderMini(tab){
  updateBalanceView();
  if (tab === 'shop'){ renderShop(); return; }
  if (tab === 'my'){ renderMyGifts(); return; }
  if (tab === 'profile'){ renderProfile(); return; }
  if (tab === 'market'){ renderMarket(); return; }
  if (tab === 'users'){ renderAuth(); return; }
  if (tab === 'admin'){ renderAdmin(); return; }
}

// profile page with full details and listing buttons
function renderProfile(){
  const u = currentUser(); if(!u) return miniContent.innerHTML = '<div class="small muted">Login required</div>';
  const phonesHtml = u.phoneNumbers.length ? u.phoneNumbers.map(p=>`<div class="card">${p.value} · Rarity:${p.rarity} <button class="btn" onclick="listPhone('${p.id}')">List</button></div>`).join('') : '<div class="small muted">No phones</div>';
  const namesHtml = u.userNames.length ? u.userNames.map(n=>`<div class="card">${n.value} · Rarity:${n.rarity} <button class="btn" onclick="listName('${n.id}')">List</button></div>`).join('') : '<div class="small muted">No names</div>';
  miniContent.innerHTML = `<h3>Profile — @${u.username}</h3>
    <div class="card"><div>Display: ${u.display}</div><div class="small muted">Balance: ${u.balance}★</div></div>
    <h4 style="margin-top:10px">Phones</h4>${phonesHtml}
    <h4 style="margin-top:10px">Usernames</h4>${namesHtml}
    <h4 style="margin-top:10px">Inventory</h4>
  `;
  renderMyGifts(); // show inventory below (reuse)
}

// ---------- current user helpers ----------
function currentUser(){ return session ? findUser(session.username) : null }

// ---------- initial rendering and setup ----------
function init(){
  renderChat();
  updateBalanceView();
  renderMini('shop');
  // if session exists and user banned -> clear session
  if (session && findUser(session.username) && findUser(session.username).banned){ alert('Your account is banned'); session=null; save(STORAGE.SESSION,null) }
}
init();

// expose some functions to global for onclick usage
window.buyBaseGift = buyBaseGift;
window.upgradeGift = upgradeGift;
window.prepareListGift = prepareListGift;
window.buyMarket = buyMarket;
window.removeFromMarket = removeFromMarket;
window.createRandomPhone = createRandomPhone;
window.createRandomUserName = createRandomUserName;
window.listPhone = listPhone;
window.listName = listName;
window.adminToggleBan = adminToggleBan;
window.adminAddBalancePrompt = adminAddBalancePrompt;
window.adminAddNFTPrompt = adminAddNFTPrompt;
window.adminAddStarsPrompt = adminAddStarsPrompt;
window.openMini = openMini;
