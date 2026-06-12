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

// 加算合成のソフトな発光。color は 'r,g,b'
function glow(ctx, x, y, r, color, alpha = 0.6) {
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
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

  // 上にふわっと上がるスコア文字
  popup(x, y, text, color = '255,255,255') {
    this.list.push({ type: 'popup', x, y, vy: -1.1, text, color, life: 46, max: 46 });
  },

  // 爆発状のきらめき(加算発光)
  burst(x, y, color = '255,200,80', n = 16, spd = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.4 + Math.random() * 0.8);
      this.list.push({
        type: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        g: 0.06, r: 2 + Math.random() * 2.4,
        life: 24 + Math.random() * 16, max: 40, color,
      });
    }
  },

  // 打ち上げ花火(複数色)
  firework(x, y) {
    const cols = ['255,120,120', '255,230,120', '120,220,255', '180,255,150', '255,180,240'];
    this.burst(x, y, cols[(Math.random() * cols.length) | 0], 22, 5);
  },

  // 広がる衝撃波のリング
  shock(x, y, color = '255,255,255') {
    this.list.push({ type: 'shock', x, y, r: 6, grow: 3.4, life: 18, max: 18, color });
  },

  update() {
    for (const p of this.list) {
      if (p.type === 'shock') { p.r += p.grow; p.grow *= 0.92; p.life--; continue; }
      if (p.type === 'popup') { p.y += p.vy; p.vy *= 0.9; p.life--; continue; }
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
      } else if (p.type === 'spark') {
        glow(ctx, x, y, p.r * 4, p.color, a * 0.8);
        fillCircle(ctx, x, y, p.r * a, `rgba(${p.color},${a.toFixed(3)})`);
      } else if (p.type === 'shock') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${p.color},${(a * 0.7).toFixed(3)})`;
        ctx.lineWidth = 3 * a + 1;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.type === 'popup') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeText(p.text, x, y);
        ctx.fillStyle = `rgb(${p.color})`;
        ctx.fillText(p.text, x, y);
        ctx.restore();
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
