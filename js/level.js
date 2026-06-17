// タイルマップのパース・描画・当たり判定

class Level {
  constructor(data) {
    const T = CONFIG.TILE;
    this.name = data.name;
    this.rows = data.map.length;
    this.cols = Math.max(...data.map.map((r) => r.length));
    this.tiles = [];
    this.spawns = {
      player: { x: T, y: 0 }, enemies: [], items: [], coins: [], stars: [], checkpoints: [],
      fireFlowers: [], feathers: [], springs: [], crumbles: [], cannons: [],
      platforms: [], flag: null, boss: null,
    };

    for (let r = 0; r < this.rows; r++) {
      const line = data.map[r];
      const tileRow = [];
      for (let c = 0; c < this.cols; c++) {
        const ch = line[c] || '.';
        const x = c * T, y = r * T;
        // タイルに残す記号: 固体(# =) と 非固体マーカー(x ハザード / w 風)
        if (ch === '#' || ch === '=' || ch === 'x' || ch === 'w') {
          tileRow.push(ch);
          continue;
        }
        switch (ch) {
          case 'P': this.spawns.player = { x, y }; break;
          case 'G': this.spawns.flag = { x, y }; break;
          case '*': this.spawns.items.push({ x, y }); break;
          case 'o': this.spawns.coins.push({ x, y }); break;
          case 's': this.spawns.stars.push({ x, y }); break;
          case 'C': this.spawns.checkpoints.push({ x, y }); break;
          case 'F': this.spawns.fireFlowers.push({ x, y }); break;
          case 'V': this.spawns.feathers.push({ x, y }); break;
          case '^': this.spawns.springs.push({ x, y }); break;
          case ':': this.spawns.crumbles.push({ x, y }); break;
          case '>': this.spawns.cannons.push({ x, y, dir: 1 }); break;
          case '<': this.spawns.cannons.push({ x, y, dir: -1 }); break;
          case 'e': case 'f': case 'j': this.spawns.enemies.push({ x, y, type: ch }); break;
          case '-': this.spawns.platforms.push({ x, y, axis: 'h' }); break;
          case '|': this.spawns.platforms.push({ x, y, axis: 'v' }); break;
          case 'B': this.spawns.boss = { x, y }; break;
        }
        tileRow.push('.');
      }
      this.tiles.push(tileRow);
    }
    this.widthPx = this.cols * T;
    this.heightPx = this.rows * T;
  }

  // マップ左右の外は壁、上下の外は空(上に飛び出せる・穴に落ちられる)
  solidAt(c, r) {
    if (c < 0 || c >= this.cols) return true;
    if (r < 0 || r >= this.rows) return false;
    const t = this.tiles[r][c];
    return t === '#' || t === '=';
  }

  // ハザード(トゲ/溶岩。触れるとダメージ)
  hazardAt(c, r) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
    return this.tiles[r][c] === 'x';
  }

  // 風(上昇気流の列)
  windAt(c, r) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
    return this.tiles[r][c] === 'w';
  }

  draw(ctx, cam, theme) {
    const T = CONFIG.TILE;
    const tl = (theme && theme.tile) || THEMES[0].tile;
    const sheet = Themes.tileSheet(theme); // 焼いたタイル(無ければ null でフォールバック)
    const c0 = Math.max(0, Math.floor(cam.x / T));
    const c1 = Math.min(this.cols - 1, Math.ceil((cam.x + CONFIG.WIDTH) / T));
    for (let r = 0; r < this.rows; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = this.tiles[r][c];
        if (t === '.') continue;
        const x = c * T - cam.x, y = r * T;
        if (t === '#') {
          const cap = !this.solidAt(c, r - 1);
          if (sheet) {
            ctx.drawImage(sheet, cap ? T : 0, 0, T, T, x, y, T, T);
            if (cap) this._capDeco(ctx, tl, x, y, c); // ランダムな飾りだけ上描き(軽い)
          } else {
            this._dirtFallback(ctx, tl, x, y, c, cap);
          }
        } else if (t === 'x') {
          this._drawHazard(ctx, tl, x, y, c);
        } else if (t === 'w') {
          this._drawWind(ctx, x, y, c);
        } else {
          if (sheet) ctx.drawImage(sheet, T * 2, 0, T, T, x, y, T, T);
          else this._blockFallback(ctx, tl, x, y);
        }
      }
    }
  }

  // 天面のランダム飾り(花・草の葉・小石・結晶)。焼いたタイルの上に軽く重ねる
  _capDeco(ctx, tl, x, y, c) {
    const hsh = (c * 2654435761) >>> 0;
    if (tl.cap === 'grass') {
      const deco = hsh % 5;
      if (deco === 0) {
        const fx = x + 10 + (hsh >> 8) % 12, fy = y - 5;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          fillCircle(ctx, fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2, tl.deco);
        }
        fillCircle(ctx, fx, fy, 1.8, '#ffcf3a');
      } else if (deco === 1) {
        ctx.strokeStyle = tl.accent;
        ctx.lineWidth = 2;
        const gx = x + 8 + (hsh >> 6) % 14;
        ctx.beginPath();
        ctx.moveTo(gx, y); ctx.quadraticCurveTo(gx - 3, y - 7, gx - 5, y - 9);
        ctx.moveTo(gx, y); ctx.quadraticCurveTo(gx + 3, y - 7, gx + 5, y - 9);
        ctx.stroke();
      }
    } else if (tl.cap === 'rock') {
      if (hsh % 4 === 0) fillCircle(ctx, x + 14 + (hsh >> 5) % 8, y + 6, 2, tl.deco);
    }
  }

  // フォールバック(オフスクリーンが使えない環境向けの直接描画)
  _dirtFallback(ctx, tl, x, y, c, cap) {
    const T = CONFIG.TILE;
    const dirt = ctx.createLinearGradient(0, y, 0, y + T);
    dirt.addColorStop(0, tl.dirtTop);
    dirt.addColorStop(1, tl.dirtBottom);
    ctx.fillStyle = dirt;
    ctx.fillRect(x, y, T, T);
    if (cap) {
      ctx.fillStyle = tl.capTop;
      ctx.fillRect(x, y, T, 11);
      ctx.fillStyle = tl.capHi;
      ctx.fillRect(x, y, T, 3);
      this._capDeco(ctx, tl, x, y, c);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
  }

  _blockFallback(ctx, tl, x, y) {
    const T = CONFIG.TILE;
    fillRound(ctx, x + 1, y + 1, T - 2, T - 2, 5, tl.block);
    fillRound(ctx, x + 3, y + 3, T - 6, 5, 2, 'rgba(255,255,255,0.4)');
    fillRound(ctx, x + 3, y + T - 8, T - 6, 5, 2, 'rgba(0,0,0,0.18)');
    fillCircle(ctx, x + 6, y + 6, 1.6, tl.blockEdge);
    fillCircle(ctx, x + T - 6, y + 6, 1.6, tl.blockEdge);
    fillCircle(ctx, x + 6, y + T - 6, 1.6, tl.blockEdge);
    fillCircle(ctx, x + T - 6, y + T - 6, 1.6, tl.blockEdge);
  }

  // ハザード(非固体)。溶岩テーマでは溶岩、それ以外は金属トゲを描く
  _drawHazard(ctx, tl, x, y, c) {
    const T = CONFIG.TILE;
    if (tl.cap === 'lava') {
      // 溶岩プール(下半分に発光)
      const grad = ctx.createLinearGradient(0, y + T * 0.4, 0, y + T);
      grad.addColorStop(0, '#ff8a2a');
      grad.addColorStop(1, '#c02808');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y + T * 0.45, T, T * 0.55);
      ctx.fillStyle = 'rgba(255,220,120,0.7)';
      const hsh = (c * 2654435761) >>> 0;
      ctx.fillRect(x + (hsh % 10), y + T * 0.45, 6, 2);
      ctx.fillRect(x + 14 + (hsh % 8), y + T * 0.5, 5, 2);
    } else {
      // 金属トゲ(上向きの三角を並べる)
      ctx.fillStyle = '#b9c0c9';
      const n = 4, w = T / n;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * w, y + T);
        ctx.lineTo(x + i * w + w / 2, y + T * 0.3);
        ctx.lineTo(x + (i + 1) * w, y + T);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < n; i++) ctx.fillRect(x + i * w + w / 2 - 0.5, y + T * 0.3, 1, T * 0.4);
      ctx.fillStyle = '#5a626e';
      ctx.fillRect(x, y + T - 3, T, 3);
    }
  }

  // 風(上昇気流。非固体)。上向きのシェブロンをうっすら
  _drawWind(ctx, x, y, c) {
    const T = CONFIG.TILE;
    ctx.strokeStyle = 'rgba(200,235,255,0.4)';
    ctx.lineWidth = 2;
    const phase = ((c * 7) % 16);
    for (let k = 0; k < 2; k++) {
      const yy = y + 6 + k * 14 + phase * 0.4;
      ctx.beginPath();
      ctx.moveTo(x + 6, yy + 5);
      ctx.lineTo(x + T / 2, yy);
      ctx.lineTo(x + T - 6, yy + 5);
      ctx.stroke();
    }
  }
}

// AABB同士の重なり判定
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// エンティティをvx/vyぶん動かしてタイルとの衝突を解決する(X軸→Y軸の2段階)
// ent.onGround / ent.hitWall を更新する。1フレームの移動量 < タイルサイズ が前提。
function moveAndCollide(ent, level) {
  const T = CONFIG.TILE;
  ent.hitWall = false;

  ent.x += ent.vx;
  if (ent.vx > 0) {
    const c = Math.floor((ent.x + ent.w - 0.001) / T);
    if (spanSolidV(level, c, ent.y, ent.h)) {
      ent.x = c * T - ent.w - 0.001;
      ent.hitWall = true;
    }
  } else if (ent.vx < 0) {
    const c = Math.floor(ent.x / T);
    if (spanSolidV(level, c, ent.y, ent.h)) {
      ent.x = (c + 1) * T + 0.001;
      ent.hitWall = true;
    }
  }

  ent.y += ent.vy;
  ent.onGround = false;
  if (ent.vy > 0) {
    const r = Math.floor((ent.y + ent.h - 0.001) / T);
    if (spanSolidH(level, r, ent.x, ent.w)) {
      ent.y = r * T - ent.h - 0.001;
      ent.vy = 0;
      ent.onGround = true;
    }
  } else if (ent.vy < 0) {
    const r = Math.floor(ent.y / T);
    if (spanSolidH(level, r, ent.x, ent.w)) {
      ent.y = (r + 1) * T + 0.001;
      ent.vy = 0;
    }
  }
}

// 列cのうち、y〜y+hの範囲に固体タイルがあるか
function spanSolidV(level, c, y, h) {
  const T = CONFIG.TILE;
  const r0 = Math.floor(y / T);
  const r1 = Math.floor((y + h - 0.001) / T);
  for (let r = r0; r <= r1; r++) if (level.solidAt(c, r)) return true;
  return false;
}

// 行rのうち、x〜x+wの範囲に固体タイルがあるか
function spanSolidH(level, r, x, w) {
  const T = CONFIG.TILE;
  const c0 = Math.floor(x / T);
  const c1 = Math.floor((x + w - 0.001) / T);
  for (let c = c0; c <= c1; c++) if (level.solidAt(c, r)) return true;
  return false;
}

// 進行方向の足元が崖(床なし)か
function cliffAhead(ent, level) {
  const T = CONFIG.TILE;
  const footR = Math.floor((ent.y + ent.h + 1) / T);
  const aheadC = ent.vx > 0
    ? Math.floor((ent.x + ent.w + 1) / T)
    : Math.floor((ent.x - 1) / T);
  return !level.solidAt(aheadC, footR);
}
