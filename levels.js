// ステージ1〜9のマップデータ(全マップ15行 x 1文字=1タイル)
//
// 記号: . 空 / # 地面・ブロック / = 足場ブロック
//       P プレイヤー開始 / G ゴール旗 / * キノコ
//       e 歩行敵Walker(崖で反転) / f 高速敵Speedy(崖から落ちる) / j 跳ね敵Hopper
//       - 横に動く足場 / | 縦に動く足場 / B ボス
//
// エンティティ記号は「立たせたい床のひとつ上の行」に置く。

// 1行を生成する: row(幅, [[列位置, 文字列], ...])
function row(width, items = []) {
  const a = new Array(width).fill('.');
  for (const [pos, s] of items) {
    for (let i = 0; i < s.length && pos + i < width; i++) a[pos + i] = s[i];
  }
  return a.join('');
}

// 地面の行を生成する: ground(幅, [[穴の開始列, 穴の幅], ...])
function ground(width, holes = []) {
  const a = new Array(width).fill('#');
  for (const [start, w] of holes) {
    for (let i = 0; i < w && start + i < width; i++) a[start + i] = '.';
  }
  return a.join('');
}

const LEVELS = [];

// ---- STAGE 1: 平坦なチュートリアル。狭い穴2つ、歩行敵3体、取りやすいキノコ ----
{
  const W = 90;
  const g = ground(W, [[40, 2], [64, 2]]);
  LEVELS.push({ name: 'STAGE 1', map: [
    row(W), row(W), row(W), row(W), row(W),
    row(W), row(W), row(W), row(W),
    row(W, [[21, '*']]),                                                          // 9
    row(W, [[20, '====']]),                                                       // 10
    row(W),                                                                       // 11
    row(W, [[3, 'P'], [30, 'e'], [52, 'e'], [74, 'e'], [86, 'G']]),               // 12
    g, g,
  ]});
}

// ---- STAGE 2: 段差と浮き足場の導入。穴3つ、敵5体 ----
{
  const W = 110;
  const g = ground(W, [[30, 2], [55, 3], [82, 3]]);
  LEVELS.push({ name: 'STAGE 2', map: [
    row(W), row(W), row(W), row(W), row(W), row(W), row(W),
    row(W, [[25, '*']]),                                                          // 7
    row(W, [[24, '===']]),                                                        // 8
    row(W),                                                                       // 9
    row(W, [[20, '===']]),                                                        // 10
    row(W, [[43, 'e']]),                                                          // 11 (段の上)
    row(W, [[3, 'P'], [15, 'e'], [36, 'e'], [40, '#######'], [65, 'e'], [95, 'e'], [106, 'G']]), // 12
    g, g,
  ]});
}

// ---- STAGE 3: 高速敵 Speedy 初登場。穴の縁に歩行敵を配置 ----
{
  const W = 120;
  const g = ground(W, [[25, 2], [45, 3], [70, 3], [95, 3]]);
  LEVELS.push({ name: 'STAGE 3', map: [
    row(W), row(W), row(W), row(W), row(W), row(W), row(W), row(W),
    row(W, [[31, '*']]),                                                          // 8
    row(W, [[58, '===']]),                                                        // 9
    row(W, [[30, '===']]),                                                        // 10
    row(W),                                                                       // 11
    row(W, [[3, 'P'], [15, 'e'], [23, 'e'], [38, 'f'], [60, 'f'], [80, 'e'], [93, 'e'], [108, 'f'], [116, 'G']]), // 12
    g, g,
  ]});
}

// ---- STAGE 4: 横に動く足場 初登場。広い穴2つを足場で渡る ----
{
  const W = 130;
  const g = ground(W, [[25, 3], [50, 8], [90, 7], [115, 3]]);
  LEVELS.push({ name: 'STAGE 4', map: [
    row(W), row(W), row(W), row(W), row(W), row(W), row(W),
    row(W),                                                                       // 7
    row(W, [[71, '*']]),                                                          // 8
    row(W, [[70, '===']]),                                                        // 9
    row(W, [[53, '-'], [92, '-']]),                                               // 10
    row(W),                                                                       // 11
    row(W, [[3, 'P'], [15, 'e'], [35, 'f'], [48, 'e'], [65, 'e'], [80, 'f'], [105, 'f'], [126, 'G']]), // 12
    g, g,
  ]});
}

// ---- STAGE 5: 跳ね敵 Hopper 初登場。大穴を狭い足場で渡る ----
{
  const W = 140;
  const g = ground(W, [[25, 3], [40, 4], [60, 17], [100, 4], [120, 4]]);
  LEVELS.push({ name: 'STAGE 5', map: [
    row(W), row(W), row(W), row(W), row(W), row(W), row(W), row(W),
    row(W, [[19, '*']]),                                                          // 8
    row(W, [[18, '===']]),                                                        // 9
    row(W, [[68, '==']]),                                                         // 10
    row(W, [[62, '==='], [73, '===']]),                                           // 11
    row(W, [[3, 'P'], [15, 'e'], [33, 'f'], [50, 'j'], [85, 'e'], [90, 'j'], [110, 'f'], [126, 'j'], [136, 'G']]), // 12
    g, g,
  ]});
}

// ---- STAGE 6: 縦に動く足場と高台。敵の波状配置 ----
{
  const W = 150;
  const g = ground(W, [[20, 3], [35, 4], [62, 8], [95, 4], [120, 4]]);
  LEVELS.push({ name: 'STAGE 6', map: [
    row(W), row(W), row(W), row(W), row(W), row(W), row(W),
    row(W),                                                                       // 7
    row(W, [[75, '*']]),                                                          // 8
    row(W, [[74, '===']]),                                                        // 9
    row(W, [[50, 'f'], [64, '|']]),                                               // 10 (高台の上の敵 / 縦足場)
    row(W, [[45, '##############']]),                                             // 11 (高台)
    row(W, [[3, 'P'], [15, 'e'], [30, 'f'], [45, '##############'], [78, 'f'], [82, 'f'], [88, 'j'], [103, 'f'], [108, 'j'], [112, 'e'], [128, 'f'], [133, 'j'], [146, 'G']]), // 12
    g, g,
  ]});
}

// ---- STAGE 7: 動く足場の乗り継ぎ連続。リスクのある位置のキノコ ----
{
  const W = 160;
  const g = ground(W, [[25, 4], [50, 30], [100, 20], [138, 4]]);
  LEVELS.push({ name: 'STAGE 7', map: [
    row(W), row(W), row(W), row(W), row(W), row(W), row(W),
    row(W),                                                                       // 7
    row(W, [[90, '*']]),                                                          // 8
    row(W, [[62, '-'], [89, '=='], [110, '-']]),                                  // 9
    row(W, [[53, '-'], [71, '-'], [103, '-'], [116, '-']]),                       // 10
    row(W),                                                                       // 11
    row(W, [[3, 'P'], [12, 'f'], [23, 'e'], [42, 'f'], [85, 'j'], [93, 'j'], [125, 'f'], [130, 'j'], [145, 'f'], [150, 'e'], [156, 'G']]), // 12
    g, g,
  ]});
}

// ---- STAGE 8: 総合ステージ。狭い足場の連続 + 足場の上の敵 + 全敵種 ----
{
  const W = 180;
  const g = ground(W, [[20, 3], [33, 4], [45, 20], [85, 15], [110, 4], [150, 4]]);
  LEVELS.push({ name: 'STAGE 8', map: [
    row(W), row(W), row(W), row(W), row(W), row(W), row(W),
    row(W),                                                                       // 7
    row(W, [[29, '*'], [140, '*']]),                                              // 8
    row(W, [[29, '=='], [52, 'e'], [60, 'e'], [95, '-'], [140, '==']]),           // 9 (足場の上に敵)
    row(W, [[52, '=='], [60, '=='], [88, '-']]),                                  // 10
    row(W, [[47, '=='], [56, '=='], [63, '==']]),                                 // 11
    row(W, [[3, 'P'], [12, 'f'], [18, 'e'], [28, 'j'], [40, 'f'], [70, 'j'], [75, 'f'], [105, 'j'], [118, 'f'], [125, 'e'], [135, 'j'], [142, 'f'], [160, 'j'], [168, 'f'], [176, 'G']]), // 12
    g, g,
  ]});
}

// ---- STAGE 9: ボスアリーナ。左右の壁 + 足場2つ。ボスを3回踏めばクリア ----
{
  const W = 40;
  const g = ground(W, []);
  const wall = (items = []) => row(W, [[0, '##'], [38, '##'], ...items]);
  LEVELS.push({ name: 'STAGE 9', map: [
    row(W), row(W), row(W), row(W), row(W), row(W), row(W),
    wall(),                                                                       // 7
    wall(),                                                                       // 8
    wall(),                                                                       // 9
    wall([[8, '==='], [28, '===']]),                                              // 10
    wall(),                                                                       // 11
    wall([[4, 'P'], [31, 'B']]),                                                  // 12
    g, g,
  ]});
}
