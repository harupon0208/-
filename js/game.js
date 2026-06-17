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
    this.selectScroll = 0;      // 選択マップの横スクロール(面数が増えても対応)
    // プレイ中の周回リソース(newGameでリセット)
    this.lives = CONFIG.START_LIVES;
    this.coinCount = 0;         // 通算コイン枚数(COIN_1UPごとに残機+1)
    this.combo = 0;             // 連続踏みつけコンボ(着地でリセット)
    this.checkpoint = null;     // 面内の復活地点 {x, top}(未通過はnull)
    this._starWas = false;      // 前フレームのスター無敵状態(BGM切替の検出用)
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
    this.reduceMotion = this.loadReduceMotion(); // 画面ゆれ・フラッシュを抑える設定
    this.loadSave();            // 保存された進行状況を読み込む
    // デバッグ: index.html?stage=5 でそのステージから開始
    const m = location.search.match(/stage=(\d{1,2})/);
    this.startStage = m ? Math.max(0, Math.min(LEVELS.length - 1, parseInt(m[1], 10) - 1)) : 0;
  }

  // リデュースモーション中は画面ゆれを止め、フラッシュもごく弱くする(光過敏配慮)
  addShake(n) { if (this.reduceMotion) return; this.shake = Math.min(16, Math.max(this.shake, n)); }
  doFlash(color, alpha) { this.flash = { color, alpha: this.reduceMotion ? Math.min(alpha, 0.1) : alpha }; }

  // 進行状況の保存・読み込み(localStorage)。SAVE_VERSION で将来のスキーマ変更に備える
  loadSave() {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('sjq_save');
      if (!raw) return;
      const d = JSON.parse(raw);
      // v未指定は初期スキーマ(v1)とみなして読み込む。今後フィールドを足してもここで吸収する
      if (typeof d.unlocked === 'number') this.unlocked = Math.max(1, Math.min(LEVELS.length, d.unlocked));
      if (Array.isArray(d.cleared)) this.cleared = new Set(d.cleared);
      if (typeof d.best === 'number') this.best = d.best;
    } catch (e) { /* 壊れていたら無視 */ }
  }

  save() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('sjq_save', JSON.stringify({
        v: Game.SAVE_VERSION, unlocked: this.unlocked, cleared: [...this.cleared], best: this.best,
      }));
    } catch (e) { /* プライベートモード等では無視 */ }
  }

  // リデュースモーション設定: 保存値が無ければOSの prefers-reduced-motion を初期値にする
  loadReduceMotion() {
    try {
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem('sjq_reduce');
        if (v === '1') return true;
        if (v === '0') return false;
      }
      if (typeof matchMedia === 'function') return matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    return false;
  }

  toggleReduceMotion() {
    this.reduceMotion = !this.reduceMotion;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('sjq_reduce', this.reduceMotion ? '1' : '0'); } catch (e) {}
    Sound.play('select');
    return this.reduceMotion;
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
    this.lives = CONFIG.START_LIVES;
    this.coinCount = 0;
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

  // respawn: 復活地点 {x, top}。指定時はそこからプレイヤーを再開し、通過済みチェックポイントを点灯
  loadStage(i, respawn = null) {
    this.stageIndex = i;
    this.level = new Level(LEVELS[i]);
    const s = this.level.spawns;
    this.player = new Player(s.player.x, s.player.y);
    this.enemies = s.enemies.map((e) =>
      e.type === 'e' ? new Walker(e.x, e.y) :
      e.type === 'f' ? new Speedy(e.x, e.y) :
      new Hopper(e.x, e.y));
    this.items = s.items.map((it) => new Mushroom(it.x, it.y));
    this.coins = s.coins.map((c) => new Coin(c.x, c.y));
    this.stars = s.stars.map((c) => new Star(c.x, c.y));
    this.checkpoints = s.checkpoints.map((c) => new Checkpoint(c.x, c.y));
    this.fireFlowers = s.fireFlowers.map((c) => new FireFlower(c.x, c.y));
    this.feathers = s.feathers.map((c) => new Feather(c.x, c.y));
    this.springs = s.springs.map((c) => new Spring(c.x, c.y));
    this.crumbles = s.crumbles.map((c) => new CrumblingPlatform(c.x, c.y));
    this.cannons = s.cannons.map((c) => new Cannon(c.x, c.y, c.dir));
    this.fireballs = [];
    this.platforms = s.platforms.map((p) => new MovingPlatform(p.x, p.y, p.axis));
    this.flag = s.flag ? new Flag(s.flag.x, s.flag.y) : null;
    this.boss = s.boss ? new Boss(s.boss.x, s.boss.y, Math.floor(i / 9) + 1) : null;
    this.projectiles = [];
    this.combo = 0;
    this._starWas = false;

    if (respawn) {
      // チェックポイントから復活: 位置を移し、その地点までのチェックポイントを点灯済みに
      this.player.x = respawn.x;
      this.player.y = respawn.top + CONFIG.TILE - this.player.h;
      for (const cp of this.checkpoints) if (cp.respawnX() <= respawn.x + 1) cp.active = true;
    } else {
      this.checkpoint = null; // 新しく面に入ったらチェックポイントは未通過に戻す
    }

    this.camera = new Camera(this.level);
    this.camera.follow(this.player);
    Particles.clear();
    this.theme = Themes.forStage(i);
    Themes.reset(this.theme);
  }

  // ステージ選択から面に入る / チェックポイントから復活する(READY→GO! 演出を挟む)
  enterStage(i, respawn = null) {
    this.loadStage(i, respawn);
    this.paused = false;
    this.readyTimer = 78;
    this.transition = 1;
    this.state = 'READY';
  }

  // ミス後の復活(残機が残っているとき)。チェックポイントがあればそこから
  respawn() {
    this.enterStage(this.stageIndex, this.checkpoint);
  }

  // 残機を増やす(コイン100枚・上限あり)
  gainLife() {
    if (this.lives < CONFIG.MAX_LIVES) this.lives++;
    Sound.play('oneup');
    Particles.popup(this.player.x + this.player.w / 2, this.player.y - 16, '1UP', '120,255,150');
    this.doFlash('150,255,150', 0.3);
  }

  // エンティティが占有するタイルのどれかが風(上昇気流)か
  windZone(ent) {
    const T = CONFIG.TILE;
    const c0 = Math.floor(ent.x / T), c1 = Math.floor((ent.x + ent.w - 1) / T);
    const r0 = Math.floor(ent.y / T), r1 = Math.floor((ent.y + ent.h - 1) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.level.windAt(c, r)) return true;
    return false;
  }

  // エンティティが占有するタイルのどれかがハザード(トゲ/溶岩)か
  hazardZone(ent) {
    const T = CONFIG.TILE;
    // 体の少し内側で判定(かすっただけで死なないように)
    const c0 = Math.floor((ent.x + 4) / T), c1 = Math.floor((ent.x + ent.w - 5) / T);
    const r0 = Math.floor((ent.y + 4) / T), r1 = Math.floor((ent.y + ent.h - 2) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.level.hazardAt(c, r)) return true;
    return false;
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
        if (Input.pressed.has('KeyV')) this.toggleReduceMotion();
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
      case 'GAMEOVER':
        Particles.update();
        if (Input.jumpPressed || --this.timer <= 0) this.state = 'TITLE';
        break;
      case 'WIN':
        if (Input.jumpPressed) this.state = 'TITLE';
        break;
    }
  }

  updatePaused() {
    // ポーズ中: つづける / モーション軽減 / マップへもどる を ↑↓ で選び、ジャンプで決定
    if (Input.pressed.has('KeyP') || Input.pressed.has('Escape')) { this.paused = false; return; }
    const N = 3;
    if (Input.pressed.has('ArrowUp') || Input.pressed.has('KeyW')) { this.pauseIndex = (this.pauseIndex + N - 1) % N; Sound.play('select'); }
    if (Input.pressed.has('ArrowDown') || Input.pressed.has('KeyS')) { this.pauseIndex = (this.pauseIndex + 1) % N; Sound.play('select'); }
    if (Input.jumpPressed) {
      if (this.pauseIndex === 0) {
        this.paused = false; // つづける
      } else if (this.pauseIndex === 1) {
        this.toggleReduceMotion(); // 切り替えてポーズは続行
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
        // ミス: 残機を1減らす。残っていればチェックポイントから復活、尽きたらゲームオーバー
        this.lives--;
        this.updateBest();
        Sound.stopBGM();
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.timer = 220;
          Sound.play('gameover');
        } else {
          this.respawn();
        }
      }
      return;
    }

    this.platforms.forEach((p) => p.update());
    pl.onIce = !!(this.theme.tile && this.theme.tile.slippery); // 氷テーマでは滑る
    pl.update(this.level, this.platforms);
    // ジャンプは大きいほど低め、着地は速いほど低く重い音(勢いを音で表現)
    if (pl.justJumped) Sound.play('jump', pl.big ? 0.9 : 1);
    if (pl.justWallKicked) { Sound.play('wallkick'); this.addShake(2); }
    if (pl.justLanded && pl.landImpact > 4.5) {
      Sound.play('land', Math.max(0.7, 1.3 - pl.landImpact * 0.05));
    }
    // 地面に足が着いたら踏みつけコンボはリセット(空中で連続して踏むほど高得点)
    if (pl.onGround) this.combo = 0;
    if (pl.y > this.level.heightPx + 48 && !pl.dead) { pl.die(); Sound.play('damage'); this.addShake(4); } // 穴に落ちた

    // 無敵スターの効果が切れた瞬間に通常BGMへ戻す
    const starNow = pl.starActive();
    if (this._starWas && !starNow) Sound.startBGM('play');
    this._starWas = starNow;
    // スター中はプレイヤーから虹色の軌跡を出す
    if (starNow && this.frame % 3 === 0) {
      Particles.sparkle(pl.x + pl.w / 2, pl.y + pl.h / 2, hueToRgb((this.frame * 9) % 360), 2);
    }

    // --- パワーアップ取得・火球発射・ギミック ---
    // ファイア: 火球を撃つ(画面内の数を制限)
    if (pl.justFired && this.fireballs.length < CONFIG.FIRE_MAX) {
      const fx = pl.facing > 0 ? pl.x + pl.w : pl.x;
      this.fireballs.push(new Fireball(fx, pl.y + pl.h * 0.45, pl.facing));
      Sound.play('fire');
    }

    // ファイアフラワー / フェザーの取得
    this.fireFlowers.forEach((f) => f.update());
    for (const f of this.fireFlowers) {
      if (!f.dead && overlaps(pl, f)) {
        f.dead = true; pl.setPower('fire'); this.score += 200;
        Sound.play('fireget'); this.doFlash('255,160,80', 0.45);
        Particles.sparkle(f.x + f.w / 2, f.y + f.h / 2, '255,150,60', 14);
        Particles.popup(f.x + f.w / 2, f.y, 'FIRE!', '255,180,90');
      }
    }
    this.fireFlowers = this.fireFlowers.filter((f) => !f.dead);

    this.feathers.forEach((f) => f.update());
    for (const f of this.feathers) {
      if (!f.dead && overlaps(pl, f)) {
        f.dead = true; pl.setPower('cape'); this.score += 200;
        Sound.play('capeget'); this.doFlash('150,255,170', 0.45);
        Particles.sparkle(f.x + f.w / 2, f.y + f.h / 2, '150,255,170', 14);
        Particles.popup(f.x + f.w / 2, f.y, 'CAPE!', '160,255,180');
      }
    }
    this.feathers = this.feathers.filter((f) => !f.dead);

    // バネ: 上から触れると高く跳ねる
    this.springs.forEach((s) => s.update());
    for (const s of this.springs) {
      if (pl.vy >= 0 && pl.x + pl.w > s.x && pl.x < s.x + s.w) {
        const feet = pl.y + pl.h, top = s.topY();
        if (feet >= top - 2 && feet <= top + 18) {
          pl.y = top - pl.h; pl.vy = CONFIG.SPRING_VEL; pl.jumping = true; pl.onGround = false;
          s.bounce(); Sound.play('spring'); this.addShake(2);
          Particles.dust(pl.x + pl.w / 2, feet, 0, 6);
        }
      }
    }

    // 崩れる足場: 乗ると支えるが、少しして落ちる
    this.crumbles.forEach((c) => c.update());
    for (const c of this.crumbles) {
      if (!c.solid) continue;
      if (pl.vy >= 0 && pl.x + pl.w > c.x && pl.x < c.x + c.w) {
        const feet = pl.y + pl.h;
        if (feet >= c.y - 2 && feet <= c.y + 16) {
          pl.y = c.y - pl.h; pl.vy = 0; pl.onGround = true;
          if (c.stepOn()) Sound.play('crumble');
        }
      }
    }

    // 風(上昇気流): 範囲内では確実に上昇(重力に負けないよう、最低でも上向き速度を保証)
    if (this.windZone(pl)) {
      pl.vy = Math.min(pl.vy, CONFIG.WIND_MAX_RISE);
      pl.onGround = false;
      if (this.frame % 3 === 0) Particles.dust(pl.x + pl.w / 2, pl.y + pl.h, 0, 1);
    }

    // ハザード(トゲ/溶岩): 触れたら即ミス(無敵中は除く)
    if (this.hazardZone(pl) && pl.invincible <= 0 && !pl.starActive() && !pl.dead) {
      pl.die(); Sound.play('damage'); this.addShake(5); this.doFlash('255,80,40', 0.4);
    }

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

    // 大砲: 画面内なら一定間隔で弾を撃つ(this.projectiles に追加 → 後段でプレイヤーと当たる)
    for (const cn of this.cannons) {
      if (cn.x > cam.x - 80 && cn.x < cam.x + CONFIG.WIDTH + 80) {
        if (cn.update(this.projectiles)) Sound.play('cannon');
      }
    }

    // 火球の更新と、敵・ボスへの命中
    this.fireballs.forEach((fb) => fb.update(this.level));
    for (const fb of this.fireballs) {
      for (const e of this.enemies) {
        if (e.dead || !e.active) continue;
        if (overlaps(fb, e)) {
          e.stomp(); this.score += 100; fb.remove = true;
          Particles.burst(e.x + e.w / 2, e.y + e.h / 2, '255,160,60', 10, 5);
          Particles.popup(e.x + e.w / 2, e.y, '+100', '255,200,120');
          Sound.play('stomp');
          break;
        }
      }
      if (this.boss && !this.boss.dead && overlaps(fb, this.boss)) {
        fb.remove = true;
        if (this.boss.hit()) {
          this.score += 200; this.addShake(4); this.doFlash('255,200,120', 0.3);
          Particles.burst(this.boss.x + this.boss.w / 2, this.boss.y + 20, '255,160,60', 12, 5);
          Sound.play('bosshit');
        }
      }
    }
    this.fireballs = this.fireballs.filter((fb) => !fb.remove);

    this.items.forEach((it) => it.update(this.level));
    this.items = this.items.filter((it) => !it.dead);

    this.coins.forEach((c) => c.update());
    this.coins = this.coins.filter((c) => !c.dead);

    this.stars.forEach((s) => s.update(this.level));
    this.stars = this.stars.filter((s) => !s.dead);

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
      if (!overlaps(pl, e)) continue;
      if (pl.starActive()) {
        // 無敵スター中は触れるだけで撃破
        e.stomp();
        this.score += 100;
        Particles.burst(e.x + e.w / 2, e.y + e.h / 2, '255,220,120', 12, 5);
        Particles.popup(e.x + e.w / 2, e.y, '+100', '255,240,160');
        Sound.play('stomp');
        this.addShake(2);
      } else if (pl.vy > 0 && pl.y + pl.h - pl.vy <= e.y + e.h * 0.6) {
        // 落下中に上から当たったら踏みつけ。着地せず連続で踏むほど倍々に加点
        e.stomp();
        pl.stompBounce();
        this.combo = Math.min(this.combo + 1, CONFIG.COMBO_MAX_STEPS);
        const pts = CONFIG.COMBO_BASE * Math.pow(2, this.combo - 1);
        this.score += pts;
        Particles.sparkle(e.x + e.w / 2, e.y + e.h / 2);
        Particles.shock(e.x + e.w / 2, e.y + e.h / 2, '255,255,255');
        Particles.popup(e.x + e.w / 2, e.y, '+' + pts, '255,240,160');
        if (this.combo >= 2) Particles.popup(e.x + e.w / 2, e.y - 22, 'COMBO x' + this.combo, '120,230,255');
        Sound.play('stomp', 1 + (this.combo - 1) * 0.08); // コンボが伸びるほど高い音
        this.addShake(4);
        this.hitStop = 3;
      } else {
        this.hurtPlayer();
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

    // コイン回収(100枚ごとに残機+1)
    for (const c of this.coins) {
      if (c.dead) continue;
      if (overlaps(pl, c)) {
        c.dead = true;
        this.coinCount++;
        this.score += CONFIG.COIN_SCORE;
        Particles.sparkle(c.x + c.w / 2, c.y + c.h / 2, '255,215,90', 7);
        Particles.popup(c.x + c.w / 2, c.y, '+' + CONFIG.COIN_SCORE, '255,225,120');
        Sound.play('coin');
        if (this.coinCount % CONFIG.COIN_1UP === 0) this.gainLife();
      }
    }

    // 無敵スター取得
    for (const s of this.stars) {
      if (s.dead) continue;
      if (overlaps(pl, s)) {
        s.dead = true;
        pl.starTimer = CONFIG.STAR_FRAMES;
        this.score += 300;
        Sound.play('star');
        Sound.startBGM('star');
        this.doFlash('255,240,150', 0.5);
        Particles.sparkle(s.x + s.w / 2, s.y + s.h / 2, '255,230,120', 16);
        Particles.popup(s.x + s.w / 2, s.y, 'INVINCIBLE!', '255,230,120');
      }
    }

    // チェックポイント通過(復活地点を更新)
    for (const cp of this.checkpoints) {
      if (cp.active) continue;
      if (overlaps(pl, cp)) {
        cp.active = true;
        this.checkpoint = { x: cp.respawnX(), top: cp.respawnTop() };
        Sound.play('checkpoint');
        Particles.sparkle(cp.x + cp.w / 2, cp.y + 16, '120,255,150', 12);
        Particles.popup(cp.x, cp.y, 'CHECK!', '150,255,150');
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
    this.checkpoints.forEach((cp) => cp.draw(ctx, cam, this.frame));
    if (this.flag) this.flag.draw(ctx, cam, this.frame);
    this.cannons.forEach((cn) => cn.draw(ctx, cam));
    this.crumbles.forEach((c) => c.draw(ctx, cam));
    this.springs.forEach((s) => s.draw(ctx, cam));
    this.platforms.forEach((p) => p.draw(ctx, cam));
    // アイテム・弾の発光
    const gl = this.theme.glow || '255,240,180';
    this.items.forEach((it) => glow(ctx, it.x + it.w / 2 - cam.x, it.y + it.h / 2, 22, gl, 0.5));
    this.items.forEach((it) => it.draw(ctx, cam));
    // パワーアップ(発光つき)
    this.fireFlowers.forEach((f) => glow(ctx, f.x + f.w / 2 - cam.x, f.y + 8, 18, '255,150,60', 0.5));
    this.fireFlowers.forEach((f) => f.draw(ctx, cam));
    this.feathers.forEach((f) => glow(ctx, f.x + f.w / 2 - cam.x, f.y + f.h / 2, 16, '150,255,180', 0.45));
    this.feathers.forEach((f) => f.draw(ctx, cam));
    // コイン(金色の発光) / スター
    this.coins.forEach((c) => glow(ctx, c.x + c.w / 2 - cam.x, c.y + c.h / 2, 16, '255,210,80', 0.45));
    this.coins.forEach((c) => c.draw(ctx, cam));
    this.stars.forEach((s) => s.draw(ctx, cam));
    this.fireballs.forEach((fb) => fb.draw(ctx, cam));
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
    } else if (this.state === 'GAMEOVER') {
      this.overlay(ctx, [
        ['GAME OVER', 'bold 52px sans-serif', '#ff6b6b', 210],
        [`SCORE ${this.score}`, 'bold 22px monospace', '#fff', 262],
        ['PRESS SPACE', 'bold 20px monospace', '#ffe27a', 320],
      ], 0.6);
    } else if (this.state === 'WIN') {
      this.overlay(ctx, [
        ['CONGRATULATIONS!', 'bold 48px sans-serif', '#ffe27a', 190],
        ['3人の王をたおして 全3ワールド制覇!', 'bold 24px sans-serif', '#fff', 245],
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
    ctx.fillText('PAUSE', W / 2, H / 2 - 96);

    const opts = ['つづける', 'モーション軽減: ' + (this.reduceMotion ? 'ON' : 'OFF'), 'マップへもどる'];
    for (let i = 0; i < opts.length; i++) {
      const y = H / 2 - 40 + i * 52;
      const sel = i === this.pauseIndex;
      fillRound(ctx, W / 2 - 150, y - 22, 300, 44, 10, sel ? 'rgba(255,226,122,0.9)' : 'rgba(15,20,35,0.6)');
      ctx.fillStyle = sel ? '#1a1a2e' : '#fff';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(opts[i], W / 2, y + 6);
    }
    ctx.fillStyle = '#d8e8ff';
    ctx.font = '14px sans-serif';
    ctx.fillText('↑↓ でえらぶ / スペースで けってい / P でつづける', W / 2, H / 2 + 130);
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
    // ワールド/ステージバッジ(左上、角丸パネル)
    const world = Math.floor(this.stageIndex / 9) + 1;
    const sub = (this.stageIndex % 9) + 1;
    fillRound(ctx, 12, 10, 150, 30, 8, 'rgba(15,20,35,0.45)');
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(`WORLD ${world}`, 22, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(sub === 9 ? 'BOSS' : `STAGE ${sub}`, 92, 30);
    // パワー表示(キノコ/ファイア/フェザー)
    const pw = this.player.power;
    if (pw !== 'small') {
      const label = pw === 'fire' ? 'FIRE' : pw === 'cape' ? 'CAPE' : 'POWER';
      const col = pw === 'fire' ? 'rgba(120,40,10,0.55)' : pw === 'cape' ? 'rgba(20,70,30,0.55)' : 'rgba(60,40,10,0.5)';
      fillRound(ctx, 170, 10, 84, 30, 8, col);
      ctx.fillStyle = '#ffe27a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(label, 182, 30);
    }

    // 残機 + コイン(2段目の角丸パネル)
    fillRound(ctx, 12, 46, 150, 28, 8, 'rgba(15,20,35,0.45)');
    drawHeartIcon(ctx, 28, 60, 7, '#ff5a6a');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('x' + this.lives, 38, 65);
    // コインアイコン(金色の円 + 刻印)
    fillCircle(ctx, 96, 60, 7, '#ffd24a');
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(94.5, 56, 3, 8);
    ctx.fillStyle = '#fff';
    ctx.fillText('x' + this.coinCount, 108, 65);

    // スコア(右上、転がるように補間)
    fillRound(ctx, W - 168, 10, 156, 30, 8, 'rgba(15,20,35,0.45)');
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px sans-serif';
    ctx.fillText('SCORE', W - 120, 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(String(Math.round(this.displayScore)).padStart(6, '0'), W - 22, 31);

    // 無敵スターの残り時間バー(中央上)
    if (this.player.starTimer > 0) {
      const frac = this.player.starTimer / CONFIG.STAR_FRAMES;
      const bw = 180, bx = (W - bw) / 2, by = 14;
      fillRound(ctx, bx - 2, by - 2, bw + 4, 12, 6, 'rgba(0,0,0,0.4)');
      fillRound(ctx, bx, by, Math.max(2, bw * frac), 8, 4, `rgb(${hueToRgb((this.frame * 8) % 360)})`);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('★ INVINCIBLE ★', W / 2, by + 24);
    }

    // 踏みつけコンボ(中央)
    if (this.combo >= 2) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText('COMBO x' + this.combo, W / 2 + 2, 112);
      ctx.fillStyle = '#7fd0ff';
      ctx.fillText('COMBO x' + this.combo, W / 2, 110);
    }
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
      drawHeroBody(ctx, hw, hh, 'big', 1, this.frame * 0.2, true, hop < 2, this.frame % 200 < 10);
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
    ctx.fillText('敵は上から踏んでたおせる! キノコ・ファイア・フェザーでパワーアップ!', CONFIG.WIDTH / 2, 285);
    ctx.fillText('壁キック / 二段ジャンプ・滑空(フェザー) / X で火球(ファイア)!', CONFIG.WIDTH / 2, 312);
    ctx.fillText('全3ワールド27ステージ! 各ワールドのボスをたおせ!', CONFIG.WIDTH / 2, 339);

    if (this.frame % 60 < 36) {
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#ffe27a';
      ctx.fillText('PRESS SPACE', CONFIG.WIDTH / 2, 386);
    }
    // ベストスコア / リセット案内
    ctx.font = '14px monospace';
    ctx.fillStyle = '#d8e8ff';
    const prog = this.cleared.size > 0 ? `  クリア ${this.cleared.size}/${LEVELS.length}` : '';
    ctx.fillText(`BEST ${String(this.best).padStart(6, '0')}${prog}   (R: さいしょから)`, CONFIG.WIDTH / 2, 412);
    ctx.fillText(`コイン100枚で1UP / ★スターで無敵   (V: モーション軽減 ${this.reduceMotion ? 'ON' : 'OFF'})`, CONFIG.WIDTH / 2, 434);
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

    // 選択ノードに追従して横スクロール(面数が増えても画面内に収める)。
    // 9面では maxScroll=0 なのでスクロールせず従来表示のまま。
    const lastX = nodes[nodes.length - 1].x;
    const maxScroll = Math.max(0, lastX + 90 - W);
    const target = Math.max(0, Math.min(nodes[this.selectIndex].x - W / 2, maxScroll));
    this.selectScroll += (target - this.selectScroll) * 0.2;
    if (Math.abs(target - this.selectScroll) < 0.5) this.selectScroll = target;

    ctx.save();
    ctx.translate(-Math.round(this.selectScroll), 0);

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
      const isBoss = (i % 9) === 8; // 各ワールドの9面目がボス

      softShadow(ctx, n.x, n.y + 22, 22, 6);

      let color;
      if (locked) color = '#9aa0a6';
      else if (done) color = '#36b24a';
      else if (isBoss) color = '#b5463f';
      else color = ['#f2b134', '#46b4d0', '#a065d8'][Math.floor(i / 9)] || '#f2b134'; // ワールド色
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
        ctx.fillText(String((i % 9) + 1), n.x, n.y + 8); // ワールド内番号(1〜8)
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
    drawHeroBody(ctx, hw, hh, 'small', 1, this.frame * 0.2, true, hop < 2, this.frame % 200 < 10);
    ctx.restore();

    ctx.restore(); // 横スクロールの解除(タイトル帯・下部UIは固定)

    // タイトル帯(ワールド表示つき)
    const selWorld = Math.floor(this.selectIndex / 9) + 1;
    const worldColors = ['#ffd24a', '#7be0ff', '#c8a0ff'];
    const worldNames = ['地上', '空と氷雪', '魔界と溶岩'];
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, 60);
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('ステージをえらぼう', W / 2, 38);
    // 右上にワールド表示
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = worldColors[selWorld - 1] || '#fff';
    ctx.fillText(`WORLD ${selWorld} / 3  ${worldNames[selWorld - 1] || ''}`, W - 16, 38);

    // 下部: 選択中の面名 + 操作ヒント
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, H - 56, W, 56);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(LEVELS[this.selectIndex].name, W / 2, H - 30);
    ctx.fillStyle = '#d8e8ff';
    ctx.font = '15px sans-serif';
    ctx.fillText('←→ でえらぶ / スペースで けってい', W / 2, H - 10);
  }
}

Game.SAVE_VERSION = 2; // セーブデータのスキーマ版(将来の移行用)

const game = new Game();
game.start();
