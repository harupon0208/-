// プレイヤー

// ヒーローの体を局所座標(0,0)〜(w,h)に描く。呼び出し側で位置・つぶれを transform 済み。
// 頭は小さめ・胴と脚を長めにして高い等身(約3頭身)に見せる。
function drawHeroBody(ctx, w, h, big, dir, animPhase, moving, onGround, blink) {
  const hw = w / 2;
  const headR = Math.max(7, Math.round(w * 0.5));
  const headCx = hw;
  const headCy = headR + 3;

  const shirt = big ? '#ec4a3a' : '#e23b2e';
  const shirtDark = big ? '#d23426' : '#c92f24';
  const denim = '#2f63c8';

  const legH = Math.round(h * 0.34);   // 脚を全身の約1/3に
  const legTop = h - legH;
  const torsoTop = headCy + headR - 2;
  const torsoH = legTop - torsoTop + 4;

  // 脚(歩行アニメで前後に振る)
  const swing = moving && onGround ? Math.sin(animPhase) * 4 : 0;
  const legW = Math.max(6, Math.round(w * 0.36));
  fillRound(ctx, hw - legW - 1 - swing, legTop, legW, legH, 4, denim);
  fillRound(ctx, hw + 1 + swing, legTop, legW, legH, 4, denim);
  // 靴
  fillRound(ctx, hw - legW - 3 - swing, h - 5, legW + 4, 5, 2, '#4a2e16');
  fillRound(ctx, hw - 1 + swing, h - 5, legW + 4, 5, 2, '#4a2e16');

  // 腕(胴の左右)
  const armH = torsoH * 0.55;
  fillRound(ctx, -1, torsoTop + 2, 5, armH, 2.5, shirt);
  fillRound(ctx, w - 4, torsoTop + 2, 5, armH, 2.5, shirt);
  fillCircle(ctx, 1.5, torsoTop + 2 + armH, 3, '#ffd9a6'); // 手
  fillCircle(ctx, w - 1.5, torsoTop + 2 + armH, 3, '#ffd9a6');

  // 胴(シャツ、縦長)
  const grad = ctx.createLinearGradient(0, torsoTop, 0, legTop);
  grad.addColorStop(0, shirt);
  grad.addColorStop(1, shirtDark);
  roundRect(ctx, 1, torsoTop, w - 2, torsoH, 6);
  ctx.fillStyle = grad;
  ctx.fill();
  // オーバーオールの胸当て
  fillRound(ctx, hw - 7, torsoTop + torsoH * 0.42, 14, torsoH * 0.58, 4, denim);
  // 肩ひも
  ctx.strokeStyle = denim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hw - 5, torsoTop + 1); ctx.lineTo(hw - 5, torsoTop + torsoH * 0.5);
  ctx.moveTo(hw + 5, torsoTop + 1); ctx.lineTo(hw + 5, torsoTop + torsoH * 0.5);
  ctx.stroke();
  // ボタン
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.arc(hw - 5, torsoTop + torsoH * 0.46, 1.8, 0, 7);
  ctx.arc(hw + 5, torsoTop + torsoH * 0.46, 1.8, 0, 7);
  ctx.fill();

  // 顔
  fillCircle(ctx, headCx, headCy, headR, '#ffd9a6');
  // ほっぺ
  ctx.fillStyle = 'rgba(255,120,110,0.45)';
  ctx.beginPath();
  ctx.arc(headCx + dir * 4, headCy + 3, 2.4, 0, 7);
  ctx.fill();
  // 目(まばたき対応)
  ctx.fillStyle = '#3a2a22';
  const ex = headCx + dir * 2.5;
  if (blink) ctx.fillRect(ex - 2, headCy - 1, 5, 1.6);
  else fillCircle(ctx, ex, headCy - 1, 2, '#3a2a22');

  // 帽子
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(headCx, headCy - 2, headR, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(headCx - headR, headCy - 3, headR * 2, 3);
  // つば(向いている方向へ)
  fillRound(ctx, dir > 0 ? headCx : headCx - headR - 3, headCy - 5, headR + 3, 4, 2, shirtDark);
  // エンブレム
  fillCircle(ctx, headCx, headCy - 6, 3, '#fff');
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
    this.big = false;
    this.invincible = 0;
    this.facing = 1;
    this.dead = false;
    this.deathTimer = 0;

    // 操作感まわり
    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    // 見た目まわり
    this.animPhase = 0;
    this.moving = false;
    this.squash = 0;
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

    // --- 横移動(地上/空中で効きを変え、反転時はさらに強く) ---
    const accel = this.onGround ? CONFIG.MOVE_ACCEL : CONFIG.AIR_ACCEL;
    if (Input.left) {
      const a = this.vx > 0 ? CONFIG.TURN_ACCEL : accel;
      this.vx = Math.max(this.vx - a, -CONFIG.MOVE_SPEED);
      this.facing = -1;
    } else if (Input.right) {
      const a = this.vx < 0 ? CONFIG.TURN_ACCEL : accel;
      this.vx = Math.min(this.vx + a, CONFIG.MOVE_SPEED);
      this.facing = 1;
    } else {
      this.vx *= this.onGround ? CONFIG.GROUND_FRICTION : CONFIG.AIR_FRICTION;
      if (Math.abs(this.vx) < 0.08) this.vx = 0;
    }

    // --- ジャンプ(コヨーテタイム + 先行入力 + 可変ジャンプ) ---
    if (prevOnGround) this.coyote = CONFIG.COYOTE;
    else if (this.coyote > 0) this.coyote--;
    if (Input.jumpPressed) this.buffer = CONFIG.JUMP_BUFFER;
    else if (this.buffer > 0) this.buffer--;

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = CONFIG.JUMP_VEL;
      this.coyote = 0;
      this.buffer = 0;
      this.jumping = true;
      Particles.dust(this.x + this.w / 2, this.y + this.h, 0, 4);
    }
    // ボタンを離したら上昇を短く切る(押し続けると高く飛ぶ)
    if (this.jumping && !Input.jump && this.vy < 0) {
      this.vy *= CONFIG.JUMP_CUT;
      this.jumping = false;
    }
    if (this.vy >= 0) this.jumping = false;

    // --- 重力(落下は重め) ---
    const fallSpeed = this.vy;
    const g = this.vy > 0 ? CONFIG.FALL_GRAVITY : CONFIG.GRAVITY;
    this.vy = Math.min(this.vy + g, CONFIG.MAX_FALL);
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

  grow() {
    if (this.big) return;
    this.big = true;
    this.y -= this.hBig - this.h;
    this.h = this.hBig;
  }

  shrink() {
    this.y += this.h - this.hSmall;
    this.h = this.hSmall;
    this.big = false;
  }

  hurt() {
    if (this.invincible > 0 || this.dead) return;
    if (this.big) {
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

    if (!this.dead) softShadow(ctx, cx, footY - 1, w * 0.55, 5);

    // つぶれ・伸び(ジャンプ中は縦長、着地直後は横長)
    let sx = 1, sy = 1;
    if (this.dead) {
      sx = 1; sy = 1;
    } else if (this.squash > 0) {
      const t = this.squash / 8;
      sx = 1 + 0.22 * t;
      sy = 1 - 0.22 * t;
    } else if (!this.onGround) {
      if (this.vy < 0) { sx = 0.9; sy = 1.12; } else { sx = 0.96; sy = 1.06; }
    }
    const dw = w * sx, dh = h * sy;
    const ox = baseX - (dw - w) / 2;
    const oy = baseY + (h - dh);

    const blink = !this.dead && frame % 240 < 9;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(sx, sy);
    drawHeroBody(ctx, w, h, this.big, this.facing, this.animPhase, this.moving, this.onGround, blink);
    ctx.restore();
  }
}
