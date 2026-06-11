// タイルマップのパース・描画・当たり判定

class Level {
  constructor(data) {
    const T = CONFIG.TILE;
    this.name = data.name;
    this.rows = data.map.length;
    this.cols = Math.max(...data.map.map((r) => r.length));
    this.tiles = [];
    this.spawns = { player: { x: T, y: 0 }, enemies: [], items: [], platforms: [], flag: null, boss: null };

    for (let r = 0; r < this.rows; r++) {
      const line = data.map[r];
      const tileRow = [];
      for (let c = 0; c < this.cols; c++) {
        const ch = line[c] || '.';
        const x = c * T, y = r * T;
        if (ch === '#' || ch === '=') {
          tileRow.push(ch);
          continue;
        }
        switch (ch) {
          case 'P': this.spawns.player = { x, y }; break;
          case 'G': this.spawns.flag = { x, y }; break;
          case '*': this.spawns.items.push({ x, y }); break;
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

  draw(ctx, cam) {
    const T = CONFIG.TILE;
    const c0 = Math.max(0, Math.floor(cam.x / T));
    const c1 = Math.min(this.cols - 1, Math.ceil((cam.x + CONFIG.WIDTH) / T));
    for (let r = 0; r < this.rows; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = this.tiles[r][c];
        if (t === '.') continue;
        const x = c * T - cam.x, y = r * T;
        if (t === '#') {
          // 土(縦グラデ)
          const dirt = ctx.createLinearGradient(0, y, 0, y + T);
          dirt.addColorStop(0, '#b07038');
          dirt.addColorStop(1, '#7c4a22');
          ctx.fillStyle = dirt;
          ctx.fillRect(x, y, T, T);
          // 土の粒
          ctx.fillStyle = 'rgba(0,0,0,0.10)';
          ctx.fillRect(x + 6, y + 14, 3, 3);
          ctx.fillRect(x + 20, y + 22, 3, 3);
          ctx.fillRect(x + 14, y + 8, 2, 2);
          // 上面が空いていれば草
          if (!this.solidAt(c, r - 1)) {
            const grass = ctx.createLinearGradient(0, y, 0, y + 12);
            grass.addColorStop(0, '#62cf52');
            grass.addColorStop(1, '#3aa53a');
            ctx.fillStyle = grass;
            ctx.fillRect(x, y, T, 11);
            ctx.fillStyle = '#7be06a';
            ctx.fillRect(x, y, T, 3);
            // 草のふさ(丸)
            ctx.fillStyle = '#3aa53a';
            fillCircle(ctx, x + 8, y + 11, 4, '#4cb845');
            fillCircle(ctx, x + 22, y + 11, 4, '#4cb845');
          }
          // タイル境界の陰
          ctx.strokeStyle = 'rgba(0,0,0,0.12)';
          ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        } else {
          // ブロック(ベベル付き)
          fillRound(ctx, x + 1, y + 1, T - 2, T - 2, 5, '#e8a33d');
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          fillRound(ctx, x + 3, y + 3, T - 6, 5, 2, 'rgba(255,255,255,0.4)');
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          fillRound(ctx, x + 3, y + T - 8, T - 6, 5, 2, 'rgba(0,0,0,0.18)');
          // リベット
          ctx.fillStyle = '#a06a18';
          fillCircle(ctx, x + 6, y + 6, 1.6, '#a06a18');
          fillCircle(ctx, x + T - 6, y + 6, 1.6, '#a06a18');
          fillCircle(ctx, x + 6, y + T - 6, 1.6, '#a06a18');
          fillCircle(ctx, x + T - 6, y + T - 6, 1.6, '#a06a18');
        }
      }
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
