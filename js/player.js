// プレイヤー

// ヒーローの体を局所座標(0,0)〜(w,h)に描く。呼び出し側で位置・つぶれを transform 済み。
// 茶髪アホ毛・青コート(赤襟+金トリム)・白シャツ・青パンツ金ライン・赤ブーツの冒険者。
function drawHeroBody(ctx, w, h, power, dir, animPhase, moving, onGround, blink, wallDir = 0, gliding = false) {
  const big = power !== 'small';
  const isFire = power === 'fire';
  const isCape = power === 'cape';
  const hw = w / 2;
  const headR = Math.max(7, Math.round(w * 0.5));
  const headCx = hw;
  const headCy = headR + 3;

  // 配色(ファイアは赤コート、フェザーは緑マントを後述で追加)
  const coat = isFire ? '#e0512e' : big ? '#3a72de' : '#2a5ec4';   // コート/パンツ
  const coatDk = isFire ? '#a8351a' : '#1f49a0';
  const red = '#d8392c';                       // 赤の差し色
  const gold = '#ffcf4a';                      // 金トリム
  const white = '#f3f1e7';                     // 白シャツ
  const skin = '#ffd9a6';
  const hair = '#a85b27';
  const glove = '#3a3030';

  // フェザー: 背中になびく緑のマント(体より先に描いて背面に置く)
  if (isCape) {
    const sw = Math.sin(animPhase * 0.8) * 3 + (gliding ? -6 : 0);
    const back = dir > 0 ? -1 : 1; // 進行方向の逆へなびく
    ctx.fillStyle = '#2fa84f';
    ctx.beginPath();
    ctx.moveTo(hw, headCy + headR);
    ctx.quadraticCurveTo(hw + back * (w * 0.7), h * 0.45 + sw, hw + back * (w * 0.55), h * 0.92 + sw);
    ctx.lineTo(hw + back * 2, h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1f7d39';
    ctx.fillRect(hw - 3, headCy + headR - 2, 6, 4); // 留め具
  }

  const legH = Math.round(h * 0.34);
  const legTop = h - legH;
  const torsoTop = headCy + headR - 2;
  const torsoH = legTop - torsoTop + 4;
  const swing = wallDir === 0 && moving && onGround ? Math.sin(animPhase) * 4 : 0;
  const legW = Math.max(6, Math.round(w * 0.36));

  // なびくサッシュ(背中側、facingの後ろへ)
  {
    const tdir = -dir;
    const wv = Math.sin(animPhase * 0.6 + 1) * 2;
    const ox = dir > 0 ? 2 : w - 2;
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.moveTo(ox, torsoTop + 4);
    ctx.quadraticCurveTo(ox + tdir * 8, torsoTop + 8 + wv, ox + tdir * 13, torsoTop + 16 + wv);
    ctx.lineTo(ox + tdir * 9, torsoTop + 17 + wv);
    ctx.quadraticCurveTo(ox + tdir * 5, torsoTop + 11, ox, torsoTop + 10);
    ctx.closePath();
    ctx.fill();
    fillCircle(ctx, ox + tdir * 12, torsoTop + 17 + wv, 1.8, gold); // 房
  }

  // 脚(青パンツ + 金ライン)
  fillRound(ctx, hw - legW - 1 - swing, legTop, legW, legH, 4, coat);
  fillRound(ctx, hw + 1 + swing, legTop, legW, legH, 4, coat);
  ctx.fillStyle = gold;
  ctx.fillRect(hw - legW - 1 - swing, legTop, 1.6, legH);
  ctx.fillRect(hw + legW - 0.6 + swing, legTop, 1.6, legH);
  // 赤いブーツ + 白ソール
  fillRound(ctx, hw - legW - 3 - swing, h - 6, legW + 4, 6, 2, red);
  fillRound(ctx, hw - 1 + swing, h - 6, legW + 4, 6, 2, red);
  ctx.fillStyle = white;
  ctx.fillRect(hw - legW - 3 - swing, h - 2, legW + 4, 2);
  ctx.fillRect(hw - 1 + swing, h - 2, legW + 4, 2);

  // 腕(コートの袖 + フィンガーレスグローブの手)
  const armH = torsoH * 0.55;
  const armSwing = moving && onGround ? Math.sin(animPhase + Math.PI) * 3 : 0;
  const drawHand = (hx, hy) => { fillCircle(ctx, hx, hy, 3, skin); fillRound(ctx, hx - 2.5, hy - 1, 5, 3, 1, glove); };
  if (wallDir !== 0) {
    const ax = wallDir > 0 ? w - 4 : -1;
    fillRound(ctx, ax, torsoTop - 4, 5, armH, 2.5, coat);
    drawHand(ax + 2.5, torsoTop - 4);
    const bx = wallDir > 0 ? -1 : w - 4;
    fillRound(ctx, bx, torsoTop + 4, 5, armH, 2.5, coat);
    drawHand(bx + 2.5, torsoTop + 4 + armH);
  } else {
    fillRound(ctx, -1, torsoTop + 2 - armSwing, 5, armH, 2.5, coat);
    fillRound(ctx, w - 4, torsoTop + 2 + armSwing, 5, armH, 2.5, coat);
    drawHand(1.5, torsoTop + 2 + armH - armSwing);
    drawHand(w - 1.5, torsoTop + 2 + armH + armSwing);
  }

  // 胴: 白シャツ → 青コート左右パネル(中央にV字で白を残す)
  fillRound(ctx, 2, torsoTop, w - 4, torsoH, 5, white);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(1, torsoTop); ctx.lineTo(hw - 3, torsoTop);
  ctx.lineTo(hw - 1, torsoTop + torsoH * 0.5); ctx.lineTo(hw - 3, torsoTop + torsoH);
  ctx.lineTo(1, torsoTop + torsoH); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w - 1, torsoTop); ctx.lineTo(hw + 3, torsoTop);
  ctx.lineTo(hw + 1, torsoTop + torsoH * 0.5); ctx.lineTo(hw + 3, torsoTop + torsoH);
  ctx.lineTo(w - 1, torsoTop + torsoH); ctx.closePath(); ctx.fill();
  // 金トリム(前合わせ)
  ctx.strokeStyle = gold; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(hw - 3, torsoTop); ctx.lineTo(hw - 1, torsoTop + torsoH * 0.5); ctx.lineTo(hw - 3, torsoTop + torsoH);
  ctx.moveTo(hw + 3, torsoTop); ctx.lineTo(hw + 1, torsoTop + torsoH * 0.5); ctx.lineTo(hw + 3, torsoTop + torsoH);
  ctx.stroke();
  // 赤い襟(立て襟)
  ctx.fillStyle = red;
  ctx.beginPath(); ctx.moveTo(1, torsoTop); ctx.lineTo(hw - 2, torsoTop); ctx.lineTo(2, torsoTop + 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w - 1, torsoTop); ctx.lineTo(hw + 2, torsoTop); ctx.lineTo(w - 2, torsoTop + 6); ctx.closePath(); ctx.fill();
  // 青い宝石ペンダント
  ctx.save(); ctx.translate(hw, torsoTop + 5); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#3fc7e8'; ctx.fillRect(-2, -2, 4, 4); ctx.restore();
  // ベルト + 金バックル
  fillRound(ctx, 1, torsoTop + torsoH - 5, w - 2, 5, 2, '#7a4a24');
  fillCircle(ctx, hw, torsoTop + torsoH - 2.5, 2, gold);

  // 顔
  fillCircle(ctx, headCx, headCy, headR, skin);
  ctx.fillStyle = 'rgba(255,120,110,0.45)';
  ctx.beginPath(); ctx.arc(headCx + dir * 4, headCy + 3, 2.4, 0, 7); ctx.fill();
  // 青い目(まばたき対応)
  const ex = headCx + dir * 2.5;
  if (blink) { ctx.fillStyle = '#3a2a22'; ctx.fillRect(ex - 2, headCy - 1, 5, 1.6); }
  else {
    fillCircle(ctx, ex, headCy - 1, 2.4, '#fff');
    fillCircle(ctx, ex + dir * 0.5, headCy - 1, 1.8, '#2f8fd6');
    fillCircle(ctx, ex + dir * 0.5, headCy - 1, 0.9, '#1b2b40');
  }
  // 笑った口
  ctx.fillStyle = '#7a3a2a';
  ctx.beginPath(); ctx.arc(headCx + dir * 1.5, headCy + 5, 1.8, 0, Math.PI); ctx.fill();

  // 髪(茶色のとげとげ + アホ毛)
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(headCx, headCy - 2, headR, Math.PI, 0); ctx.fill(); // 上部
  // 前髪(ギザギザ)
  ctx.beginPath();
  ctx.moveTo(headCx - headR, headCy - 2);
  ctx.lineTo(headCx - headR * 0.5, headCy + 3);
  ctx.lineTo(headCx - headR * 0.15, headCy - 1);
  ctx.lineTo(headCx + headR * 0.3, headCy + 3);
  ctx.lineTo(headCx + headR * 0.7, headCy - 1);
  ctx.lineTo(headCx + headR, headCy + 2);
  ctx.lineTo(headCx + headR, headCy - 2);
  ctx.closePath(); ctx.fill();
  // とげ髪(上向き)
  const spikes = [[-0.7, -1.2], [-0.25, -1.6], [0.25, -1.4], [0.7, -1.0]];
  for (const [fx, fy] of spikes) {
    ctx.beginPath();
    ctx.moveTo(headCx + fx * headR - 4, headCy - headR * 0.6);
    ctx.lineTo(headCx + fx * headR + 1, headCy + fy * headR);
    ctx.lineTo(headCx + fx * headR + 4, headCy - headR * 0.6);
    ctx.closePath(); ctx.fill();
  }
  // アホ毛
  ctx.strokeStyle = hair; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(headCx - 2, headCy - headR - 1);
  ctx.quadraticCurveTo(headCx - 11, headCy - headR - 7, headCx - 4, headCy - headR - 11);
  ctx.stroke();
}

class Player {
  constructor(mx, my) {
    this.w = 20;
    this.hSmall = 38;
    this.hBig = 56;
    this.h = this.hSmall;
    this.x = mx + (CONFIG.TILE - this.w) / 2;
    this.y = my + CONFIG.TILE - this.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.hitWall = false;
    this.power = 'small';    // 'small' / 'big'(キノコ) / 'fire'(ファイア) / 'cape'(フェザー)
    this.invincible = 0;
    this.starTimer = 0;      // 無敵スターの残り時間(>0で無敵+触れた敵を倒す)
    this.facing = 1;
    this.dead = false;
    this.deathTimer = 0;
    this.justLanded = false; // このフレームに着地したか(着地音用)
    this.landImpact = 0;     // 着地時の落下速度(音のピッチ用)
    // パワーアップの能力
    this.airJumps = 0;       // フェザー: 残り空中ジャンプ回数
    this.fireCooldown = 0;   // ファイア: 連射クールダウン
    this.justFired = false;  // このフレームに火球を撃ったか(game側で生成)
    this.gliding = false;    // 滑空中か(描画用)
    this.onIce = false;      // 氷の床に乗っているか(滑る。game側がテーマから設定)

    // 操作感まわり
    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    // 壁ずり・壁キック
    this.wallDir = 0;        // 接している壁の向き(-1左 / +1右 / 0なし)
    this.wallSliding = false;
    this.wallKickLock = 0;   // 壁キック直後に横入力を弱める残りフレーム
    // 見た目まわり
    this.animPhase = 0;
    this.moving = false;
    this.squash = 0;
  }

  // 体の高さ方向に壁(固体タイル)が接しているか。dir: -1左 / +1右
  wallOnSide(level, dir) {
    const T = CONFIG.TILE;
    const probeX = dir > 0 ? this.x + this.w + 1 : this.x - 1;
    const c = Math.floor(probeX / T);
    const r0 = Math.floor((this.y + 4) / T);
    const r1 = Math.floor((this.y + this.h - 4) / T);
    for (let r = r0; r <= r1; r++) if (level.solidAt(c, r)) return true;
    return false;
  }

  update(level, platforms) {
    if (this.dead) {
      // 死亡演出: 上に跳ねてから画面外へ落ちる(地形は無視)
      this.deathTimer++;
      this.vy = Math.min(this.vy + CONFIG.GRAVITY, CONFIG.MAX_FALL);
      this.y += this.vy;
      return;
    }

    const prevOnGround = this.onGround;
    const prevBottom = this.y + this.h;
    this.justJumped = false;
    this.justWallKicked = false;
    this.justLanded = false;
    this.justFired = false;
    if (this.wallKickLock > 0) this.wallKickLock--;
    if (this.starTimer > 0) this.starTimer--;
    if (this.fireCooldown > 0) this.fireCooldown--;

    // ファイア: アクションキーで火球を撃つ(実際の生成はgame側、最大数もgameが判定)
    if (this.power === 'fire' && Input.actionPressed && this.fireCooldown <= 0) {
      this.justFired = true;
      this.fireCooldown = CONFIG.FIRE_COOLDOWN;
    }

    // --- 横移動(地上/空中で効きを変え、反転時はさらに強く) ---
    // 壁キック直後は横入力を弱めて、蹴った勢いを活かす
    const ctrl = this.wallKickLock > 0 ? 0.25 : 1;
    const accel = (this.onGround ? CONFIG.MOVE_ACCEL : CONFIG.AIR_ACCEL) * ctrl;
    if (Input.left) {
      const a = this.vx > 0 ? CONFIG.TURN_ACCEL * ctrl : accel;
      this.vx = Math.max(this.vx - a, -CONFIG.MOVE_SPEED);
      this.facing = -1;
    } else if (Input.right) {
      const a = this.vx < 0 ? CONFIG.TURN_ACCEL * ctrl : accel;
      this.vx = Math.min(this.vx + a, CONFIG.MOVE_SPEED);
      this.facing = 1;
    } else {
      // 氷の床(theme.tile.slippery)では摩擦を弱めて滑らせる
      const groundFric = this.onIce ? CONFIG.SLIP_FRICTION : CONFIG.GROUND_FRICTION;
      this.vx *= this.onGround ? groundFric : CONFIG.AIR_FRICTION;
      if (Math.abs(this.vx) < 0.08) this.vx = 0;
    }

    // --- 壁ずり判定(空中で、壁の方向に入力していて、落下中) ---
    this.wallDir = 0;
    if (!this.onGround) {
      if (Input.right && this.wallOnSide(level, 1)) this.wallDir = 1;
      else if (Input.left && this.wallOnSide(level, -1)) this.wallDir = -1;
    }
    this.wallSliding = this.wallDir !== 0 && this.vy > 0;

    // --- ジャンプ(コヨーテ + 先行入力 + 可変ジャンプ + 壁キック + 二段ジャンプ) ---
    if (prevOnGround) { this.coyote = CONFIG.COYOTE; this.airJumps = CONFIG.AIR_JUMPS; }
    else if (this.coyote > 0) this.coyote--;
    if (Input.jumpPressed) this.buffer = CONFIG.JUMP_BUFFER;
    else if (this.buffer > 0) this.buffer--;

    if (this.buffer > 0 && this.coyote > 0) {
      // 通常ジャンプ
      this.vy = CONFIG.JUMP_VEL;
      this.coyote = 0;
      this.buffer = 0;
      this.jumping = true;
      this.justJumped = true;
      Particles.dust(this.x + this.w / 2, this.y + this.h, 0, 4);
    } else if (this.buffer > 0 && this.wallDir !== 0 && !this.onGround) {
      // 壁キック: 壁と反対方向へ斜め上に飛ぶ
      this.vy = CONFIG.WALL_KICK_VY;
      this.vx = -this.wallDir * CONFIG.WALL_KICK_VX;
      this.facing = -this.wallDir;
      this.wallKickLock = CONFIG.WALL_KICK_LOCK;
      this.buffer = 0;
      this.jumping = true;
      this.justWallKicked = true;
      this.wallSliding = false;
      const wx = this.wallDir > 0 ? this.x + this.w : this.x;
      Particles.dust(wx, this.y + this.h * 0.5, this.wallDir, 7);
    } else if (this.buffer > 0 && !this.onGround && this.power === 'cape' && this.airJumps > 0) {
      // フェザーの二段ジャンプ(空中でもう一度)
      this.vy = CONFIG.AIR_JUMP_VEL;
      this.airJumps--;
      this.buffer = 0;
      this.jumping = true;
      this.justJumped = true;
      Particles.dust(this.x + this.w / 2, this.y + this.h, 0, 7);
    }
    // ボタンを離したら上昇を短く切る(押し続けると高く飛ぶ)
    if (this.jumping && !Input.jump && this.vy < 0) {
      this.vy *= CONFIG.JUMP_CUT;
      this.jumping = false;
    }
    if (this.vy >= 0) this.jumping = false;

    // --- 重力(落下は重め。壁ずり中はゆっくり落とす) ---
    const fallSpeed = this.vy;
    const g = this.vy > 0 ? CONFIG.FALL_GRAVITY : CONFIG.GRAVITY;
    this.vy = Math.min(this.vy + g, CONFIG.MAX_FALL);
    if (this.wallSliding && this.vy > CONFIG.WALL_SLIDE_SPEED) {
      this.vy = CONFIG.WALL_SLIDE_SPEED;
      // 壁ずりの土ぼこり
      if (this.frameTick === undefined) this.frameTick = 0;
      if (++this.frameTick % 4 === 0) {
        const wx = this.wallDir > 0 ? this.x + this.w : this.x;
        Particles.dust(wx, this.y + this.h * 0.7, this.wallDir, 1);
      }
    }
    // フェザーの滑空: 落下中にジャンプ長押しでゆっくり降りる
    this.gliding = false;
    if (this.power === 'cape' && Input.jump && !this.onGround && !this.wallSliding && this.vy > CONFIG.CAPE_GLIDE_SPEED) {
      this.vy = CONFIG.CAPE_GLIDE_SPEED;
      this.gliding = true;
    }
    moveAndCollide(this, level);

    // 動く足場への乗り判定(前フレームで足場の上面より上にいた場合のみ)
    for (const p of platforms) {
      if (this.vy >= 0 &&
          this.x + this.w > p.x && this.x < p.x + p.w &&
          prevBottom <= p.prevY + 4 && this.y + this.h >= p.y - 8) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
        this.x += p.dx;
      }
    }

    // --- 着地・歩行エフェクト ---
    if (!prevOnGround && this.onGround) {
      this.squash = 8;
      this.justLanded = true;
      this.landImpact = fallSpeed;
      if (fallSpeed > 5) Particles.dust(this.x + this.w / 2, this.y + this.h, 0, 6);
    }
    if (this.squash > 0) this.squash--;

    this.moving = (Input.left || Input.right) && Math.abs(this.vx) > 0.5;
    if (this.moving && this.onGround) {
      this.animPhase += 0.25 + Math.abs(this.vx) * 0.05;
      if (Math.random() < 0.22) Particles.dust(this.x + this.w / 2 - this.facing * 6, this.y + this.h, this.facing, 1);
    } else {
      this.animPhase = 0;
    }

    if (this.invincible > 0) this.invincible--;
  }

  // 'small' 以外は大きいサイズ(既存コードの this.big 参照を温存)
  get big() { return this.power !== 'small'; }

  // 大サイズに(まだ小さいときだけ位置を持ち上げる)
  _setBigSize() {
    if (this.h !== this.hBig) { this.y -= this.hBig - this.h; this.h = this.hBig; }
  }

  // キノコ: 小さいときだけ big に(既に強化済みなら見た目だけ弾ませる)
  grow() {
    if (this.power !== 'small') { this.squash = 10; return; }
    this.power = 'big';
    this._setBigSize();
    this.squash = 10;
  }

  // ファイア / フェザー: 上位パワーへ(常に大サイズ)
  setPower(kind) {
    this.power = kind;
    this._setBigSize();
    this.squash = 12;
  }

  shrink() {
    this.power = 'small';
    this.airJumps = 0;
    this.y += this.h - this.hSmall;
    this.h = this.hSmall;
  }

  // 無敵スターが効いているか
  starActive() { return this.starTimer > 0; }

  hurt() {
    if (this.invincible > 0 || this.starTimer > 0 || this.dead) return;
    if (this.power !== 'small') {
      this.shrink();
      this.invincible = CONFIG.INVINCIBLE_FRAMES;
      Particles.dust(this.x + this.w / 2, this.y + this.h / 2, 0, 6);
    } else {
      this.die();
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = 0;
    this.vx = 0;
    this.vy = -10;
  }

  stompBounce() {
    this.vy = Input.jump ? -10.5 : -7.5;
  }

  draw(ctx, cam, frame) {
    if (this.invincible > 0 && (frame >> 2) % 2 === 0 && !this.dead) return;

    const baseX = this.x - cam.x, baseY = this.y, w = this.w, h = this.h;
    const cx = baseX + w / 2, footY = baseY + h;

    // 無敵スター中: 色が巡る発光オーラ(残り少ないと点滅して終了を予告)
    if (this.starTimer > 0 && !this.dead) {
      const ending = this.starTimer < 90 && (frame >> 2) % 2 === 0;
      if (!ending) {
        const hue = (frame * 8) % 360;
        glow(ctx, cx, baseY + h / 2, w * 1.4, hueToRgb(hue), 0.5);
      }
    }

    if (!this.dead) softShadow(ctx, cx, footY - 1, w * 0.55, 5);

    // つぶれ・伸び(ジャンプ中は縦長、着地直後は横長)
    let sx = 1, sy = 1;
    if (this.dead) {
      sx = 1; sy = 1;
    } else if (this.squash > 0) {
      const t = this.squash / 8;
      sx = 1 + 0.22 * t;
      sy = 1 - 0.22 * t;
    } else if (this.wallSliding) {
      sx = 1.04; sy = 0.98; // 壁に押し付けられて少し縦が縮む
    } else if (!this.onGround) {
      if (this.vy < 0) { sx = 0.9; sy = 1.12; } else { sx = 0.96; sy = 1.06; }
    }
    const dw = w * sx, dh = h * sy;
    const ox = baseX - (dw - w) / 2;
    const oy = baseY + (h - dh);

    // 壁ずり中は壁の方を向く
    const faceDir = this.wallSliding ? this.wallDir : this.facing;
    const blink = !this.dead && frame % 240 < 9;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(sx, sy);
    drawHeroBody(ctx, w, h, this.power, faceDir, this.animPhase, this.moving, this.onGround, blink,
      this.wallSliding ? this.wallDir : 0, this.gliding);
    ctx.restore();
  }
}
