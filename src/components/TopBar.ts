import { button } from './Button';
import { escapeHtml } from './colors';

export interface TopBarAction {
  label: string;
  dataAction: string;
  variant?: 'default' | 'primary' | 'ghost';
}

export interface TopBarProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: TopBarAction[];
  backDataAction?: string;
  backLabel?: string;
}

export function topBar(props: TopBarProps): string {
  const back = props.backDataAction
    ? button({
        label: props.backLabel ?? 'Back',
        dataAction: props.backDataAction,
        variant: 'ghost',
        size: 'sm',
      })
    : '';
  const actions = props.actions
    ? props.actions
        .map((action) =>
          button({
            label: action.label,
            dataAction: action.dataAction,
            variant: action.variant ?? 'default',
            size: 'sm',
          }),
        )
        .join('')
    : '';
  return `<header class="mgr-topbar">
    ${back}
    <div class="mgr-topbar__title">
      <p class="mgr-topbar__eyebrow">${escapeHtml(props.eyebrow)}</p>
      <h1>${escapeHtml(props.title)}</h1>
      ${props.subtitle ? `<p class="mgr-muted">${escapeHtml(props.subtitle)}</p>` : ''}
    </div>
    <div class="mgr-topbar__spacer"></div>
    <div class="mgr-topbar__actions">${actions}</div>
  </header>`;
}
