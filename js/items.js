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
