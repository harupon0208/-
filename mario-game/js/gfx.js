// 描画ヘルパー + パーティクル(土ぼこり・キラキラ)
// 今風の丸み・影・エフェクトをまとめて担当する。

// 角丸の矩形パスを作る
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRound(ctx, x, y, w, h, r, color) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function fillCircle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// 接地点の下に敷くやわらかい楕円の影
function softShadow(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// パーティクルの単一プール(Input と同じくグローバルなシングルトン)
const Particles = {
  list: [],

  // 着地・ダッシュ時の土ぼこり
  dust(x, y, dir = 0, n = 5) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        type: 'dust',
        x, y,
        vx: (Math.random() - 0.5) * 1.6 - dir * 0.5,
        vy: -Math.random() * 1.4 - 0.2,
        g: 0.05,
        r: 2 + Math.random() * 2.5,
        life: 16 + Math.random() * 10,
        max: 26,
        color: '230,224,205',
      });
    }
  },

  // 敵を踏んだ/アイテム取得などのキラキラ
  sparkle(x, y, color = '255,221,90', n = 11) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.6 + Math.random() * 2.8;
      this.list.push({
        type: 'star',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 1.2,
        g: 0.13,
        r: 2 + Math.random() * 2,
        life: 20 + Math.random() * 12,
        max: 32,
        color,
      });
    }
  },

  update() {
    for (const p of this.list) {
      p.vy += p.g;
      p.vx *= 0.96;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    }
    this.list = this.list.filter((p) => p.life > 0);
  },

  draw(ctx, cam) {
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      const x = p.x - cam.x, y = p.y;
      if (p.type === 'dust') {
        ctx.fillStyle = `rgba(${p.color},${(a * 0.7).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.r * (0.6 + a * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.life * 0.3);
        ctx.fillStyle = `rgba(${p.color},${a.toFixed(3)})`;
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      }
    }
  },

  clear() { this.list.length = 0; },
};
