export type CardAccent = 'default' | 'accent' | 'success' | 'warn' | 'danger';

export interface CardProps {
  title?: string;
  body: string;
  footer?: string;
  accent?: CardAccent;
  className?: string;
  icon?: string;
}

export function card(props: CardProps): string {
  const accentClass =
    props.accent === 'accent'
      ? 'mgr-card--accent'
      : props.accent === 'success'
      ? 'mgr-card--success'
      : props.accent === 'warn'
      ? 'mgr-card--warn'
      : props.accent === 'danger'
      ? 'mgr-card--danger'
      : '';
  const extra = props.className ?? '';
  const title = props.title ? `<h2 class="mgr-card__title">${props.icon ?? ''}${props.title}</h2>` : '';
  const footer = props.footer ? `<div class="mgr-card__footer">${props.footer}</div>` : '';
  return `<section class="mgr-card ${accentClass} ${extra}">${title}<div class="mgr-card__body">${props.body}</div>${footer}</section>`;
}
