import { escapeHtml } from './colors';

export interface PitchDot {
  /** 0..1 across the pitch width (0 = left). */
  x: number;
  /** 0..1 along the pitch length (0 = own goal-line, 1 = opponent goal-line). */
  y: number;
  label: string;
  num?: string;
  teamColorHex: string;
  selected?: boolean;
  /** Optional data-* attributes set on the dot group. */
  dataAttrs?: Record<string, string>;
}

export interface PitchProps {
  dots: PitchDot[];
  /** Optional second set of dots (opposition). */
  opponentDots?: PitchDot[];
  dataAction?: string;
  showHalfwayMarkings?: boolean;
}

const PITCH_W = 200;
const PITCH_H = 300;

function dot(d: PitchDot, action?: string): string {
  const cx = d.x * PITCH_W;
  const cy = (1 - d.y) * PITCH_H;
  const attrs = d.dataAttrs
    ? Object.entries(d.dataAttrs)
        .map(([k, v]) => ` data-${k}="${escapeHtml(v)}"`)
        .join('')
    : '';
  const actionAttr = action ? ` data-action="${escapeHtml(action)}"` : '';
  return `<g class="mgr-pitch__dot ${d.selected ? 'mgr-pitch__dot--selected' : ''}"${actionAttr}${attrs}>
    <circle cx="${cx}" cy="${cy}" r="11" fill="${d.teamColorHex}" stroke="#fff" stroke-width="1.5"/>
    ${d.num ? `<text class="mgr-pitch-dot-num" x="${cx}" y="${cy + 3.5}" text-anchor="middle">${escapeHtml(d.num)}</text>` : ''}
    <text class="mgr-pitch-dot-label" x="${cx}" y="${cy + 22}" text-anchor="middle">${escapeHtml(d.label)}</text>
  </g>`;
}

function markings(): string {
  // Original SVG pitch primitives (no sprites/textures).
  return `
    <rect x="0" y="0" width="${PITCH_W}" height="${PITCH_H}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
    <line x1="0" y1="${PITCH_H / 2}" x2="${PITCH_W}" y2="${PITCH_H / 2}" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>
    <circle cx="${PITCH_W / 2}" cy="${PITCH_H / 2}" r="22" fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>
    <rect x="${PITCH_W / 2 - 40}" y="0" width="80" height="32" fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>
    <rect x="${PITCH_W / 2 - 40}" y="${PITCH_H - 32}" width="80" height="32" fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>
    <rect x="${PITCH_W / 2 - 18}" y="0" width="36" height="14" fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>
    <rect x="${PITCH_W / 2 - 18}" y="${PITCH_H - 14}" width="36" height="14" fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>`;
}

export function pitch(props: PitchProps): string {
  return `<svg class="mgr-pitch" viewBox="0 0 ${PITCH_W} ${PITCH_H}" preserveAspectRatio="xMidYMid meet">
    ${markings()}
    ${(props.opponentDots ?? []).map((d) => dot(d)).join('')}
    ${props.dots.map((d) => dot(d, props.dataAction)).join('')}
  </svg>`;
}
