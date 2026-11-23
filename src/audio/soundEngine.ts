class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private localGain: GainNode | null = null;

  constructor() {
    const saved = localStorage.getItem('kinetic_blitz_muted') ?? localStorage.getItem('kinetic_pulse_muted');
    if (saved !== null) {
      this.isMuted = saved === 'true';
    }
  }

  public enableAudio() {
    this.initContext();
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.localGain = this.ctx.createGain();
      this.localGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.localGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private connectOutput(node: AudioNode) {
    if (!this.ctx) return;
    if (this.localGain) {
      node.connect(this.localGain);
    } else {
      node.connect(this.ctx.destination);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('kinetic_blitz_muted', String(this.isMuted));
    if (this.localGain && this.ctx) {
      this.localGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
    if (this.isMuted && this.chargeGain) {
      this.chargeGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playCountdown(isFinal: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.4 : 0.18));

    osc.connect(gain);
    this.connectOutput(gain);

    osc.start(now);
    osc.stop(now + (isFinal ? 0.4 : 0.2));
  }

  public playPunch(isPower: boolean = false, combo: number = 1) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Sub-punch body
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isPower ? 'triangle' : 'sine';
    const startFreq = isPower ? 180 + Math.min(combo * 10, 80) : 220 + Math.min(combo * 15, 120);
    const endFreq = isPower ? 35 : 55;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + (isPower ? 0.25 : 0.15));

    gain.gain.setValueAtTime(isPower ? 0.6 : 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isPower ? 0.28 : 0.16));

    osc.connect(gain);
    this.connectOutput(gain);

    osc.start(now);
    osc.stop(now + (isPower ? 0.3 : 0.18));

    // Punch transient noise snap
    const bufferSize = this.ctx.sampleRate * (isPower ? 0.08 : 0.04);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(isPower ? 0.4 : 0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (isPower ? 0.08 : 0.04));

    noise.connect(noiseGain);
    this.connectOutput(noiseGain);

    noise.start(now);
  }

  public startSolarCharge(progress: number) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (!this.chargeOsc) {
      this.chargeOsc = this.ctx.createOscillator();
      this.chargeGain = this.ctx.createGain();
      this.chargeOsc.type = 'triangle';
      this.chargeOsc.frequency.setValueAtTime(320, now);
      this.chargeGain.gain.setValueAtTime(0.01, now);

      this.chargeOsc.connect(this.chargeGain);
      this.connectOutput(this.chargeGain);
      this.chargeOsc.start(now);
    }

    // Modulate pitch and volume with charge progress (0 -> 1)
    if (this.chargeOsc && this.chargeGain) {
      const targetFreq = 320 + progress * 480; // 320Hz -> 800Hz
      this.chargeOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);
      this.chargeGain.gain.setTargetAtTime(0.18 + progress * 0.15, now, 0.04);
    }
  }

  public stopSolarCharge() {
    if (this.chargeGain && this.ctx) {
      this.chargeGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => {
        if (this.chargeOsc) {
          try {
            this.chargeOsc.stop();
            this.chargeOsc.disconnect();
          } catch {
            // Already stopped
          }
          this.chargeOsc = null;
          this.chargeGain = null;
        }
      }, 70);
    }
  }

  public playSolarBurst() {
    this.stopSolarCharge();
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Euphoric C Major chord chime (C5, E5, G5, C6)
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.2, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.45);

      osc.connect(gain);
      this.connectOutput(gain);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.5);
    });
  }

  public playLaserWarning() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.setValueAtTime(720, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    this.connectOutput(gain);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playLaserHit() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    this.connectOutput(gain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playDodgeSuccess() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Swoosh sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.3);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    this.connectOutput(gain);

    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playButtonClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.04);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    this.connectOutput(gain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playWrongHandBuzz() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Low, raspy error buzz using two detuned sawtooth waves
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(120, now);
    osc1.frequency.exponentialRampToValueAtTime(75, now + 0.16);

    osc2.frequency.setValueAtTime(126, now); // Detune for raspy discordance
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.16);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    this.connectOutput(gain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.19);
    osc2.stop(now + 0.19);
  }
}

export const soundEngine = new SoundEngine();
