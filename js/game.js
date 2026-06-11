// ゲーム本体: 状態管理(TITLE/PLAYING/CLEAR/OVER/WIN)・ループ・衝突・HUD

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Input.init();
    this.state = 'TITLE';
    this.lives = CONFIG.START_LIVES;
    this.score = 0;
    this.stageIndex = 0;
    this.timer = 0;
    this.frame = 0;
    // デバッグ: index.html?stage=5 でそのステージから開始
    const m = location.search.match(/stage=([1-9])/);
    this.startStage = m ? parseInt(m[1], 10) - 1 : 0;
  }

  start() {
    const loop = () => {
      Input.poll();
      this.frame++;
      this.update();
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  newGame() {
    this.lives = CONFIG.START_LIVES;
    this.score = 0;
    this.loadStage(this.startStage);
    this.state = 'PLAYING';
  }

  loadStage(i) {
    this.stageIndex = i;
    this.level = new Level(LEVELS[i]);
    const s = this.level.spawns;
    this.player = new Player(s.player.x, s.player.y);
    this.enemies = s.enemies.map((e) =>
      e.type === 'e' ? new Walker(e.x, e.y) :
      e.type === 'f' ? new Speedy(e.x, e.y) :
      new Hopper(e.x, e.y));
    this.items = s.items.map((it) => new Mushroom(it.x, it.y));
    this.platforms = s.platforms.map((p) => new MovingPlatform(p.x, p.y, p.axis));
    this.flag = s.flag ? new Flag(s.flag.x, s.flag.y) : null;
    this.boss = s.boss ? new Boss(s.boss.x, s.boss.y) : null;
    this.projectiles = [];
    this.camera = new Camera(this.level);
    this.camera.follow(this.player);
    Particles.clear();
  }

  update() {
    switch (this.state) {
      case 'TITLE':
        if (Input.jumpPressed) this.newGame();
        break;
      case 'PLAYING':
        this.updatePlaying();
        break;
      case 'CLEAR':
        if (--this.timer <= 0) {
          if (this.stageIndex + 1 < LEVELS.length) {
            this.loadStage(this.stageIndex + 1);
            this.state = 'PLAYING';
          } else {
            this.state = 'WIN';
          }
        }
        break;
      case 'OVER':
      case 'WIN':
        if (Input.jumpPressed) this.state = 'TITLE';
        break;
    }
  }

  updatePlaying() {
    // デバッグ: 数字キー1〜9でステージ移動
    for (let d = 1; d <= 9; d++) {
      if (Input.pressed.has('Digit' + d)) {
        this.loadStage(d - 1);
        return;
      }
    }

    const pl = this.player;

    if (pl.dead) {
      pl.update(this.level, this.platforms);
      if (pl.deathTimer > 90) this.onPlayerDeath();
      return;
    }

    this.platforms.forEach((p) => p.update());
    pl.update(this.level, this.platforms);
    if (pl.y > this.level.heightPx + 48) pl.die(); // 穴に落ちた

    const cam = this.camera;
    for (const e of this.enemies) {
      // 画面の少し外に入ってから動き出す
      if (!e.active) {
        if (e.x < cam.x + CONFIG.WIDTH + 64 && e.x + e.w > cam.x - 64) e.active = true;
        else continue;
      }
      e.update(this.level, pl);
    }
    this.enemies = this.enemies.filter((e) => !e.remove);

    this.items.forEach((it) => it.update(this.level));
    this.items = this.items.filter((it) => !it.dead);

    if (this.boss) {
      this.boss.update(this.level, pl, this.projectiles);
      if (this.boss.dead && this.boss.deadTimer > 100) {
        this.stageClear();
        return;
      }
    }
    this.projectiles.forEach((p) => p.update(this.level));
    this.projectiles = this.projectiles.filter((p) => !p.remove);

    Particles.update();

    // --- 衝突判定 ---
    for (const e of this.enemies) {
      if (e.dead || !e.active || pl.dead) continue;
      if (overlaps(pl, e)) {
        // 落下中に上から当たったら踏みつけ
        if (pl.vy > 0 && pl.y + pl.h - pl.vy <= e.y + e.h * 0.6) {
          e.stomp();
          pl.stompBounce();
          this.score += 100;
          Particles.sparkle(e.x + e.w / 2, e.y + e.h / 2);
        } else {
          pl.hurt();
        }
      }
    }

    if (this.boss && !this.boss.dead && overlaps(pl, this.boss)) {
      if (pl.vy > 0 && pl.y + pl.h - pl.vy <= this.boss.y + this.boss.h * 0.5) {
        if (this.boss.hit()) {
          this.score += 500;
          Particles.sparkle(this.boss.x + this.boss.w / 2, this.boss.y + 20, '255,90,90', 16);
        }
        pl.stompBounce();
      } else {
        pl.hurt();
      }
    }

    for (const p of this.projectiles) {
      if (overlaps(pl, p)) {
        pl.hurt();
        p.remove = true;
      }
    }

    for (const it of this.items) {
      if (overlaps(pl, it)) {
        it.dead = true;
        this.score += 200;
        pl.grow();
        Particles.sparkle(it.x + it.w / 2, it.y + it.h / 2, '120,230,120', 14);
      }
    }

    if (this.flag && overlaps(pl, this.flag)) {
      this.stageClear();
      return;
    }

    this.camera.follow(pl);
  }

  onPlayerDeath() {
    this.lives--;
    if (this.lives <= 0) this.state = 'OVER';
    else this.loadStage(this.stageIndex);
  }

  stageClear() {
    this.score += 1000;
    this.state = 'CLEAR';
    this.timer = 120;
  }

  // --- 描画 ---

  draw() {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    sky.addColorStop(0, '#5c94fc');
    sky.addColorStop(1, '#a8d8ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    if (this.state === 'TITLE') {
      this.drawTitle(ctx);
      return;
    }

    const cam = this.camera;
    this.drawBackground(ctx, cam);
    this.level.draw(ctx, cam);
    if (this.flag) this.flag.draw(ctx, cam, this.frame);
    this.platforms.forEach((p) => p.draw(ctx, cam));
    this.items.forEach((it) => it.draw(ctx, cam));
    this.enemies.forEach((e) => e.draw(ctx, cam));
    if (this.boss) this.boss.draw(ctx, cam, this.frame);
    this.projectiles.forEach((p) => p.draw(ctx, cam, this.frame));
    this.player.draw(ctx, cam, this.frame);
    Particles.draw(ctx, cam);
    this.drawHUD(ctx);

    if (this.state === 'CLEAR') {
      this.overlay(ctx, [[`STAGE ${this.stageIndex + 1} CLEAR!`, 'bold 44px monospace', '#ffe27a', 250]]);
    } else if (this.state === 'OVER') {
      this.overlay(ctx, [
        ['GAME OVER', 'bold 52px monospace', '#ff6b6b', 220],
        [`SCORE ${this.score}`, 'bold 22px monospace', '#fff', 270],
        ['PRESS SPACE', 'bold 20px monospace', '#ffe27a', 330],
      ]);
    } else if (this.state === 'WIN') {
      this.overlay(ctx, [
        ['CONGRATULATIONS!', 'bold 48px monospace', '#ffe27a', 190],
        ['魔王をたおして 全9ステージクリア!', 'bold 24px sans-serif', '#fff', 245],
        [`SCORE ${this.score}`, 'bold 22px monospace', '#fff', 295],
        ['PRESS SPACE', 'bold 20px monospace', '#ffe27a', 355],
      ]);
    }
  }

  drawBackground(ctx, cam) {
    const mod = (v, m) => ((v % m) + m) % m;
    const H = CONFIG.HEIGHT, W = CONFIG.WIDTH;

    // 太陽(ふんわり光彩)
    const sunX = 800, sunY = 90;
    const sun = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 90);
    sun.addColorStop(0, 'rgba(255,245,200,0.9)');
    sun.addColorStop(1, 'rgba(255,245,200,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
    fillCircle(ctx, sunX, sunY, 34, '#fff4c4');

    // 丘(奥=薄/手前=濃の2層、パララックス)
    const drawHills = (par, baseY, amp, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const off = cam.x * par;
      for (let sx = -100; sx <= W + 100; sx += 20) {
        const wx = sx + off;
        const y = baseY - Math.sin(wx * 0.004) * amp - Math.sin(wx * 0.013) * amp * 0.4;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };
    drawHills(-0.15, H - 90, 40, '#9fd98a');
    drawHills(-0.28, H - 55, 55, '#7ec96a');

    // 雲(丸を重ねたふわふわ、パララックス)
    for (let i = 0; i < 6; i++) {
      const cx = mod(i * 277 + 80 - cam.x * 0.5, W + 240) - 120;
      const cy = 50 + (i % 3) * 38;
      const s = 0.85 + (i % 3) * 0.25;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(cx, cy, 17 * s, 0, Math.PI * 2);
      ctx.arc(cx + 20 * s, cy - 9 * s, 14 * s, 0, Math.PI * 2);
      ctx.arc(cx + 40 * s, cy, 17 * s, 0, Math.PI * 2);
      ctx.arc(cx + 20 * s, cy + 6 * s, 15 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHUD(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, 30);
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText(`STAGE ${this.stageIndex + 1}/9`, 14, 21);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('♥'.repeat(Math.max(0, this.lives)), 150, 21);
    if (this.player.big) {
      ctx.fillStyle = '#ffe27a';
      ctx.fillText('POWER UP!', 240, 21);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE ${String(this.score).padStart(6, '0')}`, CONFIG.WIDTH - 14, 21);
  }

  overlay(ctx, lines) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.textAlign = 'center';
    for (const [text, font, color, y] of lines) {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(text, CONFIG.WIDTH / 2, y);
    }
  }

  drawTitle(ctx) {
    // 飾りの地面と雲
    ctx.fillStyle = '#9c5230';
    ctx.fillRect(0, CONFIG.HEIGHT - 64, CONFIG.WIDTH, 64);
    ctx.fillStyle = '#3eb24a';
    ctx.fillRect(0, CONFIG.HEIGHT - 64, CONFIG.WIDTH, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 4; i++) {
      const cx = 120 + i * 240, cy = 52 + (i % 2) * 30;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.arc(cx + 18, cy - 8, 14, 0, Math.PI * 2);
      ctx.arc(cx + 36, cy, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillText('スーパージャンプクエスト', CONFIG.WIDTH / 2 + 3, 153);
    ctx.fillStyle = '#fff';
    ctx.fillText('スーパージャンプクエスト', CONFIG.WIDTH / 2, 150);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#ffe27a';
    ctx.fillText('- SUPER JUMP QUEST -', CONFIG.WIDTH / 2, 185);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('←→ / A D で移動 スペース / ↑ / W でジャンプ', CONFIG.WIDTH / 2, 255);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#d8e8ff';
    ctx.fillText('敵は上から踏んでたおせる! キノコでパワーアップ!', CONFIG.WIDTH / 2, 288);
    ctx.fillText('全9ステージのさいごに待つ魔王をたおせ!', CONFIG.WIDTH / 2, 318);

    // 主人公のイラスト(地面の上でぴょこぴょこ)
    const hop = Math.abs(Math.sin(this.frame * 0.06)) * 10;
    const hw = 20, hh = 56, sc = 2;
    const hx = CONFIG.WIDTH / 2 - (hw * sc) / 2;
    const hy = CONFIG.HEIGHT - 64 - hh * sc - hop;
    softShadow(ctx, CONFIG.WIDTH / 2, CONFIG.HEIGHT - 66, 30, 7);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(sc, sc);
    drawHeroBody(ctx, hw, hh, true, 1, this.frame * 0.2, true, hop < 2, this.frame % 200 < 10);
    ctx.restore();

    if (this.frame % 60 < 36) {
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#ffe27a';
      ctx.fillText('PRESS SPACE', CONFIG.WIDTH / 2, 392);
    }
  }
}

const game = new Game();
game.start();
