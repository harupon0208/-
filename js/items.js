// キノコ・ゴール旗・動く足場

class Mushroom {
  constructor(mx, my) {
    this.w = 24;
    this.h = 24;
    this.x = mx + 4;
    this.y = my + CONFIG.TILE - this.h;
    this.vx = -1;
    this.vy = 0;
    this.onGround = false;
    this.hitWall = false;
    this.dead = false;
  }

  update(level) {
    // 崖で反転(足場の上に置いたキノコが逃げないように)
    if (this.onGround && cliffAhead(this, level)) this.vx = -this.vx;
    this.vy = Math.min(this.vy + CONFIG.GRAVITY, CONFIG.MAX_FALL);
    moveAndCollide(this, level);
    if (this.hitWall) this.vx = -this.vx;
    if (this.y > level.heightPx) this.dead = true;
  }

  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y;
    softShadow(ctx, x + 12, y + 24, 11, 3.5);
    // 軸
    fillRound(ctx, x + 6, y + 11, 12, 14, 4, '#fff2dd');
    fillCircle(ctx, x + 9, y + 18, 1.6, '#e9c9a0');
    fillCircle(ctx, x + 15, y + 20, 1.6, '#e9c9a0');
    // かさ(グラデ)
    const grad = ctx.createLinearGradient(0, y, 0, y + 14);
    grad.addColorStop(0, '#ff5b4d');
    grad.addColorStop(1, '#e02d22');
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 12, Math.PI, 0);
    ctx.fillStyle = grad;
    ctx.fill();
    roundRect(ctx, x, y + 10, 24, 4, 2);
    ctx.fill();
    // 白い斑点 + ツヤ
    fillCircle(ctx, x + 6, y + 7, 3, '#fff');
    fillCircle(ctx, x + 17, y + 7, 3.4, '#fff');
    fillCircle(ctx, x + 12, y + 4, 2.4, '#fff');
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x + 8, y + 6, 5, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
  }
}

// 収集コイン: その場で回転するだけ(物理なし)。100枚で残機+1
class Coin {
  constructor(mx, my) {
    const T = CONFIG.TILE;
    this.w = 18;
    this.h = 18;
    this.x = mx + (T - this.w) / 2;
    this.y = my + (T - this.h) / 2;
    this.dead = false;
    this.spin = (mx + my) * 0.01; // 位置でズラして一斉回転を避ける
  }

  update() { this.spin += 0.12; }

  draw(ctx, cam) {
    const cx = this.x - cam.x + this.w / 2;
    const cy = this.y + this.h / 2 + Math.sin(this.spin * 0.6) * 1.5; // ふわふわ
    const sx = Math.abs(Math.cos(this.spin));                        // 回転で横幅が縮む
    const rw = Math.max(2, this.w / 2 * sx);
    // 縁(濃い金) → 表面(明るい金)
    fillCircleScaled(ctx, cx, cy, rw, this.h / 2, '#b8860b');
    fillCircleScaled(ctx, cx, cy, rw * 0.78, this.h / 2 * 0.82, '#ffd24a');
    // 中央の刻印(細いとき=横向きは省略)
    if (sx > 0.35) {
      ctx.fillStyle = 'rgba(180,120,10,0.8)';
      ctx.fillRect(cx - rw * 0.18, cy - this.h / 2 * 0.45, rw * 0.36, this.h * 0.45);
    }
    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx - rw * 0.35, cy - this.h * 0.22, Math.max(1, rw * 0.22), this.h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 縦横でつぶした楕円を塗る小ヘルパー(コインの回転表現用)
function fillCircleScaled(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 無敵スター: 地面で跳ね、壁で反転し、穴に落ちると消える。取ると一定時間の無敵状態になる
class Star {
  constructor(mx, my) {
    const T = CONFIG.TILE;
    this.w = 24;
    this.h = 24;
    this.x = mx + (T - this.w) / 2;
    this.y = my + T - this.h;
    this.vx = 1.6;
    this.vy = -6;
    this.onGround = false;
    this.hitWall = false;
    this.dead = false;
    this.spin = 0;
  }

  update(level) {
    this.vy = Math.min(this.vy + CONFIG.GRAVITY, CONFIG.MAX_FALL);
    moveAndCollide(this, level);
    if (this.onGround) this.vy = -7;       // 着地で弾む
    if (this.hitWall) this.vx = -this.vx;  // 壁で反転
    this.spin += 0.18;
    if (this.y > level.heightPx) this.dead = true;
  }

  draw(ctx, cam) {
    const cx = this.x - cam.x + this.w / 2, cy = this.y + this.h / 2;
    glow(ctx, cx, cy, 20, '255,230,120', 0.6);
    drawStarShape(ctx, cx, cy, this.w / 2, this.w / 4, this.spin, '#ffe14a', '#ffb300');
    // 目(にっこり)
    ctx.fillStyle = '#5a3a10';
    fillCircle(ctx, cx - 3.5, cy - 1, 1.6, '#5a3a10');
    fillCircle(ctx, cx + 3.5, cy - 1, 1.6, '#5a3a10');
  }
}

// 5本角の星形を塗る(縁取り付き)。outerR/innerR=外/内半径, rot=回転
function drawStarShape(ctx, cx, cy, outerR, innerR, rot, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

// 中間チェックポイント: 触れると復活地点になる。未通過は灰、通過後は緑の旗
class Checkpoint {
  constructor(mx, my) {
    const T = CONFIG.TILE;
    this.poleH = T * 3;
    this.x = mx + 12;
    this.y = my + T - this.poleH;
    this.w = 10;
    this.h = this.poleH;
    this.active = false;
    this.wavePhase = 0;
  }

  // プレイヤーが復活する位置(ポールの足元・タイル基準)
  respawnX() { return this.x - 6; }
  respawnTop() { return this.y + this.poleH - CONFIG.TILE; }

  draw(ctx, cam, frame) {
    const x = this.x - cam.x, y = this.y;
    // ポール
    const pg = ctx.createLinearGradient(x, 0, x + this.w, 0);
    pg.addColorStop(0, '#cfd6dd');
    pg.addColorStop(0.5, '#fff');
    pg.addColorStop(1, '#9aa3ad');
    roundRect(ctx, x + 2, y, 5, this.h, 2.5);
    ctx.fillStyle = pg;
    ctx.fill();
    fillCircle(ctx, x + 4.5, y - 2, 5, this.active ? '#ffd24a' : '#b8c0c8');
    // 旗(通過後はゆれる緑、未通過は垂れた灰)
    if (this.active) {
      this.wavePhase += 0.12;
      const wave = Math.sin(this.wavePhase) * 3;
      const grad = ctx.createLinearGradient(x + 7, 0, x + 34, 0);
      grad.addColorStop(0, '#46d06a');
      grad.addColorStop(1, '#26a050');
      ctx.beginPath();
      ctx.moveTo(x + 7, y + 6);
      ctx.lineTo(x + 32 + wave, y + 15);
      ctx.lineTo(x + 7, y + 24);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(150,160,170,0.85)';
      ctx.beginPath();
      ctx.moveTo(x + 7, y + 8);
      ctx.lineTo(x + 22, y + 14);
      ctx.lineTo(x + 9, y + 26);
      ctx.closePath();
      ctx.fill();
    }
  }
}

class Flag {
  constructor(mx, my) {
    const T = CONFIG.TILE;
    this.poleH = 160; // 5タイルぶん
    this.x = mx + 10;
    this.y = my + T - this.poleH;
    this.w = 12;
    this.h = this.poleH;
  }

  draw(ctx, cam, frame) {
    const x = this.x - cam.x, y = this.y;
    // ポール(金属っぽいグラデ)
    const pg = ctx.createLinearGradient(x + 3, 0, x + 9, 0);
    pg.addColorStop(0, '#e8e8e8');
    pg.addColorStop(0.5, '#fff');
    pg.addColorStop(1, '#a8a8a8');
    roundRect(ctx, x + 3, y, 6, this.h, 3);
    ctx.fillStyle = pg;
    ctx.fill();
    // てっぺんの玉
    fillCircle(ctx, x + 6, y - 2, 7, '#ffd24a');
    fillCircle(ctx, x + 4, y - 4, 2.2, '#fff6c8');
    // 旗(ゆらゆら、★入り)
    const wave = Math.sin(frame * 0.08) * 4;
    const grad = ctx.createLinearGradient(x + 9, 0, x + 48, 0);
    grad.addColorStop(0, '#3fd06a');
    grad.addColorStop(1, '#22a04c');
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 8);
    ctx.lineTo(x + 48 + wave, y + 20);
    ctx.lineTo(x + 9, y + 32);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    fillCircle(ctx, x + 24, y + 20, 4, 'rgba(255,255,255,0.85)');
  }
}

class MovingPlatform {
  constructor(mx, my, axis) {
    const T = CONFIG.TILE;
    this.w = T * 3;
    this.h = 14;
    this.axis = axis;
    this.baseX = mx;
    this.baseY = my + (T - this.h) / 2;
    // 横は振幅3タイル、縦は2タイル(マップ側の隙間設計と対応)
    this.amp = axis === 'h' ? T * 3 : T * 2;
    this.speed = axis === 'h' ? 0.022 : 0.018;
    this.t = 0;
    this.x = this.baseX;
    this.y = this.baseY;
    this.prevX = this.x;
    this.prevY = this.y;
    this.dx = 0;
    this.dy = 0;
  }

  update() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.t += this.speed;
    const off = Math.sin(this.t) * this.amp;
    if (this.axis === 'h') this.x = this.baseX + off;
    else this.y = this.baseY + off;
    this.dx = this.x - this.prevX;
    this.dy = this.y - this.prevY;
  }

  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y;
    softShadow(ctx, x + this.w / 2, y + this.h + 2, this.w * 0.45, 4);
    const grad = ctx.createLinearGradient(0, y, 0, y + this.h);
    grad.addColorStop(0, '#c89154');
    grad.addColorStop(1, '#8a5a30');
    fillRound(ctx, x, y, this.w, this.h, 6, '#000');
    roundRect(ctx, x, y, this.w, this.h, 6);
    ctx.fillStyle = grad;
    ctx.fill();
    // 上面のツヤ
    fillRound(ctx, x + 3, y + 2, this.w - 6, 4, 2, 'rgba(255,255,255,0.35)');
    // ボルト
    ctx.fillStyle = '#5a3a20';
    for (let i = 0; i < 3; i++) fillCircle(ctx, x + 14 + i * 32, y + this.h / 2 + 1, 2, '#5a3a20');
  }
}

// ファイアフラワー: 取ると火球を撃てる(power='fire')。その場で揺れる花
class FireFlower {
  constructor(mx, my) {
    const T = CONFIG.TILE;
    this.w = 24;
    this.h = 26;
    this.x = mx + (T - this.w) / 2;
    this.y = my + T - this.h;
    this.dead = false;
    this.t = Math.random() * 6;
  }

  update() { this.t += 0.1; }

  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y;
    const sway = Math.sin(this.t) * 1.5;
    softShadow(ctx, x + 12, y + 26, 9, 3);
    // 茎
    ctx.strokeStyle = '#2f9b46';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 26);
    ctx.quadraticCurveTo(x + 12 + sway, y + 16, x + 12 + sway, y + 12);
    ctx.stroke();
    // 葉
    ctx.fillStyle = '#37b052';
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 18, 5, 2.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // 花びら(オレンジ→赤の6枚)
    const fx = x + 12 + sway, fy = y + 8;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.t * 0.2;
      fillCircle(ctx, fx + Math.cos(a) * 7, fy + Math.sin(a) * 7, 4, i % 2 ? '#ff8a2a' : '#ff5a3a');
    }
    // 中心
    fillCircle(ctx, fx, fy, 4.5, '#ffe14a');
    fillCircle(ctx, fx - 1.2, fy - 1.2, 1.6, '#fff7c8');
  }
}

// フェザー: 取ると二段ジャンプ+滑空(power='cape')。ふわふわ漂う羽根
class Feather {
  constructor(mx, my) {
    const T = CONFIG.TILE;
    this.w = 22;
    this.h = 26;
    this.x = mx + (T - this.w) / 2;
    this.y = my + T - this.h;
    this.dead = false;
    this.t = Math.random() * 6;
  }

  update() { this.t += 0.08; }

  draw(ctx, cam) {
    const cx = this.x - cam.x + this.w / 2;
    const cy = this.y + this.h / 2 + Math.sin(this.t) * 2.5;
    const tilt = Math.sin(this.t * 0.7) * 0.3;
    softShadow(ctx, cx, this.y + this.h + 1, 8, 3);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    // 羽根本体(白〜緑)
    ctx.fillStyle = '#eafff0';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.quadraticCurveTo(8, -2, 4, 12);
    ctx.quadraticCurveTo(0, 8, -4, 12);
    ctx.quadraticCurveTo(-8, -2, 0, -13);
    ctx.closePath();
    ctx.fill();
    // 羽軸
    ctx.strokeStyle = '#2fa84f';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(0, 11);
    ctx.stroke();
    ctx.restore();
  }
}

// プレイヤーの火球: 重力で弾み、壁で消え、敵に当たると撃破
class Fireball {
  constructor(x, y, dir) {
    this.w = 12;
    this.h = 12;
    this.x = x - 6;
    this.y = y - 6;
    this.vx = CONFIG.FIRE_SPEED * dir;
    this.vy = 2;
    this.onGround = false;
    this.hitWall = false;
    this.remove = false;
    this.t = 0;
    this.spin = 0;
  }

  update(level) {
    this.vy = Math.min(this.vy + CONFIG.GRAVITY, CONFIG.MAX_FALL);
    moveAndCollide(this, level);
    if (this.onGround) this.vy = CONFIG.FIRE_BOUNCE; // 地面で弾む
    if (this.hitWall) this.remove = true;            // 壁に当たったら消える
    this.spin += 0.6;
    if (++this.t > 200 || this.y > level.heightPx) this.remove = true;
  }

  draw(ctx, cam) {
    const cx = this.x - cam.x + this.w / 2, cy = this.y + this.h / 2;
    glow(ctx, cx, cy, 14, '255,140,40', 0.7);
    fillCircle(ctx, cx, cy, 6, '#ff7b1c');
    // 内側の渦(回転)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.spin);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }
}

// バネ: 上から踏むと高く跳ねる
class Spring {
  constructor(mx, my) {
    const T = CONFIG.TILE;
    this.w = T - 6;
    this.h = 16;
    this.x = mx + 3;
    this.y = my + T - this.h;
    this.compress = 0;
  }

  bounce() { this.compress = 10; }
  update() { if (this.compress > 0) this.compress--; }

  // 上面のy(踏み判定用、縮み中は下がる)
  topY() { return this.y + (this.compress > 0 ? 6 : 0); }

  draw(ctx, cam) {
    const x = this.x - cam.x;
    const c = this.compress / 10;
    const baseY = this.y + this.h;
    const topY = this.topY();
    softShadow(ctx, x + this.w / 2, baseY + 1, this.w * 0.5, 3);
    // コイル(ジグザグ)
    ctx.strokeStyle = '#b8b8c0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const coils = 3;
    for (let i = 0; i <= coils; i++) {
      const yy = topY + 5 + (baseY - 6 - (topY + 5)) * (i / coils);
      ctx.lineTo(x + (i % 2 ? this.w - 3 : 3), yy);
    }
    ctx.stroke();
    // 底板・天板
    fillRound(ctx, x - 1, baseY - 4, this.w + 2, 4, 2, '#6a6a74');
    fillRound(ctx, x - 2, topY, this.w + 4, 6, 3, c > 0 ? '#e05a4a' : '#e0392c');
    fillRound(ctx, x, topY + 1, this.w, 2, 1, 'rgba(255,255,255,0.4)');
  }
}

// 崩れる足場: 乗ると揺れ→落下/消滅→一定時間で復活
class CrumblingPlatform {
  constructor(mx, my) {
    const T = CONFIG.TILE;
    this.w = T;
    this.h = 16;
    this.x = mx;
    this.y = my + (T - this.h) / 2;
    this.state = 'idle';   // idle / shaking / gone
    this.timer = 0;
    this.shakeX = 0;
  }

  get solid() { return this.state === 'idle' || this.state === 'shaking'; }

  // プレイヤーが乗った
  stepOn() {
    if (this.state === 'idle') { this.state = 'shaking'; this.timer = CONFIG.CRUMBLE_DELAY; return true; }
    return false;
  }

  update() {
    if (this.state === 'shaking') {
      this.shakeX = Math.sin(this.timer * 0.9) * 2;
      if (--this.timer <= 0) { this.state = 'gone'; this.timer = CONFIG.CRUMBLE_RESPAWN; }
    } else if (this.state === 'gone') {
      if (--this.timer <= 0) { this.state = 'idle'; this.shakeX = 0; }
    }
  }

  draw(ctx, cam) {
    const x = this.x - cam.x + this.shakeX, y = this.y;
    if (this.state === 'gone') {
      // 復活待ち: 薄い輪郭だけ
      ctx.strokeStyle = 'rgba(180,150,120,0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      roundRect(ctx, x, y, this.w, this.h, 4);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    softShadow(ctx, x + this.w / 2, y + this.h + 1, this.w * 0.42, 3);
    const grad = ctx.createLinearGradient(0, y, 0, y + this.h);
    grad.addColorStop(0, '#b89a6a');
    grad.addColorStop(1, '#7c5e38');
    fillRound(ctx, x, y, this.w, this.h, 4, '#000');
    roundRect(ctx, x, y, this.w, this.h, 4);
    ctx.fillStyle = grad;
    ctx.fill();
    // ひび(崩れかけは濃く)
    ctx.strokeStyle = this.state === 'shaking' ? 'rgba(40,20,10,0.7)' : 'rgba(40,20,10,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + this.w * 0.3, y); ctx.lineTo(x + this.w * 0.45, y + this.h);
    ctx.moveTo(x + this.w * 0.7, y + this.h); ctx.lineTo(x + this.w * 0.6, y);
    ctx.stroke();
  }
}

// 大砲: 一定間隔で弾(Projectile)をその向きへ撃つ
class Cannon {
  constructor(mx, my, dir) {
    const T = CONFIG.TILE;
    this.w = T;
    this.h = T;
    this.x = mx;
    this.y = my;
    this.dir = dir; // +1右 / -1左
    this.timer = (Math.random() * CONFIG.CANNON_INTERVAL) | 0;
    this.flash = 0;
  }

  // 発射したら true(game側で弾を push・音を鳴らす)
  update(projectiles) {
    if (this.flash > 0) this.flash--;
    if (--this.timer <= 0) {
      this.timer = CONFIG.CANNON_INTERVAL;
      this.flash = 8;
      const mx = this.x + this.w / 2 + this.dir * (this.w / 2 - 2);
      const my = this.y + this.h / 2;
      projectiles.push(new Projectile(mx, my, 4 * this.dir, 0));
      return true;
    }
    return false;
  }

  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y, T = CONFIG.TILE;
    // 台座
    fillRound(ctx, x + 4, y + 10, T - 8, T - 10, 5, '#3a3f4a');
    // 砲身(向き)
    const bx = this.dir > 0 ? x + T / 2 : x;
    const grad = ctx.createLinearGradient(0, y + 4, 0, y + 22);
    grad.addColorStop(0, '#6a7280');
    grad.addColorStop(1, '#3a3f4a');
    fillRound(ctx, bx, y + 6, T / 2, 16, 5, '#000');
    roundRect(ctx, bx, y + 6, T / 2, 16, 5);
    ctx.fillStyle = grad;
    ctx.fill();
    // 発射の閃光
    if (this.flash > 0) {
      const fx = this.dir > 0 ? x + T : x;
      glow(ctx, fx, y + 14, 16, '255,180,80', this.flash / 8 * 0.8);
    }
  }
}
