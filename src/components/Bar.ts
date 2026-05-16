import { ratingBarClass, escapeHtml } from './colors';

export interface BarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  showValue?: boolean;
  colorClass?: 'mgr-bar--low' | 'mgr-bar--mid' | 'mgr-bar--high' | 'mgr-bar--accent' | 'auto';
  unit?: string;
}

export function bar(props: BarProps): string {
  const max = props.max ?? 100;
  const pct = Math.max(0, Math.min(100, (props.value / max) * 100));
  const colorClass =
    props.colorClass === 'auto' || props.colorClass === undefined
      ? ratingBarClass(pct)
      : props.colorClass;
  if (props.label || props.showValue) {
    const valueLabel = props.showValue
      ? `<span class="mgr-bar-row__value">${Math.round(props.value)}${props.unit ?? ''}</span>`
      : '';
    return `<div class="mgr-bar-row ${props.className ?? ''}">
      ${props.label ? `<span class="mgr-bar-row__label">${escapeHtml(props.label)}</span>` : ''}
      <div class="mgr-bar ${colorClass}"><span style="width:${pct.toFixed(1)}%"></span></div>
      ${valueLabel}
    </div>`;
  }
  return `<div class="mgr-bar ${colorClass} ${props.className ?? ''}"><span style="width:${pct.toFixed(1)}%"></span></div>`;
}

/** Side-by-side comparison bar for two teams (left fills RTL, right fills LTR). */
export function comparisonBar(left: number, right: number, label: string): string {
  const total = left + right || 1;
  const leftPct = (left / total) * 100;
  const rightPct = (right / total) * 100;
  return `<div class="mgr-comp-bar">
    <div class="mgr-comp-bar__label">${escapeHtml(label)}</div>
    <div class="mgr-comp-bar__track">
      <span class="mgr-comp-bar__left" style="width:${leftPct.toFixed(1)}%"></span>
      <span class="mgr-comp-bar__right" style="width:${rightPct.toFixed(1)}%"></span>
    </div>
    <div class="mgr-comp-bar__values"><span>${Math.round(left)}</span><span>${Math.round(right)}</span></div>
  </div>`;
}
