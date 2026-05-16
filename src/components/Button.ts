import { escapeHtml } from './colors';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  dataAction?: string;
  dataAttrs?: Record<string, string>;
  block?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: string;
  title?: string;
}

export function button(props: ButtonProps): string {
  const variantClass =
    props.variant === 'primary'
      ? 'mgr-btn--primary'
      : props.variant === 'danger'
      ? 'mgr-btn--danger'
      : props.variant === 'ghost'
      ? 'mgr-btn--ghost'
      : '';
  const sizeClass = props.size === 'sm' ? 'mgr-btn--sm' : props.size === 'lg' ? 'mgr-btn--lg' : '';
  const blockClass = props.block ? 'mgr-btn--block' : '';
  const extra = props.className ?? '';
  const dataAction = props.dataAction ? ` data-action="${escapeHtml(props.dataAction)}"` : '';
  const attrs = props.dataAttrs
    ? Object.entries(props.dataAttrs)
        .map(([key, value]) => ` data-${key}="${escapeHtml(value)}"`)
        .join('')
    : '';
  const disabled = props.disabled ? ' disabled' : '';
  const title = props.title ? ` title="${escapeHtml(props.title)}"` : '';
  const icon = props.icon ? `<span aria-hidden="true">${props.icon}</span>` : '';
  return `<button type="button" class="mgr-btn ${variantClass} ${sizeClass} ${blockClass} ${extra}"${dataAction}${attrs}${disabled}${title}>${icon}${escapeHtml(props.label)}</button>`;
}
