import { escapeHtml } from './colors';

export type PillTone = 'default' | 'success' | 'warn' | 'danger' | 'accent';

export interface PillProps {
  label: string;
  tone?: PillTone;
  title?: string;
}

export function pill(props: PillProps): string {
  const toneClass =
    props.tone === 'success'
      ? 'mgr-pill--success'
      : props.tone === 'warn'
      ? 'mgr-pill--warn'
      : props.tone === 'danger'
      ? 'mgr-pill--danger'
      : props.tone === 'accent'
      ? 'mgr-pill--accent'
      : '';
  const title = props.title ? ` title="${escapeHtml(props.title)}"` : '';
  return `<span class="mgr-pill ${toneClass}"${title}>${escapeHtml(props.label)}</span>`;
}

export function formPill(result: 'W' | 'D' | 'L'): string {
  if (result === 'W') return pill({ label: 'W', tone: 'success' });
  if (result === 'L') return pill({ label: 'L', tone: 'danger' });
  return pill({ label: 'D', tone: 'warn' });
}
