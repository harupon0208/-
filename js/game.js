// ゲーム本体: 状態管理(TITLE/SELECT/PLAYING/CLEAR/WIN)・ループ・衝突・HUD

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Input.init();
    this.state = 'TITLE';
    this.score = 0;
    this.stageIndex = 0;
    this.timer = 0;
    this.frame = 0;
    // ステージ選択の進行状態
    this.unlocked = 1;          // 解放済み面数
    this.cleared = new Set();   // クリア済み面のindex
    this.selectIndex = 0;       // 選択カーソル
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
    this.score = 0;
    this.cleared = new Set();
    if (this.startStage > 0) {
      // デバッグ: 全面解放してそのまま該当面を開始
      this.unlocked = LEVELS.length;
      this.selectIndex = this.startStage;
      this.loadStage(this.startStage);
      this.state = 'PLAYING';
    } else {
      this.unlocked = 1;
      this.selectIndex = 0;
      this.state = 'SELECT';
    }
  }

  // ワールドマップ上の各ステージノードの座標
  mapNodes() {
    const nodes = [];
    for (let i = 0; i < LEVELS.length; i++) {
      nodes.push({
        x: 90 + i * 95,
        y: 250 + Math.sin(i * 0.9) * 70,
      });
    }
    return nodes;
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
      case 'SELECT':
        this.updateSelect();
        break;
      case 'PLAYING':
        this.updatePlaying();
        break;
      case 'CLEAR':
        if (--this.timer <= 0) {
          if (this.cleared.has(LEVELS.length - 1)) {
            this.state = 'WIN'; // 最終面(ボス)クリア
          } else {
            this.selectIndex = Math.min(this.unlocked - 1, this.stageIndex + 1);
            this.state = 'SELECT';
          }
        }
        break;
      case 'WIN':
        if (Input.jumpPressed) this.state = 'TITLE';
        break;
    }
  }

  updateSelect() {
    if (Input.pressed.has('ArrowLeft') || Input.pressed.has('KeyA')) {
      this.selectIndex = Math.max(0, this.selectIndex - 1);
    }
    if (Input.pressed.has('ArrowRight') || Input.pressed.has('KeyD')) {
      this.selectIndex = Math.min(this.unlocked - 1, this.selectIndex + 1);
    }
    if (Input.jumpPressed) {
      this.loadStage(this.selectIndex);
      this.state = 'PLAYING';
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
      if (pl.deathTimer > 90) {
        // 死亡後はステージ選択画面へ(残機減やゲームオーバーはなし)
        this.selectIndex = this.stageIndex;
        this.state = 'SELECT';
      }
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

  stageClear() {
    this.score += 1000;
    this.cleared.add(this.stageIndex);
    // 次の面を解放
    this.unlocked = Math.max(this.unlocked, Math.min(LEVELS.length, this.stageIndex + 2));
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
    if (this.state === 'SELECT') {
      this.drawSelect(ctx);
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
    if (this.player.big) {
      ctx.fillStyle = '#ffe27a';
      ctx.fillText('POWER UP!', 150, 21);
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

  drawSelect(ctx) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;

    // 草原のワールドマップ背景
    const grass = ctx.createLinearGradient(0, 60, 0, H);
    grass.addColorStop(0, '#7ec96a');
    grass.addColorStop(1, '#5bb152');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 60, W, H - 60);
    // 薄い草パッチ
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 7; i++) {
      const px = (i * 173 + 60) % W;
      const py = 110 + (i % 3) * 90;
      ctx.beginPath();
      ctx.ellipse(px, py, 70, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 雲
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 3; i++) {
      const cx = 130 + i * 330, cy = 90 + (i % 2) * 24;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.arc(cx + 22, cy - 9, 15, 0, Math.PI * 2);
      ctx.arc(cx + 44, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    const nodes = this.mapNodes();

    // ノードをつなぐ小道(破線)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 5;
    ctx.setLineDash([2, 10]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 各ステージノード
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const locked = i >= this.unlocked;
      const done = this.cleared.has(i);
      const isBoss = i === LEVELS.length - 1;

      softShadow(ctx, n.x, n.y + 22, 22, 6);

      let color;
      if (locked) color = '#9aa0a6';
      else if (done) color = '#36b24a';
      else color = isBoss ? '#b5463f' : '#f2b134';
      fillCircle(ctx, n.x, n.y, 22, color);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      // 上面のツヤ
      fillCircle(ctx, n.x - 6, n.y - 7, 6, 'rgba(255,255,255,0.35)');

      ctx.textAlign = 'center';
      if (locked) {
        // 鍵マーク
        ctx.fillStyle = '#555';
        roundRect(ctx, n.x - 7, n.y - 1, 14, 12, 3);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(n.x, n.y - 1, 5, Math.PI, 0);
        ctx.stroke();
      } else if (isBoss) {
        // ドクロ(ボス面)
        fillCircle(ctx, n.x, n.y - 2, 9, '#fff');
        ctx.fillStyle = '#fff';
        ctx.fillRect(n.x - 6, n.y + 4, 12, 5);
        ctx.fillStyle = '#b5463f';
        fillCircle(ctx, n.x - 4, n.y - 2, 2.4, '#b5463f');
        fillCircle(ctx, n.x + 4, n.y - 2, 2.4, '#b5463f');
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(String(i + 1), n.x, n.y + 8);
      }
      // クリア済みの旗
      if (done && !isBoss) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(n.x + 14, n.y - 22); ctx.lineTo(n.x + 14, n.y - 8);
        ctx.stroke();
        ctx.fillStyle = '#e6362a';
        ctx.beginPath();
        ctx.moveTo(n.x + 14, n.y - 22); ctx.lineTo(n.x + 24, n.y - 19); ctx.lineTo(n.x + 14, n.y - 16);
        ctx.fill();
      }
    }

    // 選択カーソル(リング + ヒーロー)
    const sel = nodes[this.selectIndex];
    const pulse = 22 + Math.sin(this.frame * 0.15) * 3;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sel.x, sel.y, pulse + 6, 0, Math.PI * 2);
    ctx.stroke();
    const hop = Math.abs(Math.sin(this.frame * 0.12)) * 8;
    const hw = 20, hh = 56, sc = 0.9;
    softShadow(ctx, sel.x, sel.y - 24, 16, 4);
    ctx.save();
    ctx.translate(sel.x - (hw * sc) / 2, sel.y - 30 - hh * sc - hop);
    ctx.scale(sc, sc);
    drawHeroBody(ctx, hw, hh, false, 1, this.frame * 0.2, true, hop < 2, this.frame % 200 < 10);
    ctx.restore();

    // タイトル帯
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, 60);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('ステージをえらぼう', W / 2, 40);

    // 下部: 選択中の面名 + 操作ヒント
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, H - 56, W, 56);
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(LEVELS[this.selectIndex].name, W / 2, H - 30);
    ctx.fillStyle = '#d8e8ff';
    ctx.font = '15px sans-serif';
    ctx.fillText('←→ でえらぶ / スペースで けってい', W / 2, H - 10);
  }
}

const game = new Game();
game.start();
