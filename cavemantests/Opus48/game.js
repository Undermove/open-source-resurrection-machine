/* ============================================================
   COLOSSUS — top-down giant robot
   Crush the city to feed your reactor and grow. Manage heat.
   Pure canvas, no dependencies.
   ============================================================ */

(() => {
  "use strict";

  // ---------- Canvas / DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const hud = document.getElementById("hud");
  const startScreen = document.getElementById("start");
  const overScreen = document.getElementById("over");
  const overTitle = document.getElementById("overTitle");
  const overStats = document.getElementById("overStats");
  const elHp = document.getElementById("hpFill");
  const elCore = document.getElementById("coreFill");
  const elHeat = document.getElementById("heatFill");
  const elTier = document.getElementById("tier");
  const elScore = document.getElementById("score");
  const elWave = document.getElementById("wave");
  const elEnemies = document.getElementById("enemiesLeft");

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Math helpers ----------
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const angLerp = (a, b, t) => {
    let d = ((b - a + Math.PI) % TAU) - Math.PI;
    if (d < -Math.PI) d += TAU;
    return a + d * t;
  };

  // ---------- World config ----------
  const WORLD = 4200;            // half-extent of arena (square, -W..W)
  const TIERS = [
    { name: "MK.I",   r: 72,  hp: 120, dmg: 14, crush: 60,  spd: 0.55, turn: 0.085 },
    { name: "MK.II",  r: 92,  hp: 180, dmg: 20, crush: 120, spd: 0.52, turn: 0.072 },
    { name: "MK.III", r: 116, hp: 260, dmg: 28, crush: 220, spd: 0.49, turn: 0.060 },
    { name: "MK.IV",  r: 142, hp: 360, dmg: 38, crush: 360, spd: 0.46, turn: 0.050 },
    { name: "MK.V",   r: 172, hp: 500, dmg: 52, crush: 600, spd: 0.43, turn: 0.042 },
  ];

  // ---------- Input ----------
  const keys = {};
  const mouse = { x: 0, y: 0, down: false };
  window.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", e => { keys[e.code] = false; });
  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener("mousedown", e => { if (e.button === 0) mouse.down = true; });
  window.addEventListener("mouseup", e => { if (e.button === 0) mouse.down = false; });
  // touch (basic): tap aims+fires, drag aims
  canvas.addEventListener("touchstart", e => { handleTouch(e); mouse.down = true; e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchmove", e => { handleTouch(e); e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchend", () => { mouse.down = false; });
  function handleTouch(e) {
    const t = e.touches[0]; if (!t) return;
    const r = canvas.getBoundingClientRect();
    mouse.x = t.clientX - r.left; mouse.y = t.clientY - r.top;
  }

  // ---------- Game state ----------
  let game = null;
  const cam = { x: 0, y: 0, zoom: 0.62, shake: 0 };

  function newGame() {
    game = {
      running: true,
      over: false,
      win: false,
      t: 0,
      score: 0,
      wave: 0,
      buildings: [],
      enemies: [],
      eBullets: [],
      pBullets: [],
      shocks: [],
      particles: [],
      floaters: [],
      spawnQueue: [],
      waveTimer: 90,
      boss: null,
      player: makePlayer(),
    };
    buildCity();
    cam.x = 0; cam.y = 0; cam.zoom = 0.62; cam.shake = 0;
  }

  function makePlayer() {
    const t = TIERS[0];
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      angle: 0,           // body facing (movement)
      turret: 0,          // cannon aim
      tier: 0,
      r: t.r,
      hp: t.hp, maxHp: t.hp,
      reactor: 0,         // 0..100 -> grow
      heat: 0, overheat: false,
      fireCd: 0,
      stompCd: 0,
      novaCd: 0,
      step: 0,            // leg animation phase
    };
  }

  // ---------- City generation ----------
  function buildCity() {
    const b = game.buildings;
    const cell = 150, road = 60;
    for (let gx = -WORLD + cell; gx < WORLD - cell; gx += cell + road) {
      for (let gy = -WORLD + cell; gy < WORLD - cell; gy += cell + road) {
        // central plaza spawn-safe zone
        if (Math.abs(gx) < 280 && Math.abs(gy) < 280) continue;
        if (Math.random() < 0.12) continue; // some empty lots
        const pad = rand(8, 26);
        const w = cell - pad, h = cell - pad;
        const tall = rand(0, 1);
        const maxhp = Math.round(lerp(30, 360, tall * tall));
        const tint = 18 + randInt(0, 26);
        b.push({
          x: gx + (cell - w) / 2 + rand(-6, 6),
          y: gy + (cell - h) / 2 + rand(-6, 6),
          w, h,
          height: lerp(10, 90, tall),
          hp: maxhp, maxhp,
          color: `hsl(${randInt(200, 230)}, 22%, ${tint}%)`,
          top: `hsl(${randInt(200, 230)}, 30%, ${tint + 16}%)`,
          flash: 0,
          dead: false,
        });
      }
    }
  }

  // ---------- Waves ----------
  function startWave(n) {
    game.wave = n;
    const p = game.player;
    if (n === 5) {
      // BOSS wave
      spawnBoss();
      addFloater(p.x, p.y - 240, "⚠ APEX PREDATOR INBOUND", "#ff3b3b", 2.4);
      return;
    }
    const count = 4 + n * 3;
    game.spawnQueue = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let type = "tank";
      if (n >= 2 && roll < 0.32) type = "jet";
      else if (n >= 3 && roll > 0.78) type = "turret";
      game.spawnQueue.push({ type, delay: i * rand(16, 34) });
    }
    addFloater(p.x, p.y - 240, "WAVE " + n, "#00e5ff", 1.8);
  }

  function spawnFromQueue() {
    const q = game.spawnQueue;
    for (let i = q.length - 1; i >= 0; i--) {
      q[i].delay--;
      if (q[i].delay <= 0) { spawnEnemy(q[i].type); q.splice(i, 1); }
    }
  }

  function edgeSpawn() {
    // spawn just outside view but inside world
    const a = rand(0, TAU);
    const d = rand(900, 1300);
    const p = game.player;
    return {
      x: clamp(p.x + Math.cos(a) * d, -WORLD + 60, WORLD - 60),
      y: clamp(p.y + Math.sin(a) * d, -WORLD + 60, WORLD - 60),
    };
  }

  function spawnEnemy(type) {
    const s = edgeSpawn();
    const wave = game.wave;
    const base = { x: s.x, y: s.y, vx: 0, vy: 0, angle: 0, fireCd: rand(40, 90), dead: false, hitFlash: 0, type };
    if (type === "tank") {
      Object.assign(base, { r: 16, hp: 18 + wave * 6, dmg: 10, spd: 1.0, range: 520, shotSpd: 7.5 });
    } else if (type === "jet") {
      Object.assign(base, { r: 13, hp: 12 + wave * 4, dmg: 7, spd: 2.6, range: 460, shotSpd: 9, strafe: rand(0,1)<.5?1:-1, orbit: rand(280,420) });
    } else if (type === "turret") {
      Object.assign(base, { r: 18, hp: 40 + wave * 10, dmg: 16, spd: 0, range: 700, shotSpd: 6, homing: true });
    }
    game.enemies.push(base);
  }

  function spawnBoss() {
    const s = edgeSpawn();
    game.boss = {
      x: s.x, y: s.y, vx: 0, vy: 0, angle: 0, turret: 0,
      r: 130, hp: 2600, maxHp: 2600, dmg: 26,
      fireCd: 60, sweepCd: 220, dead: false, hitFlash: 0, type: "boss", spin: 0,
    };
    game.enemies.push(game.boss);
  }

  // ---------- Effects ----------
  function addParticles(x, y, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(opt.spMin ?? 1, opt.spMax ?? 6);
      game.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(opt.lifeMin ?? 20, opt.lifeMax ?? 50),
        max: 50, r: rand(opt.rMin ?? 1.5, opt.rMax ?? 5),
        color: opt.color || "#ffb347", glow: opt.glow ?? false,
      });
    }
  }
  function addFloater(x, y, text, color, scale = 1) {
    game.floaters.push({ x, y, text, color, scale, life: 70, max: 70 });
  }
  function shake(amt) { cam.shake = Math.min(cam.shake + amt, 60); }

  // ---------- Player update ----------
  function updatePlayer(dt) {
    const p = game.player, t = TIERS[p.tier];

    // movement input -> desired direction
    let ix = 0, iy = 0;
    if (keys.KeyW || keys.ArrowUp) iy -= 1;
    if (keys.KeyS || keys.ArrowDown) iy += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    const moving = ix || iy;
    if (moving) {
      const a = Math.atan2(iy, ix);
      p.angle = angLerp(p.angle, a, t.turn);
      const thrust = t.spd;
      p.vx += Math.cos(p.angle) * thrust;
      p.vy += Math.sin(p.angle) * thrust;
      p.step += Math.hypot(p.vx, p.vy) * 0.03;
    }
    // heavy mass: friction
    p.vx *= 0.90; p.vy *= 0.90;
    const maxSpd = 6 + p.tier * 0.6;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > maxSpd) { p.vx *= maxSpd / sp; p.vy *= maxSpd / sp; }
    p.x = clamp(p.x + p.vx, -WORLD + p.r, WORLD - p.r);
    p.y = clamp(p.y + p.vy, -WORLD + p.r, WORLD - p.r);

    // aim turret to mouse (world)
    const mw = screenToWorld(mouse.x, mouse.y);
    p.turret = angLerp(p.turret, Math.atan2(mw.y - p.y, mw.x - p.x), 0.35);

    // heat cool
    if (p.overheat) { p.heat -= 0.6; if (p.heat <= 40) p.overheat = false; }
    else p.heat = Math.max(0, p.heat - 0.45);

    // cooldowns
    if (p.fireCd > 0) p.fireCd--;
    if (p.stompCd > 0) p.stompCd--;
    if (p.novaCd > 0) p.novaCd--;

    // FIRE plasma lance
    if (mouse.down && !p.overheat && p.fireCd <= 0) {
      firePlasma();
      p.fireCd = 7;
      p.heat += 7;
      if (p.heat >= 100) { p.heat = 100; p.overheat = true; addFloater(p.x, p.y - p.r - 30, "OVERHEAT", "#ff3b3b", 1.2); }
    }

    // STOMP
    if (keys.Space && p.stompCd <= 0) stomp();

    // NOVA overcharge
    if (keys.ShiftLeft && p.novaCd <= 0 && p.reactor >= 35) nova();

    // crush buildings under foot
    crushCity(dt);

    // reactor -> grow
    if (p.reactor >= 100 && p.tier < TIERS.length - 1) tierUp();
  }

  function firePlasma() {
    const p = game.player, t = TIERS[p.tier];
    const muzzle = p.r * 0.95;
    const x = p.x + Math.cos(p.turret) * muzzle;
    const y = p.y + Math.sin(p.turret) * muzzle;
    const spread = (Math.random() - 0.5) * 0.05;
    const a = p.turret + spread;
    game.pBullets.push({
      x, y, vx: Math.cos(a) * 22, vy: Math.sin(a) * 22,
      r: 5 + p.tier, dmg: t.dmg, life: 60,
    });
    addParticles(x, y, 3, { color: "#9be8ff", spMin: 1, spMax: 3, lifeMin: 6, lifeMax: 14, rMin: 1, rMax: 2.5, glow: true });
    shake(1.2);
  }

  function stomp() {
    const p = game.player, t = TIERS[p.tier];
    p.stompCd = 55;
    const R = p.r * 3.2;
    game.shocks.push({ x: p.x, y: p.y, r: p.r, max: R, life: 26, max_life: 26, dmg: t.dmg * 2.2 });
    shake(14 + p.tier * 3);
    addParticles(p.x, p.y, 26, { color: "#cfd8ff", spMin: 2, spMax: 9, rMin: 2, rMax: 6 });
    p.heat += 4;
  }

  function nova() {
    const p = game.player, t = TIERS[p.tier];
    p.reactor = Math.max(0, p.reactor - 35);
    p.novaCd = 120;
    const R = p.r * 5.5;
    game.shocks.push({ x: p.x, y: p.y, r: p.r, max: R, life: 34, max_life: 34, dmg: t.dmg * 4, nova: true });
    shake(26);
    addParticles(p.x, p.y, 60, { color: "#ffd23b", spMin: 4, spMax: 14, rMin: 2, rMax: 8, glow: true });
    addFloater(p.x, p.y - p.r - 30, "OVERCHARGE", "#ffd23b", 1.4);
  }

  function tierUp() {
    const p = game.player;
    p.tier++;
    p.reactor = 0;
    const t = TIERS[p.tier];
    p.r = t.r; p.maxHp = t.hp; p.hp = t.hp;
    shake(34);
    addParticles(p.x, p.y, 90, { color: "#00ffa3", spMin: 3, spMax: 12, rMin: 2, rMax: 7, glow: true });
    addFloater(p.x, p.y - p.r - 40, "SCALE UP — " + t.name, "#00ffa3", 2.0);
    cam.zoom = 0.62 - p.tier * 0.03;
  }

  // circle (player) vs building rects
  function crushCity(dt) {
    const p = game.player, t = TIERS[p.tier];
    const footR = p.r * 0.78;
    const sp = Math.hypot(p.vx, p.vy);
    for (const b of game.buildings) {
      if (b.dead) continue;
      // quick reject
      if (Math.abs(b.x + b.w/2 - p.x) > footR + b.w || Math.abs(b.y + b.h/2 - p.y) > footR + b.h) continue;
      const cx = clamp(p.x, b.x, b.x + b.w);
      const cy = clamp(p.y, b.y, b.y + b.h);
      if (dist2(p.x, p.y, cx, cy) < footR * footR) {
        const dmg = (t.crush * 0.06) * (0.4 + sp * 0.12);
        b.hp -= dmg; b.flash = 1;
        if (sp > 0.5 && Math.random() < 0.3)
          addParticles(cx, cy, 1, { color: "#6f7fa5", spMin: .5, spMax: 2, lifeMin: 8, lifeMax: 18, rMin: 1, rMax: 3 });
        if (b.hp <= 0) destroyBuilding(b);
        // resistance slows the colossus a touch
        p.vx *= 0.985; p.vy *= 0.985;
      }
    }
  }

  function destroyBuilding(b) {
    b.dead = true;
    const p = game.player;
    const value = Math.round(lerp(4, 22, b.maxhp / 360));
    game.score += value * 10;
    p.reactor = Math.min(100, p.reactor + value * 0.9);
    p.hp = Math.min(p.maxHp, p.hp + value * 0.25); // crushing repairs hull a little
    addParticles(b.x + b.w/2, b.y + b.h/2, 14 + Math.round(b.height/6),
      { color: "#8895b5", spMin: 1, spMax: 7, rMin: 2, rMax: 6 });
    addParticles(b.x + b.w/2, b.y + b.h/2, 6,
      { color: "#ffb347", spMin: 1, spMax: 4, rMin: 1, rMax: 3, glow: true });
    shake(3);
  }

  // ---------- Enemy update ----------
  function updateEnemies(dt) {
    const p = game.player;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (e.hitFlash > 0) e.hitFlash--;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.angle = angLerp(e.angle, Math.atan2(dy, dx), 0.1);

      if (e.type === "boss") { updateBoss(e, dx, dy, d); continue; }

      if (e.type === "tank") {
        if (d > e.range * 0.8) { e.vx = (dx/d) * e.spd; e.vy = (dy/d) * e.spd; }
        else { e.vx *= 0.9; e.vy *= 0.9; }
      } else if (e.type === "jet") {
        // orbit + strafe
        const tang = Math.atan2(dy, dx) + e.strafe * 1.2;
        const want = e.orbit;
        const pull = (d - want) * 0.012;
        e.vx = (dx/d) * pull * e.spd + Math.cos(tang) * e.spd * 0.8;
        e.vy = (dy/d) * pull * e.spd + Math.sin(tang) * e.spd * 0.8;
      } else if (e.type === "turret") {
        e.vx = 0; e.vy = 0;
      }
      e.x += e.vx; e.y += e.vy;
      e.x = clamp(e.x, -WORLD, WORLD); e.y = clamp(e.y, -WORLD, WORLD);

      // fire
      e.fireCd--;
      if (e.fireCd <= 0 && d < e.range) {
        enemyShoot(e, dx/d, dy/d);
        e.fireCd = e.type === "jet" ? rand(28, 50) : rand(70, 120);
      }

      // contact damage to colossus
      if (d < p.r * 0.8 + e.r) {
        damagePlayer(e.dmg * 0.04);
        // colossus body shoves/grinds small enemies
        e.hp -= TIERS[p.tier].dmg * 0.15;
        if (e.hp <= 0) killEnemy(e);
      }
    }
    // cull dead
    game.enemies = game.enemies.filter(e => !e.dead);
  }

  function updateBoss(e, dx, dy, d) {
    const p = game.player;
    e.spin += 0.02;
    e.turret = angLerp(e.turret, Math.atan2(dy, dx), 0.04);
    // approach to mid range
    const want = 520;
    const pull = (d - want) * 0.006;
    e.vx = lerp(e.vx, (dx/d) * pull * 2.2, 0.05);
    e.vy = lerp(e.vy, (dy/d) * pull * 2.2, 0.05);
    e.x += e.vx; e.y += e.vy;
    e.x = clamp(e.x, -WORLD, WORLD); e.y = clamp(e.y, -WORLD, WORLD);

    e.fireCd--;
    if (e.fireCd <= 0) {
      // triple spread aimed shots
      for (let i = -1; i <= 1; i++) {
        const a = e.turret + i * 0.16;
        spawnEBullet(e.x + Math.cos(a)*e.r, e.y + Math.sin(a)*e.r, Math.cos(a)*8, Math.sin(a)*8, e.dmg, 7, "#ff6a3b");
      }
      e.fireCd = 36;
    }
    e.sweepCd--;
    if (e.sweepCd <= 0) {
      // radial barrage
      for (let i = 0; i < 22; i++) {
        const a = e.spin + (i / 22) * TAU;
        spawnEBullet(e.x + Math.cos(a)*e.r, e.y + Math.sin(a)*e.r, Math.cos(a)*5.5, Math.sin(a)*5.5, e.dmg*0.7, 6, "#ffae3b");
      }
      e.sweepCd = 200;
      shake(8);
    }
    if (d < p.r + e.r) damagePlayer(e.dmg * 0.06);
  }

  function enemyShoot(e, nx, ny) {
    const col = e.type === "turret" ? "#ff3bd0" : "#ff5b5b";
    spawnEBullet(e.x + nx*e.r, e.y + ny*e.r, nx*e.shotSpd, ny*e.shotSpd, e.dmg, e.type==="turret"?6:5, col, e.homing);
  }
  function spawnEBullet(x, y, vx, vy, dmg, r, color, homing=false) {
    game.eBullets.push({ x, y, vx, vy, dmg, r, color, life: 130, homing });
  }

  function killEnemy(e) {
    e.dead = true;
    const p = game.player;
    const val = e.type === "boss" ? 500 : e.type === "turret" ? 14 : e.type === "jet" ? 9 : 7;
    game.score += val * 12;
    p.reactor = Math.min(100, p.reactor + (e.type === "boss" ? 0 : val * 0.5));
    addParticles(e.x, e.y, e.type === "boss" ? 120 : 18,
      { color: "#ff8c3b", spMin: 2, spMax: e.type==="boss"?16:9, rMin: 2, rMax: e.type==="boss"?9:5, glow: true });
    shake(e.type === "boss" ? 40 : 4);
    if (e.type === "boss") {
      game.boss = null;
      victory();
    }
  }

  function damagePlayer(amt) {
    const p = game.player;
    if (p.hp <= 0) return;
    p.hp -= amt;
    if (p.hp <= 0) { p.hp = 0; gameOver(false); }
  }

  // ---------- Bullets ----------
  function updateBullets() {
    const p = game.player;
    // player plasma
    for (const b of game.pBullets) {
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0) { b.dead = true; continue; }
      // hit enemies
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (e.r + b.r) ** 2) {
          e.hp -= b.dmg; e.hitFlash = 6; b.dead = true;
          addParticles(b.x, b.y, 5, { color: "#9be8ff", spMin: 1, spMax: 4, rMin: 1, rMax: 3, glow: true });
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
      // plasma also chips buildings
      if (!b.dead) {
        for (const bd of game.buildings) {
          if (bd.dead) continue;
          if (b.x > bd.x && b.x < bd.x+bd.w && b.y > bd.y && b.y < bd.y+bd.h) {
            bd.hp -= b.dmg * 0.5; bd.flash = 1; b.dead = true;
            if (bd.hp <= 0) destroyBuilding(bd);
            break;
          }
        }
      }
    }
    game.pBullets = game.pBullets.filter(b => !b.dead);

    // enemy bullets
    for (const b of game.eBullets) {
      if (b.homing && b.life > 90) {
        const ax = p.x - b.x, ay = p.y - b.y, d = Math.hypot(ax, ay) || 1;
        b.vx = lerp(b.vx, (ax/d) * 6, 0.04);
        b.vy = lerp(b.vy, (ay/d) * 6, 0.04);
      }
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0) { b.dead = true; continue; }
      if (dist2(b.x, b.y, p.x, p.y) < (p.r * 0.82 + b.r) ** 2) {
        damagePlayer(b.dmg); b.dead = true;
        addParticles(b.x, b.y, 6, { color: b.color, spMin: 1, spMax: 4, rMin: 1, rMax: 3, glow: true });
        shake(3);
      }
    }
    game.eBullets = game.eBullets.filter(b => !b.dead);
  }

  // ---------- Shockwaves ----------
  function updateShocks() {
    for (const s of game.shocks) {
      const t = 1 - s.life / s.max_life;
      s.r = lerp(s.r, s.max, 0.35);
      s.life--;
      // damage enemies in ring band
      for (const e of game.enemies) {
        if (e.dead || e._hitBy === s) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < s.r && d > s.r - 60) {
          e.hp -= s.dmg; e.hitFlash = 6; e._hitBy = s;
          const a = Math.atan2(e.y - s.y, e.x - s.x);
          e.vx += Math.cos(a) * (s.nova ? 14 : 7);
          e.vy += Math.sin(a) * (s.nova ? 14 : 7);
          if (e.hp <= 0) killEnemy(e);
        }
      }
      // flatten buildings in radius
      for (const b of game.buildings) {
        if (b.dead) continue;
        const bx = b.x + b.w/2, by = b.y + b.h/2;
        if (dist2(bx, by, s.x, s.y) < s.r * s.r) {
          b.hp -= s.dmg * 0.5; b.flash = 1;
          if (b.hp <= 0) destroyBuilding(b);
        }
      }
    }
    game.shocks = game.shocks.filter(s => s.life > 0);
  }

  function updateParticles() {
    for (const pt of game.particles) {
      pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.94; pt.vy *= 0.94; pt.life--;
    }
    game.particles = game.particles.filter(p => p.life > 0);
    for (const f of game.floaters) { f.y -= 0.5; f.life--; }
    game.floaters = game.floaters.filter(f => f.life > 0);
    for (const b of game.buildings) if (b.flash > 0) b.flash -= 0.1;
  }

  // ---------- Camera / coords ----------
  function screenToWorld(sx, sy) {
    return { x: (sx - W/2) / cam.zoom + cam.x, y: (sy - H/2) / cam.zoom + cam.y };
  }

  function updateCamera() {
    const p = game.player;
    cam.x = lerp(cam.x, p.x, 0.08);
    cam.y = lerp(cam.y, p.y, 0.08);
    if (cam.shake > 0) cam.shake *= 0.88;
  }

  // ---------- Main update ----------
  function update(dt) {
    if (!game.running) return;
    game.t++;

    // wave control
    if (game.spawnQueue.length === 0 && game.enemies.length === 0 && !game.boss) {
      game.waveTimer--;
      if (game.waveTimer <= 0) { startWave(game.wave + 1); game.waveTimer = 9999; }
    } else {
      game.waveTimer = 90;
    }
    spawnFromQueue();

    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets();
    updateShocks();
    updateParticles();
    updateCamera();
    updateHUD();
  }

  // ---------- Render ----------
  function render() {
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    let sx = 0, sy = 0;
    if (cam.shake > 0.3) { sx = rand(-cam.shake, cam.shake); sy = rand(-cam.shake, cam.shake); }
    ctx.translate(W/2 + sx, H/2 + sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawGround();
    drawBuildings();
    drawShocks();
    drawParticles();
    drawEnemies();
    drawBullets();
    drawPlayer();
    drawFloaters();

    ctx.restore();

    drawMinimap();
  }

  function drawGround() {
    // arena bounds
    ctx.fillStyle = "#070b16";
    ctx.fillRect(-WORLD, -WORLD, WORLD*2, WORLD*2);
    // grid streets
    ctx.strokeStyle = "rgba(0,229,255,0.05)";
    ctx.lineWidth = 2;
    const step = 210;
    ctx.beginPath();
    for (let x = -WORLD; x <= WORLD; x += step) { ctx.moveTo(x, -WORLD); ctx.lineTo(x, WORLD); }
    for (let y = -WORLD; y <= WORLD; y += step) { ctx.moveTo(-WORLD, y); ctx.lineTo(WORLD, y); }
    ctx.stroke();
    // border
    ctx.strokeStyle = "rgba(255,59,59,0.5)";
    ctx.lineWidth = 8;
    ctx.strokeRect(-WORLD, -WORLD, WORLD*2, WORLD*2);
  }

  function drawBuildings() {
    // fake extrusion: top face offset toward camera-up-left
    for (const b of game.buildings) {
      if (b.dead) {
        // rubble footprint
        ctx.fillStyle = "rgba(40,46,64,0.5)";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        continue;
      }
      const ox = -b.height * 0.18, oy = -b.height * 0.30;
      // base / sides
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // extruded body (between base and top)
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + ox, b.y + oy);
      ctx.lineTo(b.x + b.w + ox, b.y + oy);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w + ox, b.y + oy);
      ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.closePath(); ctx.fill();
      // top face
      ctx.fillStyle = b.flash > 0 ? "#ffffff" : b.top;
      ctx.fillRect(b.x + ox, b.y + oy, b.w, b.h);
      // damage tint
      const dmgT = 1 - b.hp / b.maxhp;
      if (dmgT > 0.05) {
        ctx.fillStyle = `rgba(255,80,40,${dmgT * 0.35})`;
        ctx.fillRect(b.x + ox, b.y + oy, b.w, b.h);
      }
      // little window lights
      ctx.fillStyle = "rgba(0,229,255,0.18)";
      ctx.fillRect(b.x + ox + b.w*0.2, b.y + oy + b.h*0.2, 4, 4);
      ctx.fillRect(b.x + ox + b.w*0.6, b.y + oy + b.h*0.5, 4, 4);
    }
  }

  function drawPlayer() {
    const p = game.player;
    ctx.save();
    ctx.translate(p.x, p.y);

    // ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(8, 12, p.r * 1.05, p.r * 0.95, 0, 0, TAU); ctx.fill();

    // legs / treads animated
    ctx.save();
    ctx.rotate(p.angle);
    const legW = p.r * 0.34, legL = p.r * 1.25;
    const off = Math.sin(p.step) * p.r * 0.12;
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#1b2740";
      ctx.strokeStyle = "#0a1120"; ctx.lineWidth = 3;
      const ly = side * p.r * 0.62 + (side > 0 ? off : -off);
      roundRect(-legL/2, ly - legW/2, legL, legW, 6);
      ctx.fill(); ctx.stroke();
      // foot glow
      ctx.fillStyle = "rgba(0,229,255,0.5)";
      ctx.fillRect(legL/2 - 8, ly - legW/2, 6, legW);
    }
    ctx.restore();

    // hull (hex)
    ctx.save();
    ctx.rotate(p.angle);
    const grd = ctx.createLinearGradient(-p.r, -p.r, p.r, p.r);
    grd.addColorStop(0, "#2c3e63"); grd.addColorStop(1, "#16203a");
    ctx.fillStyle = grd;
    ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 4;
    polygon(0, 0, p.r * 0.92, 6, 0); ctx.fill(); ctx.stroke();
    // armor plate ring
    ctx.strokeStyle = "rgba(0,229,255,0.35)"; ctx.lineWidth = 3;
    polygon(0, 0, p.r * 0.66, 6, Math.PI/6); ctx.stroke();
    // shoulder pods
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#22304f";
      ctx.beginPath(); ctx.arc(p.r*0.1, s*p.r*0.7, p.r*0.22, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();

    // core (reactor) pulsing
    const pulse = 0.6 + Math.sin(game.t * 0.15) * 0.25;
    const coreCol = p.overheat ? "#ff3b3b" : "#ffd23b";
    ctx.fillStyle = coreCol;
    ctx.shadowColor = coreCol; ctx.shadowBlur = 30 * pulse;
    ctx.beginPath(); ctx.arc(0, 0, p.r * 0.26 * pulse, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // turret / plasma lance
    ctx.save();
    ctx.rotate(p.turret);
    ctx.fillStyle = "#0e1830";
    roundRect(-p.r*0.2, -p.r*0.16, p.r*0.5, p.r*0.32, 6); ctx.fill();
    ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 3; ctx.stroke();
    // barrel
    ctx.fillStyle = p.overheat ? "#ff5b5b" : "#7fe9ff";
    ctx.fillRect(p.r*0.3, -p.r*0.07, p.r*0.7, p.r*0.14);
    ctx.shadowColor = "#7fe9ff"; ctx.shadowBlur = 12;
    ctx.fillRect(p.r*0.92, -p.r*0.05, p.r*0.12, p.r*0.10);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.restore();
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.arc(2, 3, e.r, 0, TAU); ctx.fill();
      ctx.rotate(e.angle);
      const flash = e.hitFlash > 0;
      if (e.type === "tank") {
        ctx.fillStyle = flash ? "#fff" : "#5a4b2e";
        roundRect(-e.r, -e.r*0.8, e.r*2, e.r*1.6, 3); ctx.fill();
        ctx.fillStyle = "#7a6a44"; ctx.fillRect(0, -e.r*0.25, e.r*1.4, e.r*0.5);
        ctx.fillStyle = "#caa84a"; ctx.beginPath(); ctx.arc(0,0,e.r*0.5,0,TAU); ctx.fill();
      } else if (e.type === "jet") {
        ctx.fillStyle = flash ? "#fff" : "#8a2a2a";
        ctx.beginPath();
        ctx.moveTo(e.r*1.3, 0); ctx.lineTo(-e.r, -e.r); ctx.lineTo(-e.r*0.4, 0); ctx.lineTo(-e.r, e.r);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ff8c3b"; ctx.beginPath(); ctx.arc(-e.r*0.5,0,e.r*0.28,0,TAU); ctx.fill();
      } else if (e.type === "turret") {
        ctx.fillStyle = flash ? "#fff" : "#3a2a4a";
        ctx.beginPath(); ctx.arc(0,0,e.r,0,TAU); ctx.fill();
        ctx.fillStyle = "#ff3bd0"; ctx.fillRect(0,-e.r*0.2,e.r*1.5,e.r*0.4);
        ctx.beginPath(); ctx.arc(0,0,e.r*0.4,0,TAU); ctx.fill();
      } else if (e.type === "boss") {
        drawBoss(e, flash);
      }
      ctx.restore();
      // boss HP bar
      if (e.type === "boss") drawBossBar(e);
    }
  }

  function drawBoss(e, flash) {
    ctx.save();
    ctx.rotate(-e.angle); // undo body rot for stable core, redo per piece
    // outer ring spin
    ctx.rotate(e.spin);
    ctx.strokeStyle = "#ff6a3b"; ctx.lineWidth = 6;
    polygon(0, 0, e.r, 3, 0); ctx.stroke();
    ctx.rotate(-e.spin * 2);
    ctx.strokeStyle = "rgba(255,170,59,0.6)"; ctx.lineWidth = 4;
    polygon(0, 0, e.r * 0.72, 3, Math.PI); ctx.stroke();
    ctx.restore();
    // hull
    ctx.fillStyle = flash ? "#fff" : "#3a1c2e";
    polygon(0, 0, e.r * 0.6, 6, 0); ctx.fill();
    ctx.strokeStyle = "#ff3b3b"; ctx.lineWidth = 4; ctx.stroke();
    // turret
    ctx.save(); ctx.rotate(e.turret - e.angle);
    ctx.fillStyle = "#ffae3b"; ctx.fillRect(0, -e.r*0.1, e.r*0.9, e.r*0.2);
    ctx.restore();
    // core
    const pulse = 0.7 + Math.sin(game.t*0.2)*0.3;
    ctx.fillStyle = "#ff3b3b"; ctx.shadowColor="#ff3b3b"; ctx.shadowBlur=40*pulse;
    ctx.beginPath(); ctx.arc(0,0,e.r*0.3*pulse,0,TAU); ctx.fill(); ctx.shadowBlur=0;
  }

  function drawBossBar(e) {
    const w = e.r * 2.4, x = e.x - w/2, y = e.y - e.r - 28;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = "#ff3b3b"; ctx.fillRect(x, y, w * clamp(e.hp/e.maxHp,0,1), 10);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, 10);
  }

  function drawBullets() {
    for (const b of game.pBullets) {
      ctx.fillStyle = "#cdf3ff"; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    for (const b of game.eBullets) {
      ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawShocks() {
    for (const s of game.shocks) {
      const a = clamp(s.life / s.max_life, 0, 1);
      ctx.strokeStyle = s.nova ? `rgba(255,210,59,${a})` : `rgba(0,229,255,${a})`;
      ctx.lineWidth = 8 * a + 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a*0.5})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.92, 0, TAU); ctx.stroke();
    }
  }

  function drawParticles() {
    for (const pt of game.particles) {
      const a = clamp(pt.life / 50, 0, 1);
      ctx.globalAlpha = a;
      if (pt.glow) { ctx.shadowColor = pt.color; ctx.shadowBlur = 10; }
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    for (const f of game.floaters) {
      const a = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.font = `800 ${22 * f.scale}px Segoe UI, Arial`;
      ctx.textAlign = "center";
      ctx.shadowColor = f.color; ctx.shadowBlur = 14;
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  // ---------- Minimap ----------
  function drawMinimap() {
    const size = 150, pad = 16;
    const x0 = W - size - pad, y0 = H - size - pad;
    const sc = size / (WORLD * 2);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(5,8,18,0.7)";
    ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = "rgba(0,229,255,0.4)"; ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, size, size);
    const mx = v => x0 + (v + WORLD) * sc, my = v => y0 + (v + WORLD) * sc;
    // enemies
    for (const e of game.enemies) {
      ctx.fillStyle = e.type === "boss" ? "#ff3b3b" : "#ff7b5b";
      const r = e.type === "boss" ? 3 : 1.6;
      ctx.beginPath(); ctx.arc(mx(e.x), my(e.y), r, 0, TAU); ctx.fill();
    }
    // player
    const p = game.player;
    ctx.fillStyle = "#00ffa3";
    ctx.beginPath(); ctx.arc(mx(p.x), my(p.y), 3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- HUD ----------
  function updateHUD() {
    const p = game.player;
    elHp.style.width = (p.hp / p.maxHp * 100) + "%";
    elCore.style.width = p.reactor + "%";
    elHeat.style.width = p.heat + "%";
    elHeat.style.opacity = p.overheat ? 0.5 + Math.sin(game.t*0.4)*0.5 : 1;
    elTier.textContent = TIERS[p.tier].name;
    elScore.textContent = game.score.toLocaleString();
    elWave.textContent = game.boss ? "BOSS" : game.wave;
    const left = game.enemies.length + game.spawnQueue.length;
    elEnemies.textContent = left;
  }

  // ---------- Draw primitives ----------
  function polygon(cx, cy, r, sides, rot) {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = rot + (i / sides) * TAU;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- State transitions ----------
  function gameOver(win) {
    if (game.over) return;
    game.over = true; game.running = false; game.win = win;
    overTitle.textContent = win ? "APEX ACHIEVED" : "SYSTEMS OFFLINE";
    overStats.innerHTML = win
      ? `You toppled the Apex Predator and stand as the last colossus.<br/>Destruction score: <b>${game.score.toLocaleString()}</b> · Scale: <b>${TIERS[game.player.tier].name}</b>`
      : `Your reactor goes dark amid the rubble.<br/>Destruction score: <b>${game.score.toLocaleString()}</b> · Reached wave <b>${game.wave}</b> · Scale <b>${TIERS[game.player.tier].name}</b>`;
    overScreen.classList.remove("hidden");
  }
  function victory() { gameOver(true); }

  // ---------- Loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 16.67, 3);
    last = now;
    if (game && game.running) update(dt);
    if (game) render();
    requestAnimationFrame(loop);
  }

  function begin() {
    newGame();
    startScreen.classList.add("hidden");
    overScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    game.waveTimer = 60;
  }

  document.getElementById("startBtn").addEventListener("click", begin);
  document.getElementById("restartBtn").addEventListener("click", begin);
  window.addEventListener("keydown", e => {
    if (e.code === "Enter") {
      if (!startScreen.classList.contains("hidden") || !overScreen.classList.contains("hidden")) begin();
    }
  });

  requestAnimationFrame(loop);
})();
