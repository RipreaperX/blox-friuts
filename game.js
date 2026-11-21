(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas && canvas.getContext('2d');
  if (!canvas || !ctx) {
    document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;top:40%;left:10%;color:white">Game canvas could not start. Check that index.html is at the repository root.</p>');
    return;
  }

  const $ = (id) => document.getElementById(id);
  const ui = {
    hp: $('hpFill'), energy: $('energyFill'), xp: $('xpFill'),
    level: $('level'), beli: $('beli'), fruit: $('fruitName'),
    quest: $('questCount'), questName: $('questName'), questText: $('questText'),
    toast: $('toast'), region: $('regionName'), shop: $('shop'), shopGrid: $('shopGrid')
  };
  let width = innerWidth, height = innerHeight, dpr = 1;
  function resize() {
    width = innerWidth; height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  const islands = [
    { name: 'Starter Island', x: 0, y: 0, rx: 370, ry: 230, color: '#64bd58', level: 1 },
    { name: 'Jungle Island', x: 900, y: -220, rx: 420, ry: 265, color: '#399d4d', level: 10 },
    { name: 'Desert Island', x: 1850, y: 260, rx: 450, ry: 255, color: '#d8ad55', level: 25 },
    { name: 'Snow Island', x: 2800, y: -220, rx: 420, ry: 260, color: '#c4e4e9', level: 40 },
    { name: 'Sky Island', x: 3600, y: -800, rx: 360, ry: 220, color: '#90d8bd', level: 55 }
  ];
  const defaults = { x: 0, y: 0, hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, level: 1, xp: 0, xpNeed: 100, beli: 500, fruit: 'Flame', sword: false };
  let player = defaults;
  let questKills = 0, questLevel = 1;
  try {
    const saved = JSON.parse(localStorage.getItem('bloxIslandsSave') || 'null');
    if (saved && saved.player) player = { ...defaults, ...saved.player };
    if (saved) { questKills = Number(saved.questKills) || 0; questLevel = Number(saved.questLevel) || 1; }
  } catch (_) {}
  const camera = { x: player.x, y: player.y };
  const keys = Object.create(null);
  let mouseX = width / 2, mouseY = height / 2, shopOpen = false;
  let toastTimer, regionTimer;
  const npcs = [
    { x: 140, y: -45, name: 'Quest Giver', role: 'Bandit quests', kind: 'quest' },
    { x: 255, y: 50, name: 'Weapons Dealer', role: 'Buy swords & fruit', kind: 'shop' },
    { x: 870, y: -360, name: 'Jungle Guide', role: 'Jungle quests', kind: 'quest' },
    { x: 1020, y: -100, name: 'Jungle Shop', role: 'Buy supplies', kind: 'shop' },
    { x: 1810, y: 240, name: 'Desert Hunter', role: 'Desert quests', kind: 'quest' },
    { x: 2770, y: -280, name: 'Snow Trader', role: 'Buy supplies', kind: 'shop' },
    { x: 3590, y: -840, name: 'Sky Elder', role: 'Sky quests', kind: 'quest' }
  ];
  const trees = [];
  islands.forEach((island, index) => {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399 + index;
      const r = 0.35 + (i % 3) * 0.13;
      trees.push({ x: island.x + Math.cos(a) * island.rx * r, y: island.y + Math.sin(a) * island.ry * r, size: .75 + (i % 4) * .12 });
    }
  });
  const enemies = [];
  function spawnEnemy(island) {
    const a = Math.random() * Math.PI * 2, r = .3 + Math.random() * .52;
    return { x: island.x + Math.cos(a) * island.rx * r, y: island.y + Math.sin(a) * island.ry * r,
      hp: 35 + island.level * 2, maxHp: 35 + island.level * 2, speed: 0.65 + island.level * .012,
      level: island.level, island, name: island.level < 10 ? 'Bandit' : 'Pirate', alive: true, respawn: 0, attack: 0, flash: 0 };
  }
  islands.forEach(island => { for (let i = 0; i < 5; i++) enemies.push(spawnEnemy(island)); });

  function saveGame() {
    try { localStorage.setItem('bloxIslandsSave', JSON.stringify({ player, questKills, questLevel })); } catch (_) {}
  }
  function toast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message; ui.toast.style.opacity = '1';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.style.opacity = '0'; }, 1800);
  }
  function updateQuest() {
    if (!ui.questName || !ui.questText) return;
    const goals = [5, 8];
    if (questLevel === 1) {
      ui.questName.textContent = 'Bandit Trouble';
      ui.questText.innerHTML = `Defeat 5 enemies<br><b id="questCount">${questKills} / 5</b>`;
    } else if (questLevel === 2) {
      ui.questName.textContent = 'Island Cleanup';
      ui.questText.innerHTML = `Defeat 8 more enemies<br><b id="questCount">${questKills} / 8</b>`;
    } else {
      ui.questName.textContent = 'Island Legend';
      ui.questText.innerHTML = `Explore the islands and defeat enemies<br><b id="questCount">${questKills} defeated</b>`;
    }
    ui.quest = $('questCount');
  }
  function gainXP(amount) {
    player.xp += amount;
    while (player.xp >= player.xpNeed) {
      player.xp -= player.xpNeed; player.level++;
      player.xpNeed = Math.floor(player.xpNeed * 1.3);
      player.maxHp += 10; player.maxEnergy += 5;
      player.hp = player.maxHp; player.energy = player.maxEnergy;
      toast(`Level up! Level ${player.level}`);
    }
  }
  function defeat(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false; enemy.respawn = 420; questKills++;
    player.beli += 50 + enemy.level * 2;
    gainXP(30 + enemy.level * 3);
    if (questLevel === 1 && questKills >= 5) { questKills = 0; questLevel = 2; player.beli += 500; toast('Quest complete! Bonus: 500 Beli'); }
    else if (questLevel === 2 && questKills >= 8) { questKills = 0; questLevel = 3; player.beli += 1000; toast('Quest complete! Island Legend unlocked'); }
    updateQuest(); saveGame();
  }
  function attack() {
    if (shopOpen || player.energy < 7) return;
    player.energy -= 7;
    for (const e of enemies) {
      if (!e.alive || Math.hypot(e.x - player.x, e.y - player.y) > 76) continue;
      e.hp -= player.sword ? 32 : 20; e.flash = 8;
      if (e.hp <= 0) defeat(e);
    }
  }
  function fruitAbility() {
    if (shopOpen) return;
    if (player.energy < 24) { toast('Not enough energy'); return; }
    player.energy -= 24;
    const range = player.fruit === 'Light' ? 250 : 190;
    enemies.forEach(e => {
      if (!e.alive) return;
      const dx = e.x - player.x, dy = e.y - player.y;
      const distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      if (distance < range && Math.cos(angle - player.angle) > .25) {
        e.hp -= player.fruit === 'Ice' ? 48 : 40; e.flash = 12;
        if (e.hp <= 0) defeat(e);
      }
    });
    toast(`${player.fruit} blast!`);
  }
  function dash() {
    if (player.energy < 12) { toast('Not enough energy'); return; }
    player.energy -= 12; player.x += Math.cos(player.angle) * 105; player.y += Math.sin(player.angle) * 105;
  }
  const shopItems = [
    { name: 'Katana', icon: '⚔️', price: 500, buy: () => { player.sword = true; } },
    { name: 'Flame Fruit', icon: '🔥', price: 700, buy: () => { player.fruit = 'Flame'; } },
    { name: 'Ice Fruit', icon: '❄️', price: 1100, buy: () => { player.fruit = 'Ice'; } },
    { name: 'Light Fruit', icon: '✨', price: 1600, buy: () => { player.fruit = 'Light'; } },
    { name: 'Health upgrade', icon: '❤️', price: 350, buy: () => { player.maxHp += 20; player.hp = player.maxHp; } },
    { name: 'Energy upgrade', icon: '⚡', price: 350, buy: () => { player.maxEnergy += 20; player.energy = player.maxEnergy; } }
  ];
  function openShop() {
    if (!ui.shop || !ui.shopGrid) { toast('Shop unavailable'); return; }
    shopOpen = true; ui.shop.style.display = 'block'; ui.shopGrid.replaceChildren();
    shopItems.forEach(item => {
      const card = document.createElement('div'); card.className = 'shop-card';
      const icon = document.createElement('div'); icon.style.fontSize = '30px'; icon.textContent = item.icon;
      const title = document.createElement('b'); title.textContent = item.name;
      const price = document.createElement('div'); price.textContent = `${item.price} Beli`;
      const button = document.createElement('button'); button.textContent = 'Buy';
      button.addEventListener('click', () => {
        if (player.beli < item.price) { toast('Not enough Beli'); return; }
        player.beli -= item.price; item.buy(); toast(`${item.name} purchased`); saveGame(); updateUI();
      });
      card.append(icon, title, price, button); ui.shopGrid.appendChild(card);
    });
  }
  function closeShop() { shopOpen = false; if (ui.shop) ui.shop.style.display = 'none'; }
  if ($('closeShop')) $('closeShop').addEventListener('click', closeShop);
  function interact() {
    const npc = npcs.find(n => Math.hypot(n.x - player.x, n.y - player.y) < 100);
    if (!npc) { toast('Move closer to an NPC'); return; }
    if (npc.kind === 'shop') openShop();
    else { updateQuest(); toast(`Quest: defeat enemies (${questKills} defeated)`); }
  }
  function updateUI() {
    if (ui.hp) ui.hp.style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`;
    if (ui.energy) ui.energy.style.width = `${Math.max(0, player.energy / player.maxEnergy * 100)}%`;
    if (ui.xp) ui.xp.style.width = `${Math.max(0, player.xp / player.xpNeed * 100)}%`;
    if (ui.level) ui.level.textContent = player.level;
    if (ui.beli) ui.beli.textContent = player.beli;
    if (ui.fruit) ui.fruit.textContent = player.fruit;
  }
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === 'z' || k === ' ') attack();
    if (k === 'x') fruitAbility();
    if (k === 'shift') dash();
    if (k === 'e') interact();
    if (k === 'escape') closeShop();
    if (k === 'r') { player.hp = player.maxHp; player.energy = player.maxEnergy; }
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button === 0) attack();
    mouseX = e.clientX; mouseY = e.clientY;
  });
  document.querySelectorAll('.ability').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'm1') attack(); else if (action === 'fruit') fruitAbility(); else if (action === 'dash') dash();
  }));
  const actionBtn = $('actionBtn'); if (actionBtn) actionBtn.addEventListener('click', attack);

  const joystick = $('joystick'), stick = $('stick');
  const joy = { active: false, dx: 0, dy: 0 };
  if (joystick && stick) {
    joystick.addEventListener('pointerdown', e => { joy.active = true; joystick.setPointerCapture(e.pointerId); moveJoystick(e); });
    joystick.addEventListener('pointermove', e => { if (joy.active) moveJoystick(e); });
    const stopJoy = () => { joy.active = false; joy.dx = joy.dy = 0; stick.style.transform = ''; };
    joystick.addEventListener('pointerup', stopJoy); joystick.addEventListener('pointercancel', stopJoy);
  }
  function moveJoystick(e) {
    const rect = joystick.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2), dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy); if (len > 40) { dx *= 40 / len; dy *= 40 / len; }
    joy.dx = dx / 40; joy.dy = dy / 40; stick.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function currentIsland(x, y) {
    return islands.find(i => ((x - i.x) / i.rx) ** 2 + ((y - i.y) / i.ry) ** 2 < 1);
  }
  let lastIsland = '';
  function update() {
    if (!shopOpen) {
      let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + joy.dx;
      let dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) + joy.dy;
      const len = Math.hypot(dx, dy);
      if (len > 0) { dx /= len; dy /= len; player.x += dx * 3.8; player.y += dy * 3.8; }
      player.angle = Math.atan2(mouseY - height / 2, mouseX - width / 2);
      for (const e of enemies) {
        if (!e.alive) { if (--e.respawn <= 0) Object.assign(e, spawnEnemy(e.island)); continue; }
        const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
        if (dist < 270 && dist > 1) { e.x += dx / dist * e.speed; e.y += dy / dist * e.speed; }
        if (dist < 38) { e.attack++; if (e.attack > 45) { player.hp -= 7 + e.level * .12; e.attack = 0; } }
        if (e.flash > 0) e.flash--;
      }
      player.energy = Math.min(player.maxEnergy, player.energy + .12);
      player.hp = Math.min(player.maxHp, player.hp + .015);
      if (player.hp <= 0) { player.hp = player.maxHp; player.x = 0; player.y = 0; player.beli = Math.max(0, player.beli - 100); toast('You were defeated and returned to Starter Island'); }
    }
    camera.x += (player.x - camera.x) * .09; camera.y += (player.y - camera.y) * .09;
    const island = currentIsland(player.x, player.y);
    if (island && island.name !== lastIsland) {
      lastIsland = island.name;
      if (ui.region) { ui.region.textContent = island.name; ui.region.style.opacity = '1'; clearTimeout(regionTimer); regionTimer = setTimeout(() => ui.region.style.opacity = '0', 1800); }
    }
    updateUI();
  }
  function screen(x, y) { return { x: x - camera.x + width / 2, y: y - camera.y + height / 2 }; }
  function ellipse(x, y, rx, ry, color) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }
  function drawOcean() {
    const g = ctx.createLinearGradient(0, 0, 0, height); g.addColorStop(0, '#65c9e8'); g.addColorStop(1, '#126ca7');
    ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(230,250,255,.16)'; ctx.lineWidth = 2;
    for (let y = 15; y < height; y += 52) {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 24) { const py = y + Math.sin((x + camera.x) * .012 + y) * 4; if (!x) ctx.moveTo(x, py); else ctx.lineTo(x, py); }
      ctx.stroke();
    }
  }
  function drawIsland(i) {
    const p = screen(i.x, i.y);
    ellipse(p.x + 8, p.y + 17, i.rx + 12, i.ry + 13, 'rgba(0,42,70,.34)');
    ellipse(p.x, p.y, i.rx, i.ry, '#ddc77d');
    const gradient = ctx.createRadialGradient(p.x - i.rx * .2, p.y - i.ry * .25, 10, p.x, p.y, i.rx);
    gradient.addColorStop(0, i.color === '#d8ad55' ? '#f0d47a' : '#9add70'); gradient.addColorStop(1, i.color);
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(p.x, p.y, i.rx - 22, i.ry - 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(22,70,43,.2)';
    for (let n = 0; n < 8; n++) { const a = n * 2.4; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * i.rx * .28, p.y + Math.sin(a) * i.ry * .3, 10, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(15,35,45,.65)'; ctx.strokeText(i.name, p.x, p.y - i.ry - 14); ctx.fillStyle = '#fff'; ctx.fillText(i.name, p.x, p.y - i.ry - 14);
  }
  function drawTree(t) {
    const p = screen(t.x, t.y), s = t.size;
    ctx.fillStyle = '#765032'; ctx.fillRect(p.x - 6 * s, p.y - 22 * s, 12 * s, 28 * s);
    ellipse(p.x, p.y - 30 * s, 25 * s, 22 * s, '#287a3d');
    ellipse(p.x - 13 * s, p.y - 28 * s, 17 * s, 16 * s, '#4eaa4f');
    ellipse(p.x + 13 * s, p.y - 29 * s, 17 * s, 16 * s, '#398d42');
  }
  function drawCharacter(x, y, color, label, isPlayer = false) {
    const p = screen(x, y);
    ellipse(p.x, p.y + 11, 17, 7, 'rgba(0,0,0,.25)');
    ctx.fillStyle = color; ctx.fillRect(p.x - 11, p.y - 4, 22, 23);
    ctx.beginPath(); ctx.arc(p.x, p.y - 13, 12, 0, Math.PI * 2); ctx.fillStyle = isPlayer ? '#ffd0a0' : '#e5b28a'; ctx.fill();
    ctx.fillStyle = isPlayer ? '#263c65' : '#332e38'; ctx.fillRect(p.x - 11, p.y - 26, 22, 7);
    ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(label, p.x, p.y - 34);
    if (isPlayer) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(player.angle); ctx.fillStyle = '#e8e8ed'; ctx.fillRect(12, -3, 28, 4); ctx.restore();
    }
  }
  function drawEnemy(e) {
    const p = screen(e.x, e.y);
    drawCharacter(e.x, e.y, e.flash ? '#fff' : '#925747', `Lv.${e.level} ${e.name}`);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(p.x - 20, p.y - 43, 40, 5);
    ctx.fillStyle = '#ff5364'; ctx.fillRect(p.x - 20, p.y - 43, 40 * Math.max(0, e.hp / e.maxHp), 5);
  }
  function drawNPC(n) {
    const p = screen(n.x, n.y); drawCharacter(n.x, n.y, n.kind === 'shop' ? '#4978e7' : '#d5a833', n.name);
    ctx.fillStyle = '#fff1a8'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('E', p.x, p.y - 49);
  }
  function render() {
    drawOcean(); islands.forEach(drawIsland); trees.forEach(drawTree);
    npcs.forEach(drawNPC); enemies.forEach(e => { if (e.alive) drawEnemy(e); });
    drawCharacter(player.x, player.y, '#388b61', `Level ${player.level}`, true);
  }
  function frame() { update(); render(); requestAnimationFrame(frame); }
  updateQuest(); updateUI(); frame();
  setInterval(saveGame, 5000);
  addEventListener('beforeunload', saveGame);
})();
