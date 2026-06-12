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
    // 演出
    this.theme = THEMES[0];
    this.shake = 0;             // 画面シェイクの強さ(減衰)
    this.flash = null;          // {color, alpha} 全画面フラッシュ
    this.hitStop = 0;           // ヒットストップ残りフレーム
    this.transition = 0;        // 画面遷移フェード(0→1で暗くなる)
    this.displayScore = 0;      // HUD表示用の補間スコア
    this.readyTimer = 0;        // READY→GO! 用
    this.paused = false;        // ポーズ中か
    this.pauseIndex = 0;        // ポーズメニューのカーソル
    this.best = 0;              // ベストスコア
    this.loadSave();            // 保存された進行状況を読み込む
    // デバッグ: index.html?stage=5 でそのステージから開始
    const m = location.search.match(/stage=([1-9])/);
    this.startStage = m ? parseInt(m[1], 10) - 1 : 0;
  }

  addShake(n) { this.shake = Math.min(16, Math.max(this.shake, n)); }
  doFlash(color, alpha) { this.flash = { color, alpha }; }

  // 進行状況の保存・読み込み(localStorage)
  loadSave() {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('sjq_save');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.unlocked === 'number') this.unlocked = Math.max(1, Math.min(LEVELS.length, d.unlocked));
      if (Array.isArray(d.cleared)) this.cleared = new Set(d.cleared);
      if (typeof d.best === 'number') this.best = d.best;
    } catch (e) { /* 壊れていたら無視 */ }
  }

  save() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('sjq_save', JSON.stringify({
        unlocked: this.unlocked, cleared: [...this.cleared], best: this.best,
      }));
    } catch (e) { /* プライベートモード等では無視 */ }
  }

  // ベストスコア更新 + 保存(進行状況が変わったときに呼ぶ)
  updateBest() {
    if (this.score > this.best) this.best = this.score;
    this.save();
  }

  // 解放済みのうち最初の未クリア面(続きから遊ぶときのカーソル位置)
  firstUncleared() {
    for (let i = 0; i < this.unlocked; i++) if (!this.cleared.has(i)) return i;
    return this.unlocked - 1;
  }

  start() {
    // 固定タイムステップ: 表示が60Hzでも120Hzでも、ゲームは常に60歩/秒で進む。
    // (60fps前提で調整した物理を、どの端末でも同じ速さに保つ)
    const STEP = 1000 / 60;
    let last = performance.now();
    let acc = 0;
    const loop = (now) => {
      acc += now - last;
      last = now;
      if (acc > 250) acc = 250; // タブ復帰などで溜まりすぎたら頭打ち
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        Input.poll();
        this.frame++;
        this.update();
        this.tickEffects();
        acc -= STEP;
        steps++;
      }
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 毎フレームの見た目の減衰・更新(状態に関係なく)
  tickEffects() {
    if (this.shake > 0) this.shake *= 0.86;
    if (this.flash) { this.flash.alpha *= 0.88; if (this.flash.alpha < 0.02) this.flash = null; }
    if (this.transition > 0) this.transition = Math.max(0, this.transition - 0.08);
    this.displayScore += (this.score - this.displayScore) * 0.2;
    Themes.updateAmbient(this.theme, this.frame);
  }

  newGame() {
    this.score = 0;
    if (this.startStage > 0) {
      // デバッグ: 全面解放してそのまま該当面を開始(進行状況は保存しない)
      this.unlocked = LEVELS.length;
      this.selectIndex = this.startStage;
      this.enterStage(this.startStage);
    } else {
      // 保存された進行状況(unlocked / cleared)を引き継いで続きから
      this.selectIndex = this.firstUncleared();
      this.state = 'SELECT';
    }
  }

  // 進行状況を最初からにリセット
  resetProgress() {
    this.unlocked = 1;
    this.cleared = new Set();
    this.best = 0;
    this.selectIndex = 0;
    this.save();
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
    this.theme = Themes.get(i);
    Themes.reset(this.theme);
  }

  // ステージ選択から面に入る(READY→GO! 演出を挟む)
  enterStage(i) {
    this.loadStage(i);
    this.paused = false;
    this.readyTimer = 78;
    this.transition = 1;
    this.state = 'READY';
  }

  // ポーズの切り替え(プレイ中のみ)
  togglePause() {
    if (this.state !== 'PLAYING') return;
    this.paused = !this.paused;
    this.pauseIndex = 0;
    Sound.play('select');
  }

  update() {
    switch (this.state) {
      case 'TITLE':
        if (Input.pressed.has('KeyR')) { this.resetProgress(); Sound.play('select'); }
        if (Input.jumpPressed) { Sound.play('start'); Sound.startBGM('map'); this.newGame(); }
        break;
      case 'SELECT':
        this.updateSelect();
        break;
      case 'READY':
        if (--this.readyTimer <= 0) { this.state = 'PLAYING'; Sound.startBGM('play'); }
        break;
      case 'PLAYING':
        if (this.paused) { this.updatePaused(); break; }
        if (Input.pressed.has('KeyP') || Input.pressed.has('Escape')) { this.togglePause(); break; }
        if (this.hitStop > 0) { this.hitStop--; break; } // 当たりの“ため”
        this.updatePlaying();
        break;
      case 'CLEAR':
        // 花火を打ち上げる
        if (this.timer % 18 === 0) Particles.firework(120 + Math.random() * (CONFIG.WIDTH - 240), 90 + Math.random() * 140);
        Particles.update();
        if (--this.timer <= 0) {
          if (this.cleared.has(LEVELS.length - 1)) {
            this.state = 'WIN'; // 最終面(ボス)クリア
          } else {
            this.selectIndex = Math.min(this.unlocked - 1, this.stageIndex + 1);
            this.transition = 1;
            this.state = 'SELECT';
          }
        }
        break;
      case 'WIN':
        if (Input.jumpPressed) this.state = 'TITLE';
        break;
    }
  }

  updatePaused() {
    // ポーズ中: つづける / マップへもどる を ←→ で選び、ジャンプで決定
    if (Input.pressed.has('KeyP') || Input.pressed.has('Escape')) { this.paused = false; return; }
    if (Input.pressed.has('ArrowLeft') || Input.pressed.has('KeyA')) { this.pauseIndex = 0; Sound.play('select'); }
    if (Input.pressed.has('ArrowRight') || Input.pressed.has('KeyD')) { this.pauseIndex = 1; Sound.play('select'); }
    if (Input.jumpPressed) {
      if (this.pauseIndex === 0) {
        this.paused = false; // つづける
      } else {
        // マップへもどる
        this.paused = false;
        this.transition = 1;
        Sound.stopBGM();
        this.updateBest();
        this.selectIndex = this.stageIndex;
        this.state = 'SELECT';
      }
    }
  }

  updateSelect() {
    const prev = this.selectIndex;
    if (Input.pressed.has('ArrowLeft') || Input.pressed.has('KeyA')) {
      this.selectIndex = Math.max(0, this.selectIndex - 1);
    }
    if (Input.pressed.has('ArrowRight') || Input.pressed.has('KeyD')) {
      this.selectIndex = Math.min(this.unlocked - 1, this.selectIndex + 1);
    }
    if (this.selectIndex !== prev) Sound.play('select');
    if (Input.jumpPressed) {
      Sound.play('start');
      this.enterStage(this.selectIndex);
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
        this.updateBest();
        this.selectIndex = this.stageIndex;
        this.transition = 1;
        Sound.stopBGM();
        this.state = 'SELECT';
      }
      return;
    }

    this.platforms.forEach((p) => p.update());
    pl.update(this.level, this.platforms);
    if (pl.justJumped) Sound.play('jump');
    if (pl.justWallKicked) { Sound.play('wallkick'); this.addShake(2); }
    if (pl.y > this.level.heightPx + 48 && !pl.dead) { pl.die(); Sound.play('damage'); this.addShake(4); } // 穴に落ちた

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
      if (this.boss.dead) {
        // 撃破演出: 爆発連発+シェイク
        if (this.boss.deadTimer % 9 === 0) {
          const bx = this.boss.x + this.boss.w / 2 + (Math.random() - 0.5) * 50;
          const by = this.boss.y + this.boss.h / 2 + (Math.random() - 0.5) * 40;
          Particles.burst(bx, by, '255,180,60', 18, 6);
          this.addShake(8);
          Sound.play('bosshit');
        }
        if (this.boss.deadTimer > 100) {
          this.doFlash('255,220,120', 0.7);
          Sound.play('clear');
          this.stageClear();
          return;
        }
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
          Particles.shock(e.x + e.w / 2, e.y + e.h / 2, '255,255,255');
          Particles.popup(e.x + e.w / 2, e.y, '+100', '255,240,160');
          Sound.play('stomp');
          this.addShake(4);
          this.hitStop = 3;
        } else {
          this.hurtPlayer();
        }
      }
    }

    if (this.boss && !this.boss.dead && overlaps(pl, this.boss)) {
      if (pl.vy > 0 && pl.y + pl.h - pl.vy <= this.boss.y + this.boss.h * 0.5) {
        if (this.boss.hit()) {
          this.score += 500;
          Particles.sparkle(this.boss.x + this.boss.w / 2, this.boss.y + 20, '255,90,90', 16);
          Particles.shock(this.boss.x + this.boss.w / 2, this.boss.y + 20, '255,200,120');
          Particles.popup(this.boss.x + this.boss.w / 2, this.boss.y, '+500', '255,200,120');
          Sound.play('bosshit');
          this.addShake(7);
          this.doFlash('255,255,255', 0.4);
          this.hitStop = 5;
        }
        pl.stompBounce();
      } else {
        this.hurtPlayer();
      }
    }

    for (const p of this.projectiles) {
      if (overlaps(pl, p)) {
        this.hurtPlayer();
        p.remove = true;
      }
    }

    for (const it of this.items) {
      if (overlaps(pl, it)) {
        it.dead = true;
        this.score += 200;
        pl.grow();
        Particles.sparkle(it.x + it.w / 2, it.y + it.h / 2, '120,230,120', 14);
        Particles.popup(it.x + it.w / 2, it.y, '+200', '150,255,150');
        Sound.play('powerup');
        this.doFlash('255,255,255', 0.5);
        this.addShake(3);
      }
    }

    if (this.flag && overlaps(pl, this.flag)) {
      this.stageClear();
      return;
    }

    this.camera.follow(pl);
  }

  // プレイヤーが実際にダメージを受けたときだけ演出する
  hurtPlayer() {
    const pl = this.player;
    if (pl.invincible > 0 || pl.dead) return;
    pl.hurt();
    Sound.play('damage');
    this.addShake(5);
    this.doFlash('255,70,70', 0.35);
    Particles.shock(pl.x + pl.w / 2, pl.y + pl.h / 2, '255,90,90');
  }

  stageClear() {
    this.score += 1000;
    this.cleared.add(this.stageIndex);
    // 次の面を解放
    this.unlocked = Math.max(this.unlocked, Math.min(LEVELS.length, this.stageIndex + 2));
    this.updateBest(); // 進行状況とベストスコアを保存
    Sound.play('clear');
    Sound.stopBGM();
    Particles.popup(this.player.x + this.player.w / 2, this.player.y - 10, '+1000', '255,230,120');
    this.state = 'CLEAR';
    this.timer = 150;
  }

  // --- 描画 ---

  draw() {
    const ctx = this.ctx;
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;

    if (this.state === 'TITLE') { this.drawTitle(ctx); this.drawOverlays(ctx); return; }
    if (this.state === 'SELECT') { this.drawSelect(ctx); this.drawOverlays(ctx); return; }

    const cam = this.camera;
    // 画面シェイク(全体に微小オフセット)
    ctx.save();
    if (this.shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    // 背景(空 → 遠景 → 奥霧)
    Themes.drawBackground(ctx, this.theme, cam, this.frame);
    // ワールド
    this.level.draw(ctx, cam, this.theme);
    if (this.flag) this.flag.draw(ctx, cam, this.frame);
    this.platforms.forEach((p) => p.draw(ctx, cam));
    // アイテム・弾の発光
    const gl = this.theme.glow || '255,240,180';
    this.items.forEach((it) => glow(ctx, it.x + it.w / 2 - cam.x, it.y + it.h / 2, 22, gl, 0.5));
    this.items.forEach((it) => it.draw(ctx, cam));
    this.enemies.forEach((e) => e.draw(ctx, cam));
    if (this.boss) this.boss.draw(ctx, cam, this.frame);
    this.projectiles.forEach((p) => { glow(ctx, p.x + 7 - cam.x, p.y + 7, 18, '255,160,40', 0.6); p.draw(ctx, cam, this.frame); });
    this.player.draw(ctx, cam, this.frame);
    Particles.draw(ctx, cam);
    // 前景もや・アンビエント・ビネット・グレード
    Themes.drawAtmosphere(ctx, this.theme, this.frame);

    ctx.restore(); // シェイク解除(HUD/演出はブレさせない)

    this.drawHUD(ctx);

    if (this.state === 'READY') this.drawReady(ctx);
    if (this.paused) this.drawPause(ctx);
    if (this.state === 'CLEAR') {
      this.overlay(ctx, [[`STAGE ${this.stageIndex + 1} CLEAR!`, 'bold 46px sans-serif', '#ffe27a', 250]], 0.3);
    } else if (this.state === 'WIN') {
      this.overlay(ctx, [
        ['CONGRATULATIONS!', 'bold 48px sans-serif', '#ffe27a', 190],
        ['魔王をたおして 全9ステージクリア!', 'bold 24px sans-serif', '#fff', 245],
        [`SCORE ${this.score}`, 'bold 22px monospace', '#fff', 295],
        ['PRESS SPACE', 'bold 20px monospace', '#ffe27a', 355],
      ]);
    }

    this.drawOverlays(ctx);
  }

  // フラッシュと画面遷移フェード(最前面)
  drawOverlays(ctx) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
    if (this.flash) {
      ctx.fillStyle = `rgba(${this.flash.color},${this.flash.alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.transition > 0.01) {
      ctx.fillStyle = `rgba(0,0,0,${this.transition.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ポーズメニュー
  drawPause(ctx) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSE', W / 2, H / 2 - 70);

    const opts = ['つづける', 'マップへもどる'];
    for (let i = 0; i < opts.length; i++) {
      const x = W / 2 + (i === 0 ? -120 : 120);
      const y = H / 2;
      const sel = i === this.pauseIndex;
      fillRound(ctx, x - 100, y - 26, 200, 48, 10, sel ? 'rgba(255,226,122,0.9)' : 'rgba(15,20,35,0.6)');
      ctx.fillStyle = sel ? '#1a1a2e' : '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(opts[i], x, y + 6);
    }
    ctx.fillStyle = '#d8e8ff';
    ctx.font = '14px sans-serif';
    ctx.fillText('←→ でえらぶ / スペースで けってい / P でつづける', W / 2, H / 2 + 80);
  }

  // READY? → GO! 表示
  drawReady(ctx) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, H / 2 - 64, W, 128);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`STAGE ${this.stageIndex + 1}  ${this.theme.name}`, W / 2, H / 2 - 26);
    const go = this.readyTimer < 26;
    ctx.font = 'bold 60px sans-serif';
    ctx.fillStyle = go ? '#7be06a' : '#ffe27a';
    ctx.fillText(go ? 'GO!' : 'READY?', W / 2, H / 2 + 28);
  }

  drawHUD(ctx) {
    const W = CONFIG.WIDTH;
    // ステージバッジ(左上、角丸パネル)
    fillRound(ctx, 12, 10, 132, 30, 8, 'rgba(15,20,35,0.45)');
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(`STAGE ${this.stageIndex + 1}`, 24, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.fillText('/ 9', 96, 30);
    // パワーアップ表示
    if (this.player.big) {
      fillRound(ctx, 152, 10, 96, 30, 8, 'rgba(60,40,10,0.5)');
      ctx.fillStyle = '#ffe27a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('POWER UP!', 162, 30);
    }
    // スコア(右上、転がるように補間)
    fillRound(ctx, W - 168, 10, 156, 30, 8, 'rgba(15,20,35,0.45)');
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px sans-serif';
    ctx.fillText('SCORE', W - 120, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(String(Math.round(this.displayScore)).padStart(6, '0'), W - 22, 31);
  }

  overlay(ctx, lines, dim = 0.55) {
    ctx.fillStyle = `rgba(0, 0, 0, ${dim})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.textAlign = 'center';
    for (const [text, font, color, y] of lines) {
      ctx.font = font;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(text, CONFIG.WIDTH / 2 + 2, y + 2);
      ctx.fillStyle = color;
      ctx.fillText(text, CONFIG.WIDTH / 2, y);
    }
  }

  drawTitle(ctx) {
    // アトモスフィアクな背景(ゆっくり流れる)
    Themes.drawBackground(ctx, this.theme, { x: this.frame * 0.4 }, this.frame);
    // 飾りの地面
    const grad = ctx.createLinearGradient(0, CONFIG.HEIGHT - 64, 0, CONFIG.HEIGHT);
    grad.addColorStop(0, this.theme.tile.dirtTop);
    grad.addColorStop(1, this.theme.tile.dirtBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, CONFIG.HEIGHT - 64, CONFIG.WIDTH, 64);
    ctx.fillStyle = this.theme.tile.capTop;
    ctx.fillRect(0, CONFIG.HEIGHT - 64, CONFIG.WIDTH, 8);

    // 主人公のイラスト(地面の上でぴょこぴょこ)
    {
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
    }

    // 前景もや・ビネット(文字より先に重ねて、文字は最後にクッキリ)
    Themes.drawAtmosphere(ctx, this.theme, this.frame);

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
    ctx.fillText('敵は上から踏んでたおせる! キノコでパワーアップ!', CONFIG.WIDTH / 2, 285);
    ctx.fillText('壁にはりついてジャンプで壁キック!', CONFIG.WIDTH / 2, 312);
    ctx.fillText('全9ステージのさいごに待つ魔王をたおせ!', CONFIG.WIDTH / 2, 339);

    if (this.frame % 60 < 36) {
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#ffe27a';
      ctx.fillText('PRESS SPACE', CONFIG.WIDTH / 2, 386);
    }
    // ベストスコア / リセット案内
    ctx.font = '14px monospace';
    ctx.fillStyle = '#d8e8ff';
    const prog = this.cleared.size > 0 ? `  クリア ${this.cleared.size}/9` : '';
    ctx.fillText(`BEST ${String(this.best).padStart(6, '0')}${prog}   (R: さいしょから)`, CONFIG.WIDTH / 2, 414);
  }

  drawSelect(ctx) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;

    // 空(全面)
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#8fc7e8');
    sky.addColorStop(1, '#bfe6c8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
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
