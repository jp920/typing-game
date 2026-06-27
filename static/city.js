'use strict';
/**
 * City Defense — canvas typing game
 * window.CityDefense.start(profile, onDone)
 * window.CityDefense.stop()
 */
window.CityDefense = (() => {

  // ─── tuning ───────────────────────────────────────────────────────────────
  const CITY_FRAC   = 0.72;   // city floor starts at 72% of canvas height
  const WORD_Y      = 52;     // word display baseline (px)
  const CHAR_W      = 13;     // px per character in word display (tighter)
  const LETTER_PX   = 28;     // falling letter font size

  // word length range per level — longer words as difficulty climbs
  const WORD_RANGE = [
  //  lv  min  max
      [1,  4,   4],
      [2,  4,   5],
      [3,  4,   5],
      [4,  5,   6],
      [5,  5,   6],
      [6,  5,   7],
      [7,  6,   8],
      [8,  6,   9],
      [9,  7,  10],
      [10, 7,  12],
  ];

  // neon palette — one colour per track
  const NEON = ['#00f5ff','#ff2d78','#39ff14','#ff9f00','#c77dff','#fff200'];

  // building body colours (very dark, let neon do the talking)
  const BLDG_DARK = ['#061220','#120620','#060c1a','#0f061a','#060f12'];

  // fallback list if COMMON isn't available yet (shouldn't happen in practice)
  const FALLBACK = 'back chip drop fast grab hand jump king lamp make note open plan step'.split(' ');

  function wordPool(level) {
    const [, minL, maxL] = WORD_RANGE[Math.min(level, 10) - 1];
    const src = (typeof COMMON !== 'undefined' && COMMON.length) ? COMMON : FALLBACK;
    const filtered = src.filter(w => w.length >= minL && w.length <= maxL);
    return filtered.length >= 8 ? filtered : src.filter(w => w.length >= 3 && w.length <= maxL);
  }
  function numTracks(level, diff) {
    if (diff === 'easy') return 1;
    return level <= 3 ? 1 : level <= 6 ? 2 : 3;
  }

  // easy mode: x position for letter at `pos` in a `wordLen`-letter word
  function easyX(pos, wordLen, W) {
    const pad  = 60;
    const slots = Math.max(wordLen, 1);
    return pad + (pos + 0.5) * ((W - pad * 2) / slots);
  }
  // px / sec the letters fall
  function fallSpeed(level) {
    return 52 + level * 17;
  }
  // gap (sec) between letters of the same word
  function spawnGap(level) {
    return Math.max(0.08, 0.28 - level * 0.018);
  }

  // ─── state ────────────────────────────────────────────────────────────────
  let canvas, ctx, animId, state;

  // ─── city generation ──────────────────────────────────────────────────────
  function genCity(W, H) {
    const groundY = H * CITY_FRAC;
    const n = Math.max(8, Math.floor(W / 58));
    const totalGap = W * 0.07;
    const gap = totalGap / (n + 1);
    const bldgW = (W - totalGap) / n;
    const buildings = [];

    for (let i = 0; i < n; i++) {
      const w  = Math.round(bldgW * (0.65 + Math.random() * 0.7));
      const h  = 75 + Math.random() * 145;
      const x  = gap + i * (bldgW + gap / n);
      const col  = BLDG_DARK[i % BLDG_DARK.length];
      const neon = NEON[i % NEON.length];
      const hp   = h > 170 ? 3 : h > 115 ? 2 : 1;

      // windows grid
      const wW = 6, wH = 8, padX = 7, padY = 8, stepX = 13, stepY = 13;
      const wCols = Math.max(1, Math.floor((w - padX * 2) / stepX));
      const wRows = Math.max(1, Math.floor((h - padY * 2) / stepY));
      const windows = [];
      for (let r = 0; r < wRows; r++) {
        for (let c = 0; c < wCols; c++) {
          windows.push({
            lx: padX + c * stepX, ly: padY + r * stepY,
            w: wW, h: wH,
            lit: Math.random() < 0.6,
          });
        }
      }

      // rooftop detail (antenna, water tower, etc.)
      const roof = Math.random() < 0.5 ? 'antenna' : Math.random() < 0.5 ? 'tower' : 'flat';

      buildings.push({
        x, y: groundY - h, w, h,
        col, neon, hp, maxHp: hp,
        windows, roof,
        rubbleH: 14 + Math.random() * 12,
        destroyed: false,
        smoke: [],   // smoke particles when damaged
      });
    }
    return buildings;
  }

  // ─── star field ───────────────────────────────────────────────────────────
  function genStars(W, H) {
    const stars = [];
    const skyH = H * CITY_FRAC;
    for (let i = 0; i < 110; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * skyH,
        r: 0.4 + Math.random() * 1.4,
        a: 0.3 + Math.random() * 0.7,
        twinkle: Math.random() * Math.PI * 2,  // phase offset
      });
    }
    return stars;
  }

  // ─── track helpers ────────────────────────────────────────────────────────
  function freshTrack(pool, x) {
    return {
      word: pool[Math.floor(Math.random() * pool.length)],
      pos: 0,        // next letter index to spawn
      x,             // track centre-x (used to position word display)
      cooldown: 0.3, // initial delay before first letter
    };
  }

  function initTracks(n, W, pool) {
    const tracks = [];
    for (let i = 0; i < n; i++) {
      const t = freshTrack(pool, (W / n) * (i + 0.5));
      t.cooldown = 0.5 + i * 0.7;   // stagger first spawns
      tracks.push(t);
    }
    return tracks;
  }

  // ─── spawn a falling letter for a track ───────────────────────────────────
  function spawnLetter(track) {
    const { word, pos, x } = track;
    const char = word[pos];
    const wordPxW = word.length * CHAR_W;
    const trackIdx = state.tracks.indexOf(track);
    const neon = NEON[trackIdx % NEON.length];
    const spd = fallSpeed(state.curLevel);

    // easy: left-to-right sweep — each letter falls from a distinct column
    // hard: falls from the letter's exact position in the word display
    const startX = state.difficulty === 'hard'
      ? x - wordPxW / 2 + pos * CHAR_W + CHAR_W / 2
      : easyX(pos, word.length, canvas.width);

    state.falling.push({
      char, neon, trackIdx,
      x: startX, y: WORD_Y + 18,
      vy: spd,
      trail: [],
    });

    track.pos++;
    if (track.pos >= track.word.length) {
      // word exhausted — schedule reset
      track.pos = -1;   // sentinel: waiting for reset
      track.cooldown = 0.55 + Math.random() * 0.35;
    } else {
      track.cooldown = spawnGap(state.curLevel);
    }
  }

  // ─── main start ───────────────────────────────────────────────────────────
  function start(profile, difficulty, onDone) {
    canvas = document.getElementById('city-canvas');
    ctx    = canvas.getContext('2d');
    sizeCanvas();

    const W = canvas.width, H = canvas.height;
    const level = profile.level || 1;
    const pool  = buildWordPool(profile, level);

    state = {
      profile, onDone,
      difficulty: difficulty || 'easy',
      curLevel: level,
      pool,
      buildings: genCity(W, H),
      stars: genStars(W, H),
      tracks: initTracks(numTracks(level, difficulty), W, pool),
      falling: [],
      particles: [],
      score: 0,
      caught: 0,
      missed: 0,
      keyStats: {},
      startTime: null,
      tLast: null,
      gameOver: false,
      goTimer: 0,
      levelUpMsg: null,
      levelUpTimer: 0,
    };

    document.addEventListener('keydown', onKey, true);
    animId = requestAnimationFrame(loop);
  }

  function buildWordPool(profile, level) {
    const base = wordPool(level);
    const bv = profile.book_vocab;
    if (!bv) return base;
    const [, minL, maxL] = WORD_RANGE[Math.min(level, 10) - 1];
    const themed = [...(bv.words || []), ...(bv.names || [])]
      .map(w => w.toLowerCase())
      .filter(w => w.length >= minL && w.length <= maxL);
    if (!themed.length) return base;
    return [...base, ...themed, ...themed];
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId);
    document.removeEventListener('keydown', onKey, true);
    animId = null;
    state  = null;
  }

  function sizeCanvas() {
    const cont = canvas.parentElement;
    canvas.width  = cont.clientWidth  || window.innerWidth || 800;
    canvas.height = Math.min(860, Math.max(560, window.innerHeight - 80));
  }

  // ─── game loop ────────────────────────────────────────────────────────────
  function loop(ts) {
    if (!state) return;
    const dt = state.tLast ? Math.min((ts - state.tLast) / 1000, 0.1) : 0.016;
    state.tLast = ts;

    const W = canvas.width, H = canvas.height;
    const groundY = H * CITY_FRAC;

    if (!state.gameOver) {
      update(dt, W, H, groundY);
    } else {
      state.goTimer -= dt;
      updateParticles(dt);
    }

    draw(W, H, groundY, ts);

    if (!state.gameOver || state.goTimer > 0) {
      animId = requestAnimationFrame(loop);
    } else {
      stop();
      const elapsed = state.startTime ? (performance.now() - state.startTime) / 1000 : 0;
      const total = state.caught + state.missed;
      state.onDone({
        score:    state.score,
        caught:   state.caught,
        missed:   state.missed,
        accuracy: total ? Math.round(state.caught / total * 1000) / 10 : 100,
        level:    state.curLevel,
        seconds:  elapsed,
        keyStats: state.keyStats,
      });
    }
  }

  // ─── update ───────────────────────────────────────────────────────────────
  function update(dt, W, H, groundY) {
    const s = state;

    // ── tracks: cooldown & spawn ──
    s.tracks.forEach(track => {
      track.cooldown -= dt;
      if (track.cooldown > 0) return;

      if (track.pos === -1) {
        // reset word
        track.word = s.pool[Math.floor(Math.random() * s.pool.length)];
        track.pos  = 0;
        track.cooldown = spawnGap(s.curLevel);
      } else {
        // only spawn if this track has no falling letter right now
        const busy = s.falling.some(f => f.trackIdx === s.tracks.indexOf(track));
        if (!busy) spawnLetter(track);
      }
    });

    // ── falling letters ──
    for (let i = s.falling.length - 1; i >= 0; i--) {
      const f = s.falling[i];

      // trail
      f.trail.push({ x: f.x, y: f.y, t: 0 });
      if (f.trail.length > 7) f.trail.shift();
      f.trail.forEach(p => p.t += dt);

      f.y += f.vy * dt;

      if (f.y >= groundY) {
        // hit the city
        impactCity(f.x, W, groundY);
        s.missed++;
        trackKeyMiss(f.char);
        s.falling.splice(i, 1);
        checkGameOver();
      }
    }

    // ── level up every 40 catches ──
    if (s.caught > 0 && s.caught % 40 === 0 && s.curLevel < 10) {
      s.curLevel++;
      s.pool = buildWordPool(s.profile, s.curLevel);
      const need = numTracks(s.curLevel, s.difficulty);
      while (s.tracks.length < need) {
        const n = s.tracks.length;
        s.tracks.forEach((t, i) => { t.x = (W / need) * (i + 0.5); });
        s.tracks.push(freshTrack(s.pool, (W / need) * (n + 0.5)));
      }
      s.levelUpMsg   = `LEVEL ${s.curLevel}!`;
      s.levelUpTimer = 2.2;
    }
    if (s.levelUpTimer > 0) s.levelUpTimer -= dt;

    // ── smoke on damaged buildings ──
    s.buildings.forEach(b => {
      if (b.destroyed || b.hp === b.maxHp) return;
      if (Math.random() < dt * 6) {
        b.smoke.push({
          x: b.x + b.w * 0.3 + Math.random() * b.w * 0.4,
          y: b.y,
          vx: (Math.random() - 0.5) * 14,
          vy: -22 - Math.random() * 18,
          life: 1.4 + Math.random() * 0.8,
          maxLife: 2.2,
          r: 4 + Math.random() * 6,
        });
      }
      for (let i = b.smoke.length - 1; i >= 0; i--) {
        const p = b.smoke[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 4 * dt;
        p.life -= dt;
        if (p.life <= 0) b.smoke.splice(i, 1);
      }
    });

    updateParticles(dt);
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  // ─── city damage ─────────────────────────────────────────────────────────
  function impactCity(x, W, groundY) {
    const alive = state.buildings.filter(b => !b.destroyed);
    if (!alive.length) return;

    // nearest building centre
    let target = alive[0];
    alive.forEach(b => {
      if (Math.abs(b.x + b.w / 2 - x) < Math.abs(target.x + target.w / 2 - x)) target = b;
    });

    target.hp--;
    shakeCanvas(4);

    // spark burst at impact
    const bx = target.x + target.w / 2;
    const by = target.y + 8;
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 130;
      state.particles.push({
        x: bx, y: by,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 90,
        color: [target.neon, '#ff9f00', '#ffffff'][Math.floor(Math.random() * 3)],
        life: 0.55 + Math.random() * 0.4,
        r: 2 + Math.random() * 3.5,
      });
    }

    if (target.hp <= 0) {
      target.destroyed = true;
      // larger collapse burst
      for (let i = 0; i < 45; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 90 + Math.random() * 200;
        state.particles.push({
          x: bx, y: target.y + target.h / 2,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 130,
          color: [target.neon, '#ff4757', '#ff9f00', '#fff'][Math.floor(Math.random() * 4)],
          life: 0.9 + Math.random() * 0.7,
          r: 3 + Math.random() * 6,
        });
      }
    }

    try { window.sfx?.err(); } catch (_) {}
  }

  function checkGameOver() {
    if (state.buildings.every(b => b.destroyed)) {
      state.gameOver = true;
      state.goTimer  = 2.6;
    }
  }

  // canvas shake
  let shakeAmt = 0;
  function shakeCanvas(px) { shakeAmt = Math.max(shakeAmt, px); }

  // ─── input ────────────────────────────────────────────────────────────────
  function onKey(e) {
    if (!state || state.gameOver) return;
    if (e.key.length !== 1) return;
    e.preventDefault();

    if (!state.startTime) state.startTime = performance.now();

    const ch = e.key.toLowerCase();

    // find lowest-falling matching letter (most urgent)
    let best = null;
    state.falling.forEach(f => {
      if (f.char === ch && (!best || f.y > best.y)) best = f;
    });

    if (best) {
      destroyLetter(best);
    }
    // wrong key: no penalty (city defense ignores stray keys)
  }

  function destroyLetter(f) {
    const H = canvas.height;
    const groundY = H * CITY_FRAC;
    // bonus for catching high up
    const ratio = Math.max(0, (groundY - f.y) / groundY);
    const pts = 10 + Math.round(ratio * 12);
    state.score += pts;
    state.caught++;
    trackKeyHit(f.char);

    // sparkle at catch point
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 55 + Math.random() * 90;
      state.particles.push({
        x: f.x, y: f.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 50,
        color: f.neon,
        life: 0.45 + Math.random() * 0.3,
        r: 2 + Math.random() * 3,
      });
    }

    // floating +pts text
    state.particles.push({
      x: f.x, y: f.y - 8,
      vx: 0, vy: -38,
      color: '#fff', life: 0.85, r: 0,
      label: '+' + pts,
    });

    state.falling.splice(state.falling.indexOf(f), 1);
    try { window.sfx?.tick(); } catch (_) {}
  }

  function trackKeyHit(ch) {
    const s = state.keyStats;
    s[ch] = s[ch] || { ok: 0, err: 0 };
    s[ch].ok++;
  }
  function trackKeyMiss(ch) {
    const s = state.keyStats;
    s[ch] = s[ch] || { ok: 0, err: 0 };
    s[ch].err++;
  }

  // ─── draw ─────────────────────────────────────────────────────────────────
  function draw(W, H, groundY, ts) {
    const shake = Math.round(shakeAmt * (Math.random() - 0.5));
    shakeAmt *= 0.72;
    if (shakeAmt < 0.3) shakeAmt = 0;

    ctx.save();
    if (shake) ctx.translate(shake, shake);

    // sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0,   '#04060f');
    skyGrad.addColorStop(0.7, '#070d20');
    skyGrad.addColorStop(1,   '#0d1535');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, groundY);

    // ground
    ctx.fillStyle = '#050708';
    ctx.fillRect(0, groundY, W, H - groundY);

    // stars (twinkle via time)
    const time = ts / 1000;
    state.stars.forEach(s => {
      const a = s.a * (0.7 + 0.3 * Math.sin(time * 1.1 + s.twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${a.toFixed(2)})`;
      ctx.fill();
    });

    // horizon atmospheric glow
    const hGlow = ctx.createLinearGradient(0, groundY - 60, 0, groundY);
    hGlow.addColorStop(0, 'rgba(30,20,80,0)');
    hGlow.addColorStop(1, 'rgba(60,30,120,0.35)');
    ctx.fillStyle = hGlow;
    ctx.fillRect(0, groundY - 60, W, 60);

    // city buildings
    drawBuildings(groundY);

    // falling-letter trails & letters
    state.falling.forEach(f => {
      // trail
      f.trail.forEach((p, i) => {
        const alpha = Math.max(0, (0.35 - p.t * 0.8) * (i / f.trail.length));
        if (alpha <= 0.01) return;
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = f.neon;
        ctx.font = `bold ${LETTER_PX}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(f.char, p.x, p.y);
      });
      ctx.globalAlpha = 1;

      // letter glow
      ctx.shadowColor = f.neon;
      ctx.shadowBlur  = 22;
      ctx.fillStyle   = '#ffffff';
      ctx.font = `bold ${LETTER_PX}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(f.char, f.x, f.y);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    // particles
    state.particles.forEach(p => {
      if (p.label) {
        ctx.globalAlpha = Math.min(1, p.life * 1.5);
        ctx.fillStyle   = p.color;
        ctx.font        = 'bold 14px monospace';
        ctx.textAlign   = 'center';
        ctx.fillText(p.label, p.x, p.y);
        ctx.globalAlpha = 1;
        return;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle   = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.8));
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // word display strip
    drawWordStrip(W);

    // HUD overlay
    drawHUD(W, H, groundY);

    // level-up flash
    if (state.levelUpTimer > 0) {
      const alpha = Math.min(1, state.levelUpTimer);
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = '#ffd700';
      ctx.font        = `bold ${Math.round(W * 0.07)}px system-ui`;
      ctx.textAlign   = 'center';
      ctx.shadowColor = '#ff9f00';
      ctx.shadowBlur  = 30;
      ctx.fillText(state.levelUpMsg, W / 2, H / 2);
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }

    // game over overlay
    if (state.gameOver) {
      const pct = 1 - Math.max(0, state.goTimer - 1.6) / 1;
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.75, pct * 0.75)})`;
      ctx.fillRect(0, 0, W, H);
      if (state.goTimer < 2.0) {
        ctx.fillStyle   = '#ff4757';
        ctx.font        = `bold ${Math.round(W * 0.075)}px system-ui`;
        ctx.textAlign   = 'center';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur  = 28;
        ctx.fillText('CITY DESTROYED', W / 2, H * 0.42);
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = '#ffffff';
        ctx.font        = `bold ${Math.round(W * 0.045)}px system-ui`;
        ctx.fillText(`Score: ${state.score}`, W / 2, H * 0.57);
        ctx.fillStyle   = 'rgba(255,255,255,0.6)';
        ctx.font        = `${Math.round(W * 0.03)}px system-ui`;
        const total = state.caught + state.missed;
        const acc = total ? Math.round(state.caught / total * 100) : 100;
        ctx.fillText(`${state.caught} saved · ${acc}% accuracy`, W / 2, H * 0.65);
      }
    }

    ctx.restore();
  }

  function drawBuildings(groundY) {
    state.buildings.forEach(b => {
      if (b.destroyed) {
        // rubble pile
        ctx.fillStyle = '#1c1c1e';
        ctx.beginPath();
        ctx.moveTo(b.x, groundY);
        ctx.lineTo(b.x + b.w * 0.15, groundY - b.rubbleH * 1.1);
        ctx.lineTo(b.x + b.w * 0.5,  groundY - b.rubbleH);
        ctx.lineTo(b.x + b.w * 0.8,  groundY - b.rubbleH * 0.8);
        ctx.lineTo(b.x + b.w, groundY);
        ctx.closePath();
        ctx.fill();
        return;
      }

      const dmg = 1 - b.hp / b.maxHp;

      // body
      ctx.fillStyle = b.col;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // neon edge glow
      ctx.save();
      ctx.shadowColor = b.neon;
      ctx.shadowBlur  = 6 + dmg * 10;
      ctx.strokeStyle = b.neon;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(b.x + 0.75, b.y + 0.75, b.w - 1.5, b.h - 1.5);
      ctx.restore();

      // windows
      b.windows.forEach(w => {
        if (!w.lit) return;
        // damaged buildings have flickering/dark windows
        if (dmg > 0 && Math.random() < dmg * 0.4) return;
        ctx.save();
        ctx.shadowColor = b.neon;
        ctx.shadowBlur  = 7;
        ctx.fillStyle   = b.neon;
        ctx.globalAlpha = 0.65 + Math.random() * 0.15;
        ctx.fillRect(b.x + w.lx, b.y + w.ly, w.w, w.h);
        ctx.restore();
      });

      // rooftop
      if (b.roof === 'antenna') {
        ctx.save();
        ctx.strokeStyle = b.neon;
        ctx.lineWidth   = 2;
        ctx.shadowColor = b.neon;
        ctx.shadowBlur  = 6;
        const ax = b.x + b.w / 2;
        ctx.beginPath();
        ctx.moveTo(ax, b.y);
        ctx.lineTo(ax, b.y - 18);
        ctx.stroke();
        // blink dot
        if (Math.floor(Date.now() / 600) % 2) {
          ctx.beginPath();
          ctx.arc(ax, b.y - 20, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ff4757';
          ctx.fill();
        }
        ctx.restore();
      } else if (b.roof === 'tower') {
        ctx.save();
        ctx.fillStyle   = b.col;
        ctx.strokeStyle = b.neon;
        ctx.lineWidth   = 1;
        ctx.fillRect(b.x + b.w * 0.3, b.y - 14, b.w * 0.4, 14);
        ctx.strokeRect(b.x + b.w * 0.3, b.y - 14, b.w * 0.4, 14);
        ctx.restore();
      }

      // damage cracks
      if (dmg > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,120,50,0.55)';
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.25, b.y + 4);
        ctx.lineTo(b.x + b.w * 0.45, b.y + b.h * 0.28);
        ctx.lineTo(b.x + b.w * 0.18, b.y + b.h * 0.55);
        ctx.stroke();
        if (dmg >= 0.5) {
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.72, b.y + 10);
          ctx.lineTo(b.x + b.w * 0.52, b.y + b.h * 0.42);
          ctx.stroke();
        }
        ctx.restore();
      }

      // smoke from damaged buildings
      b.smoke.forEach(p => {
        const a = Math.max(0, (p.life / p.maxLife) * 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(130,130,140,${a.toFixed(2)})`;
        ctx.fill();
      });
    });
  }

  function drawWordStrip(W) {
    // dark strip behind the word display
    ctx.fillStyle = 'rgba(4,6,20,0.72)';
    ctx.fillRect(0, 0, W, WORD_Y + 6);

    // separator line with neon gleam
    ctx.strokeStyle = 'rgba(100,80,200,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, WORD_Y + 6);
    ctx.lineTo(W, WORD_Y + 6);
    ctx.stroke();

    state.tracks.forEach((track, ti) => {
      if (track.pos === -1) return;   // mid-reset, skip
      const { word, pos, x } = track;
      const wordPxW = word.length * CHAR_W;
      const startX  = x - wordPxW / 2;
      const neon    = NEON[ti % NEON.length];
      const isEasy  = state.difficulty === 'easy';

      word.split('').forEach((ch, ci) => {
        // easy: show letter at its drop column; hard: packed word at track centre
        const cx = isEasy ? easyX(ci, word.length, W) : startX + ci * CHAR_W + CHAR_W / 2;
        const cy = WORD_Y;

        if (ci < pos) {
          // already spawned
          ctx.globalAlpha = 0.28;
          ctx.fillStyle   = neon;
          ctx.shadowBlur  = 0;
        } else if (ci === pos) {
          // current — bright + glow
          ctx.globalAlpha = 1;
          ctx.fillStyle   = '#ffffff';
          ctx.shadowColor = neon;
          ctx.shadowBlur  = 14;
        } else {
          // upcoming
          ctx.globalAlpha = 0.72;
          ctx.fillStyle   = neon;
          ctx.shadowBlur  = 0;
        }

        ctx.font      = `bold 18px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(ch, cx, cy);
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
      });
    });
    ctx.globalAlpha = 1;
  }

  function drawHUD(W, H, groundY) {
    // score — top right
    ctx.fillStyle   = 'rgba(255,255,255,0.85)';
    ctx.font        = 'bold 16px system-ui';
    ctx.textAlign   = 'right';
    ctx.fillText(`${state.score} pts`, W - 10, 20);

    // level + difficulty — top left
    ctx.textAlign   = 'left';
    const diffLabel = state.difficulty === 'hard' ? '💀 Hard' : '🏙️ Easy';
    ctx.fillText(`Lv ${state.curLevel}  ${diffLabel}`, 10, 20);

    // city health bar — bottom centre
    const alive  = state.buildings.filter(b => !b.destroyed).length;
    const total  = state.buildings.length;
    const barW   = Math.min(W * 0.38, 220);
    const barH   = 7;
    const barX   = (W - barW) / 2;
    const barY   = H - 16;
    const fill   = (alive / total) * barW;
    const hpCol  = alive > total * 0.6 ? '#22c55e'
                 : alive > total * 0.3 ? '#f59e0b' : '#ef4444';

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    if (fill > 0) {
      ctx.fillStyle = hpCol;
      ctx.shadowColor = hpCol;
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fill, barH, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle   = 'rgba(255,255,255,0.55)';
    ctx.font        = '10px system-ui';
    ctx.textAlign   = 'center';
    ctx.fillText('CITY', W / 2, barY - 2);
  }

  return { start, stop };
})();
