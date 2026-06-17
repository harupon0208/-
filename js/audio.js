// 効果音・BGM(Web Audio APIでその場合成。音声ファイルは使わない)。
// AudioContext が無い環境(ヘッドレス等)では全メソッドが no-op になる。

const Sound = {
  ctx: null,
  master: null,
  muted: false,
  bgm: null,
  _unlocked: false,

  init() {
    try { this.muted = (typeof localStorage !== 'undefined' && localStorage.getItem('sjq_muted') === '1'); } catch (e) {}
    const unlock = () => this.unlock();
    if (typeof addEventListener === 'function') {
      addEventListener('keydown', unlock);
      addEventListener('touchstart', unlock);
      addEventListener('mousedown', unlock);
      addEventListener('keydown', (e) => { if (e.code === 'KeyM') this.toggleMute(); });
    }
  },

  // 最初のユーザー操作で AudioContext を起こす(自動再生ポリシー対策)
  unlock() {
    if (this._unlocked) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = (typeof AudioContext !== 'undefined' && AudioContext)
      || (typeof webkitAudioContext !== 'undefined' && webkitAudioContext) || null;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this._unlocked = true;
  },

  toggleMute() {
    this.muted = !this.muted;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('sjq_muted', this.muted ? '1' : '0'); } catch (e) {}
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  },

  // 単発トーン(slideTo で周波数を滑らせる)
  _tone(freq, dur, type = 'square', vol = 0.4, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  },

  // ノイズ(踏む・爆発)
  _noise(dur, vol = 0.4) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.master); src.start(t0);
  },

  // name: 効果音の種類。pitch: 周波数の倍率(1.0=既定)。速度や勢いに応じて鳴き分けに使う
  play(name, pitch = 1) {
    if (!this.ctx || this.muted) return;
    const p = (f) => f * pitch;
    switch (name) {
      case 'jump': this._tone(p(420), 0.16, 'square', 0.4, p(720)); break;
      case 'wallkick': this._tone(620, 0.12, 'square', 0.35, 360); break;
      // 着地音: 落下が速いほど低く重い「ドスッ」(pitchで調整)
      case 'land': this._noise(0.05, 0.18 * pitch); this._tone(p(150), 0.07, 'sine', 0.18, p(90)); break;
      case 'stomp': this._noise(0.12, 0.5); this._tone(p(180), 0.1, 'square', 0.3, p(90)); break;
      case 'coin': this._tone(880, 0.07, 'square', 0.4); setTimeout(() => this._tone(1320, 0.12, 'square', 0.4), 70); break;
      case 'powerup': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'triangle', 0.4), i * 70)); break;
      case 'fireget': [659, 880, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.1, 'sawtooth', 0.35), i * 60)); break;
      case 'capeget': [784, 988, 1319].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'triangle', 0.38), i * 65)); break;
      case 'fire': this._tone(p(720), 0.09, 'square', 0.3, p(420)); break;
      case 'spring': this._tone(300, 0.18, 'sine', 0.4, 1200); break;
      case 'crumble': this._noise(0.1, 0.28); this._tone(220, 0.12, 'triangle', 0.2, 110); break;
      case 'cannon': this._noise(0.08, 0.35); this._tone(160, 0.12, 'square', 0.3, 80); break;
      case 'star': [659, 880, 1047, 1319].forEach((f, i) => setTimeout(() => this._tone(f, 0.1, 'square', 0.35), i * 55)); break;
      case 'checkpoint': this._tone(784, 0.08, 'triangle', 0.4); setTimeout(() => this._tone(1175, 0.16, 'triangle', 0.4), 90); break;
      case 'oneup': [784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'square', 0.38), i * 80)); break;
      case 'damage': this._tone(330, 0.3, 'sawtooth', 0.4, 90); break;
      case 'gameover': [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this._tone(f, 0.32, 'sawtooth', 0.4), i * 220)); break;
      case 'bosshit': this._noise(0.15, 0.5); this._tone(140, 0.18, 'sawtooth', 0.4, 70); break;
      case 'select': this._tone(660, 0.06, 'square', 0.3); break;
      case 'start': this._tone(523, 0.1, 'square', 0.4); setTimeout(() => this._tone(784, 0.16, 'square', 0.4), 90); break;
      case 'clear': [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'triangle', 0.45), i * 120)); break;
    }
  },

  // 簡易ループBGM
  startBGM(kind) {
    this.stopBGM();
    if (!this.ctx) return;
    const melodies = {
      play: [523, 0, 659, 0, 784, 659, 523, 0, 587, 0, 698, 0, 880, 0, 784, 0],
      map: [392, 0, 523, 0, 659, 0, 523, 0, 440, 0, 587, 0, 523, 0, 392, 0],
      // 無敵スター中の急かすような速いフレーズ
      star: [1047, 1319, 1047, 784, 1047, 1319, 1568, 1319, 1047, 1319, 1047, 784],
    };
    const seq = melodies[kind] || melodies.play;
    let i = 0;
    const stepMs = kind === 'star' ? 110 : 200;
    this.bgm = setInterval(() => {
      if (!this.ctx || this.muted) { i++; return; }
      const f = seq[i % seq.length];
      if (f) this._tone(f, stepMs / 1000 * 0.9, 'triangle', 0.12);
      i++;
    }, stepMs);
  },

  stopBGM() { if (this.bgm) { clearInterval(this.bgm); this.bgm = null; } },
};

Sound.init();
