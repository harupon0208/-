// 敵キャラ: Walker(歩行) / Speedy(高速) / Hopper(跳ね) / Boss / Projectile(ボスの弾)

class Enemy {
  constructor(mx, my, w = 26, h = 26) {
    this.w = w;
    this.h = h;
    this.x = mx + (CONFIG.TILE - w) / 2;
    this.y = my + CONFIG.TILE - h;
    this.vx = -1;
    this.vy = 0;
    this.onGround = false;
    this.hitWall = false;
    this.dead = false;     // 踏まれた(ぺちゃんこ表示中)
    this.remove = false;   // リストから消す
    this.squash = 0;
    this.active = false;   // 画面に入るまで動かない
    this.anim = 0;         // 歩行アニメ用
  }

  stomp() {
    this.dead = true;
    this.squash = 30;
    this.vx = 0;
  }

  baseUpdate(level, turnAtCliff) {
    if (this.dead) {
      if (--this.squash <= 0) this.remove = true;
      return;
    }
    if (this.onGround && turnAtCliff && cliffAhead(this, level)) this.vx = -this.vx;
    this.vy = Math.min(this.vy + CONFIG.GRAVITY, CONFIG.MAX_FALL);
    moveAndCollide(this, level);
    if (this.hitWall) this.vx = -this.vx;
    this.anim += 0.18 + Math.abs(this.vx) * 0.04;
    if (this.y > level.heightPx + 64) this.remove = true;
  }

  // 共通の描画(色は各サブクラスから指定)。丸み・影・歩行のぴょこぴょこ付き
  drawBody(ctx, cam, bodyColor, footColor, eyeColor = '#222') {
    const x = this.x - cam.x, w = this.w, h = this.h;
    const dir = this.vx >= 0 ? 1 : -1;

    if (this.dead) {
      // ぺちゃんこ
      softShadow(ctx, x + w / 2, this.y + h - 1, w * 0.5, 4);
      fillRound(ctx, x + 1, this.y + h - 8, w - 2, 8, 4, bodyColor);
      return;
    }

    const bob = Math.sin(this.anim) * 1.5;
    const y = this.y + bob;
    softShadow(ctx, x + w / 2, this.y + h - 1, w * 0.5, 4.5);

    // 足(交互にぴょこ)
    const step = Math.sin(this.anim) * 2;
    fillRound(ctx, x + 2 - step, y + h - 6, 9, 6, 3, footColor);
    fillRound(ctx, x + w - 11 + step, y + h - 6, 9, 6, 3, footColor);

    // 体(下半身は角丸の塊、頭は半円)
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, bodyColor);
    grad.addColorStop(1, shade(bodyColor, -0.18));
    fillRound(ctx, x, y + 2, w, h - 6, Math.min(8, w / 2), '#000');
    roundRect(ctx, x, y + 2, w, h - 6, Math.min(8, w / 2));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    ctx.fillStyle = bodyColor;
    ctx.fill();

    // 目(白目 + 黒目を進行方向へ)
    const ec = x + w / 2 + dir * 3;
    fillCircle(ctx, ec - 6, y + 9, 5, '#fff');
    fillCircle(ctx, ec + 6, y + 9, 5, '#fff');
    fillCircle(ctx, ec - 6 + dir * 2, y + 9, 2.4, eyeColor);
    fillCircle(ctx, ec + 6 + dir * 2, y + 9, 2.4, eyeColor);
    // 眉(おこり顔)
    ctx.strokeStyle = shade(bodyColor, -0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ec - 9, y + 3); ctx.lineTo(ec - 3, y + 6);
    ctx.moveTo(ec + 9, y + 3); ctx.lineTo(ec + 3, y + 6);
    ctx.stroke();
  }
}

// 16進カラーを明暗調整する(amt<0で暗く)
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = amt < 0 ? 1 + amt : 1;
  const add = amt < 0 ? 0 : 255 * amt;
  const r = Math.round((((n >> 16) & 255) * f) + add);
  const g = Math.round((((n >> 8) & 255) * f) + add);
  const b = Math.round(((n & 255) * f) + add);
  const c = (v) => Math.max(0, Math.min(255, v));
  return `#${((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1)}`;
}

class Walker extends Enemy {
  constructor(mx, my) {
    super(mx, my);
    this.vx = -1;
  }
  update(level) { this.baseUpdate(level, true); }
  draw(ctx, cam) { this.drawBody(ctx, cam, '#8a5a2b', '#4a3015'); }
}

class Speedy extends Enemy {
  constructor(mx, my) {
    super(mx, my);
    this.vx = -2.2;
  }
  update(level) { this.baseUpdate(level, false); }
  draw(ctx, cam) { this.drawBody(ctx, cam, '#d4452c', '#7a2415'); }
}

class Hopper extends Enemy {
  constructor(mx, my) {
    super(mx, my, 24, 26);
    this.vx = 0;
    this.cool = 30;
  }

  update(level, player) {
    if (this.dead) {
      if (--this.squash <= 0) this.remove = true;
      return;
    }
    if (this.onGround) {
      this.vx = 0;
      if (--this.cool <= 0) {
        const dir = player && !player.dead ? Math.sign(player.x - this.x) || 1 : 1;
        this.vy = -8.5;
        this.vx = 1.8 * dir;
        this.cool = 50;
      }
    }
    this.vy = Math.min(this.vy + CONFIG.GRAVITY, CONFIG.MAX_FALL);
    moveAndCollide(this, level);
    if (this.hitWall) this.vx = -this.vx;
    this.anim += this.onGround ? 0.4 : 0.12;
    if (this.y > level.heightPx + 64) this.remove = true;
  }

  draw(ctx, cam) { this.drawBody(ctx, cam, '#2eb24f', '#1a6c30'); }
}

// ワールド別ボスの差分(tier 1=W1既存 / 2=W2氷 / 3=W3魔界)
const BOSS_TIERS = {
  1: { hp: 3, walk: 1.2, walkLow: 1.8, jumpVel: -12, jumpDash: 2.5, jumpInt: 140, jumpIntLow: 90,
       baseShots: 1, shotCap: 3, spread: 1.2, downShots: false,
       body: ['#9a52d6', '#5c2d80'], horn: '#3c1c55', eye: '#e6362a', horns: 2, name: '魔王' },
  2: { hp: 4, walk: 1.6, walkLow: 2.4, jumpVel: -12.5, jumpDash: 3.0, jumpInt: 115, jumpIntLow: 75,
       baseShots: 2, shotCap: 4, spread: 1.5, downShots: false,
       body: ['#67d0ec', '#2a6f9a'], horn: '#bfeaff', eye: '#2f6fff', horns: 2, name: '氷帝' },
  3: { hp: 5, walk: 2.0, walkLow: 2.8, jumpVel: -13, jumpDash: 3.4, jumpInt: 95, jumpIntLow: 60,
       baseShots: 3, shotCap: 5, spread: 1.8, downShots: true,
       body: ['#c0453d', '#3a0e0e'], horn: '#180808', eye: '#ffd24a', horns: 3, name: '冥王' },
};

class Boss {
  constructor(mx, my, tier = 1) {
    this.tier = tier;
    const t = BOSS_TIERS[tier] || BOSS_TIERS[1];
    this.cfg = t;
    this.w = 56;
    this.h = 60;
    this.x = mx;
    this.y = my + CONFIG.TILE - this.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.hitWall = false;
    this.maxHp = t.hp;
    this.hp = t.hp;
    this.invincible = 0;
    this.dead = false;
    this.deadTimer = 0;
    this.jumpTimer = t.jumpInt;
    this.didJump = false;
  }

  // HPが半分以下で怒り(動きと弾が激化)
  get enraged() { return this.hp <= Math.floor(this.maxHp / 2); }

  update(level, player, projectiles) {
    if (this.dead) {
      this.deadTimer++;
      return;
    }
    if (this.invincible > 0) this.invincible--;
    const t = this.cfg;
    const enraged = this.enraged;
    const dir = Math.sign(player.x + player.w / 2 - (this.x + this.w / 2)) || 1;

    if (this.onGround) {
      this.vx = dir * (enraged ? t.walkLow : t.walk);
      if (--this.jumpTimer <= 0) {
        this.vy = t.jumpVel;
        this.vx = dir * t.jumpDash;
        this.jumpTimer = enraged ? t.jumpIntLow : t.jumpInt;
        this.didJump = true;
      }
    }
    const wasAirborne = !this.onGround;
    this.vy = Math.min(this.vy + CONFIG.GRAVITY, CONFIG.MAX_FALL);
    moveAndCollide(this, level);
    if (this.hitWall) this.vx = 0;

    // 着地した瞬間に弾を発射(HPが減るほど扇状に増える)
    if (wasAirborne && this.onGround && this.didJump) {
      this.didJump = false;
      const n = Math.min(t.shotCap, t.baseShots + (this.maxHp - this.hp));
      const cx = this.x + this.w / 2, cy = this.y + 20;
      for (let i = 0; i < n; i++) {
        const vy = n === 1 ? 0 : (i - (n - 1) / 2) * t.spread;
        projectiles.push(new Projectile(cx, cy, 4 * dir, vy));
      }
      // tier3: 斜め下に降り注ぐ追加弾
      if (t.downShots) {
        projectiles.push(new Projectile(cx, cy, 2.5 * dir, 3));
        projectiles.push(new Projectile(cx, cy, -2.5 * dir, 3));
      }
    }
  }

  // 踏まれた。実際にダメージが入ったら true
  hit() {
    if (this.invincible > 0 || this.dead) return false;
    this.hp--;
    this.invincible = 60;
    if (this.hp <= 0) this.dead = true;
    return true;
  }

  draw(ctx, cam, frame) {
    if (this.dead && this.deadTimer % 8 < 4) return;
    if (!this.dead && this.invincible > 0 && (frame >> 2) % 2 === 0) return;
    const t = this.cfg;
    const x = this.x - cam.x, y = this.y, w = this.w, h = this.h;
    const dir = Math.sign(this.vx) || 1;

    softShadow(ctx, x + w / 2, y + h - 1, w * 0.5, 6);

    // ツノ(tierで本数・色が変わる)
    ctx.fillStyle = t.horn;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 12); ctx.lineTo(x + 14, y - 10); ctx.lineTo(x + 24, y + 12);
    ctx.moveTo(x + w - 24, y + 12); ctx.lineTo(x + w - 14, y - 10); ctx.lineTo(x + w - 6, y + 12);
    if (t.horns >= 3) { ctx.moveTo(x + w / 2 - 7, y + 8); ctx.lineTo(x + w / 2, y - 18); ctx.lineTo(x + w / 2 + 7, y + 8); }
    ctx.fill();

    // 体(角丸 + 縦グラデ)
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, t.body[0]);
    grad.addColorStop(1, t.body[1]);
    roundRect(ctx, x, y + 4, w, h - 4, 14);
    ctx.fillStyle = grad;
    ctx.fill();
    // お腹のハイライト
    fillRound(ctx, x + 10, y + h - 26, w - 20, 18, 8, 'rgba(255,255,255,0.12)');

    // 目(白目 + 瞳を進行方向へ)
    fillCircle(ctx, x + 18, y + 24, 9, '#fff');
    fillCircle(ctx, x + w - 18, y + 24, 9, '#fff');
    fillCircle(ctx, x + 18 + dir * 3, y + 25, 4, t.eye);
    fillCircle(ctx, x + w - 18 + dir * 3, y + 25, 4, t.eye);
    // 怒り眉
    ctx.strokeStyle = t.horn;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 14); ctx.lineTo(x + 25, y + 20);
    ctx.moveTo(x + w - 9, y + 14); ctx.lineTo(x + w - 25, y + 20);
    ctx.stroke();
    // 口(ギザギザの歯)
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 13 + i * 9, y + 40);
      ctx.lineTo(x + 17.5 + i * 9, y + 48);
      ctx.lineTo(x + 22 + i * 9, y + 40);
      ctx.fill();
    }

    // HPバー(maxHpぶん)
    const barW = this.maxHp * 18;
    for (let i = 0; i < this.maxHp; i++) {
      fillRound(ctx, x + (w - barW) / 2 + i * 18, y - 22, 14, 8, 3,
        i < this.hp ? '#ff4757' : 'rgba(0,0,0,0.35)');
    }
  }
}

class Projectile {
  constructor(x, y, vx, vy) {
    this.w = 14;
    this.h = 14;
    this.x = x - 7;
    this.y = y - 7;
    this.vx = vx;
    this.vy = vy;
    this.t = 0;
    this.remove = false;
  }

  update(level) {
    this.x += this.vx;
    this.y += this.vy;
    const c = Math.floor((this.x + 7) / CONFIG.TILE);
    const r = Math.floor((this.y + 7) / CONFIG.TILE);
    if (level.solidAt(c, r) || ++this.t > 300) this.remove = true;
  }

  draw(ctx, cam, frame) {
    const x = this.x - cam.x + 7, y = this.y + 7;
    const pulse = frame % 6 < 3 ? 1 : 0;
    // 光彩
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 13);
    glow.addColorStop(0, 'rgba(255,160,40,0.6)');
    glow.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    fillCircle(ctx, x, y, 7 + pulse, '#ff7b1c');
    fillCircle(ctx, x, y, 3.5, '#ffe066');
  }
}
