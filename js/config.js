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

  // 壁ずり・壁キック
  WALL_SLIDE_SPEED: 2.3,  // 壁に張り付いて落ちるときの最大落下速度
  WALL_KICK_VX: 5.0,      // 壁を蹴って横に飛ぶ初速
  WALL_KICK_VY: -12.0,    // 壁を蹴って上に飛ぶ初速
  WALL_KICK_LOCK: 9,      // 壁キック直後に横入力を弱めるフレーム数

  START_LIVES: 3,
  MAX_LIVES: 9,
  INVINCIBLE_FRAMES: 90,

  // 収集・スコア
  COIN_SCORE: 50,
  COIN_1UP: 100,        // この枚数ごとに残機+1
  STAR_FRAMES: 9 * 60,  // 無敵スターの効果時間(フレーム)

  // 踏みつけコンボ: 連続で踏むほど加点が倍々に(着地でリセット)
  COMBO_BASE: 100,
  COMBO_MAX_STEPS: 6,   // 100,200,400,800,1600,3200 まで

  // パワーアップ: ファイアフラワー(火球)
  FIRE_SPEED: 6.5,      // 火球の横速度
  FIRE_BOUNCE: -7,      // 地面で弾むときの上向き初速
  FIRE_MAX: 2,          // 画面に出せる火球の最大数
  FIRE_COOLDOWN: 16,    // 連射の間隔(フレーム)

  // パワーアップ: フェザー/マント(二段ジャンプ + 滑空)
  AIR_JUMPS: 1,         // 空中で追加できるジャンプ回数
  AIR_JUMP_VEL: -11,    // 二段ジャンプの初速
  CAPE_GLIDE_SPEED: 2.0, // ジャンプ長押しでの滑空落下速度

  // ギミック
  SPRING_VEL: -18.5,    // バネで跳ねる初速(通常ジャンプより高い)
  CRUMBLE_DELAY: 28,    // 崩れる足場: 乗ってから落ちるまで
  CRUMBLE_RESPAWN: 150, // 崩れる足場: 復活までのフレーム
  CANNON_INTERVAL: 110, // 大砲の発射間隔
  WIND_FORCE: -0.55,    // 風(上昇気流)の上向き加速
  WIND_MAX_RISE: -6,    // 風で上がる最大速度
  SLIP_FRICTION: 0.965, // 氷の床の摩擦(1に近いほど滑る)
};
