// ゲーム全体の定数
const CONFIG = {
  TILE: 32,
  WIDTH: 960,
  HEIGHT: 480,

  // 物理(60fps前提)。落下は上昇より重力を強めにして「キビキビ」した着地感に
  GRAVITY: 0.62,        // 上昇中の重力
  FALL_GRAVITY: 0.86,   // 落下中の重力(速めに落とす)
  MAX_FALL: 13,

  // 横移動: 地上は加速強め、空中は弱め、反転時はさらに強く効かせて切り返しを軽快に
  MOVE_ACCEL: 0.85,
  AIR_ACCEL: 0.55,
  TURN_ACCEL: 1.7,
  MOVE_SPEED: 4.2,
  GROUND_FRICTION: 0.80,
  AIR_FRICTION: 0.95,

  // ジャンプ: 可変ジャンプ + コヨーテタイム + 先行入力で操作感を良く
  JUMP_VEL: -12.6,      // ジャンプ高さ ≒ 4タイル
  JUMP_CUT: 0.45,       // ボタンを離した瞬間の上昇カット率
  COYOTE: 6,            // 地面を離れてからジャンプを受け付けるフレーム数
  JUMP_BUFFER: 7,       // 着地前にジャンプを押しておける先行入力フレーム数

  START_LIVES: 3,
  INVINCIBLE_FRAMES: 90,
};
