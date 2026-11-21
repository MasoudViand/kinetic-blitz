import { Particle, FloatingText, Point2D } from '../types/game';

export class ParticleSystem {
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private leftHandTrail: Point2D[] = [];
  private rightHandTrail: Point2D[] = [];
  private maxTrailLength = 12;

  public update(dt: number) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life += dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife || p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt * 60;
      ft.alpha -= 0.8 * dt;
      ft.scale = Math.min(1.3, ft.scale + dt * 0.5);

      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  public recordHandPositions(leftWrist: Point2D | null, rightWrist: Point2D | null) {
    if (leftWrist) {
      this.leftHandTrail.unshift({ ...leftWrist });
      if (this.leftHandTrail.length > this.maxTrailLength) {
        this.leftHandTrail.pop();
      }
    } else {
      this.leftHandTrail = [];
    }

    if (rightWrist) {
      this.rightHandTrail.unshift({ ...rightWrist });
      if (this.rightHandTrail.length > this.maxTrailLength) {
        this.rightHandTrail.pop();
      }
    } else {
      this.rightHandTrail = [];
    }
  }

  public spawnPunchBurst(x: number, y: number, isPower: boolean, customColor?: string) {
    const count = isPower ? 36 : 20;
    const baseColor = customColor ?? (isPower ? '#00f3ff' : '#38bdf8');
    const altColor = isPower ? '#ffffff' : (customColor ? '#ffffff' : '#0284c7');

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (isPower ? 4 : 2.5) + Math.random() * (isPower ? 8 : 5);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.4 ? baseColor : altColor,
        radius: isPower ? 3 + Math.random() * 3.5 : 2 + Math.random() * 2.5,
        alpha: 1,
        decay: 1,
        life: 0,
        maxLife: isPower ? 0.6 : 0.4,
      });
    }
  }

  public spawnSolarBurst(x: number, y: number) {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.3 ? '#ffd700' : '#fff7ed',
        radius: 2.5 + Math.random() * 3,
        alpha: 1,
        decay: 1,
        life: 0,
        maxLife: 0.7,
      });
    }
  }

  public spawnLaserDamageBurst(x: number, y: number) {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.3 ? '#ff1a40' : '#f43f5e',
        radius: 3 + Math.random() * 3,
        alpha: 1,
        decay: 1,
        life: 0,
        maxLife: 0.5,
      });
    }
  }

  public addFloatingText(text: string, x: number, y: number, color: string = '#00f3ff') {
    this.floatingTexts.push({
      id: Math.random().toString(36).substring(2, 9),
      text,
      x,
      y,
      color,
      alpha: 1.0,
      vy: -1.8,
      scale: 0.8,
    });
  }

  public render(ctx: CanvasRenderingContext2D) {
    // 1. Render Hand Trails
    this.renderTrail(ctx, this.leftHandTrail, '#00f3ff');
    this.renderTrail(ctx, this.rightHandTrail, '#ff007f');

    // 2. Render Particles
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Render Floating Texts
    ctx.save();
    ctx.font = 'bold 22px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.translate(ft.x, ft.y);
      ctx.scale(ft.scale, ft.scale);
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 12;
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  private renderTrail(ctx: CanvasRenderingContext2D, trail: Point2D[], color: string) {
    if (trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < trail.length - 1; i++) {
      const p1 = trail[i];
      const p2 = trail[i + 1];
      const alpha = (1 - i / trail.length) * 0.45;
      const width = (1 - i / trail.length) * 12 + 2;

      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  public clear() {
    this.particles = [];
    this.floatingTexts = [];
    this.leftHandTrail = [];
    this.rightHandTrail = [];
  }
}
