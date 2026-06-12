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

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump': this._tone(420, 0.16, 'square', 0.4, 720); break;
      case 'wallkick': this._tone(620, 0.12, 'square', 0.35, 360); break;
      case 'stomp': this._noise(0.12, 0.5); this._tone(180, 0.1, 'square', 0.3, 90); break;
      case 'coin': this._tone(880, 0.07, 'square', 0.4); setTimeout(() => this._tone(1320, 0.12, 'square', 0.4), 70); break;
      case 'powerup': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'triangle', 0.4), i * 70)); break;
      case 'damage': this._tone(330, 0.3, 'sawtooth', 0.4, 90); break;
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
    };
    const seq = melodies[kind] || melodies.play;
    let i = 0;
    const stepMs = 200;
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
