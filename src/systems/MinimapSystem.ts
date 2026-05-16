import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import { MINIMAP, PITCH } from '../game/constants';

export class MinimapSystem {
  readonly element: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private accumulator = 0;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('canvas');
    this.element.className = 'minimap minimap--hidden';
    this.element.width = MINIMAP.width;
    this.element.height = MINIMAP.height;
    const context = this.element.getContext('2d');
    if (!context) {
      throw new Error('Unable to create minimap context.');
    }
    this.context = context;
    parent.append(this.element);
  }

  show(): void {
    this.element.classList.remove('minimap--hidden');
  }

  hide(): void {
    this.element.classList.add('minimap--hidden');
  }

  update(
    delta: number,
    blueTeam: Team,
    redTeam: Team,
    ball: Ball,
    controlledPlayer: Player,
    force = false,
  ): void {
    this.accumulator += delta;
    if (!force && this.accumulator < MINIMAP.updateInterval) {
      return;
    }
    this.accumulator = 0;

    const ctx = this.context;
    const width = this.element.width;
    const height = this.element.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(4, 13, 9, 0.74)';
    ctx.strokeStyle = 'rgba(244, 248, 242, 0.42)';
    ctx.lineWidth = 1;
    roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 8);
    ctx.fill();
    ctx.stroke();

    const pad = MINIMAP.padding;
    ctx.strokeStyle = 'rgba(244, 248, 242, 0.54)';
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.beginPath();
    ctx.moveTo(pad, height / 2);
    ctx.lineTo(width - pad, height / 2);
    ctx.stroke();

    this.drawTeam(blueTeam, blueTeam.tournamentTeam?.colors.primary ?? 0x2587ff, controlledPlayer);
    this.drawTeam(redTeam, redTeam.tournamentTeam?.colors.primary ?? 0xf04b55, controlledPlayer);

    const ballPosition = ball.getPosition();
    const ballPoint = this.worldToMap(ballPosition.x, ballPosition.z);
    ctx.fillStyle = '#f4f8f2';
    ctx.beginPath();
    ctx.arc(ballPoint.x, ballPoint.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTeam(team: Team, color: number, controlledPlayer: Player): void {
    const ctx = this.context;
    const cssColor = colorToCss(color);

    for (const player of team.players) {
      const point = this.worldToMap(player.group.position.x, player.group.position.z);
      const isControlled = player === controlledPlayer;
      ctx.fillStyle = cssColor;
      ctx.strokeStyle = isControlled ? '#f6d66f' : 'rgba(4, 13, 9, 0.88)';
      ctx.lineWidth = isControlled ? 2.2 : 1.1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, isControlled ? 4.1 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private worldToMap(x: number, z: number): { x: number; y: number } {
    const pad = MINIMAP.padding;
    const usableWidth = this.element.width - pad * 2;
    const usableHeight = this.element.height - pad * 2;
    return {
      x: pad + ((x + PITCH.width / 2) / PITCH.width) * usableWidth,
      y: pad + ((z + PITCH.length / 2) / PITCH.length) * usableHeight,
    };
  }
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}
