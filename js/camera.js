// 横スクロールカメラ(プレイヤー追従、レベル両端でクランプ)
class Camera {
  constructor(level) {
    this.level = level;
    this.x = 0;
  }

  follow(target) {
    const ideal = target.x + target.w / 2 - CONFIG.WIDTH / 2;
    const max = Math.max(0, this.level.widthPx - CONFIG.WIDTH);
    this.x = Math.max(0, Math.min(ideal, max));
  }
}
