// キーボード入力(矢印 + WASD + スペースを論理キーに正規化)
const Input = {
  keys: new Set(),
  pressed: new Set(),      // このフレームに押された瞬間のキー
  _pressedBuffer: new Set(),

  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  action: false,         // ファイア等のアクション(押しっぱなし)
  actionPressed: false,  // アクションを押した瞬間

  init() {
    const used = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW',
      'KeyX', 'KeyZ', 'ShiftLeft'];
    addEventListener('keydown', (e) => {
      if (used.includes(e.code)) e.preventDefault();
      if (!e.repeat) this._pressedBuffer.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  },

  // 画面のタッチボタンから、キーを押した/離したのと同じ状態を作る
  press(code) {
    if (!this.keys.has(code)) this._pressedBuffer.add(code); // 押した瞬間のエッジ
    this.keys.add(code);
  },
  release(code) {
    this.keys.delete(code);
  },

  // 毎フレーム先頭で呼ぶ
  poll() {
    this.pressed = this._pressedBuffer;
    this._pressedBuffer = new Set();
    const k = this.keys;
    this.left = k.has('ArrowLeft') || k.has('KeyA');
    this.right = k.has('ArrowRight') || k.has('KeyD');
    this.jump = k.has('Space') || k.has('ArrowUp') || k.has('KeyW');
    this.jumpPressed = this.pressed.has('Space') || this.pressed.has('ArrowUp') || this.pressed.has('KeyW');
    this.action = k.has('KeyX') || k.has('KeyZ') || k.has('ShiftLeft');
    this.actionPressed = this.pressed.has('KeyX') || this.pressed.has('KeyZ') || this.pressed.has('ShiftLeft');
  },
};
