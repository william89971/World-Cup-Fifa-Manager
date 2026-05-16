import { escapeHtml } from './colors';

export interface TabItem {
  id: string;
  label: string;
  badge?: string;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  dataAction: string;
}

export function tabs(props: TabsProps): string {
  return `<div class="mgr-tabs">
    ${props.items
      .map(
        (item) => `<button type="button"
          class="mgr-tabs__item ${item.id === props.activeId ? 'mgr-tabs__item--active' : ''}"
          data-action="${escapeHtml(props.dataAction)}"
          data-tab="${escapeHtml(item.id)}">
          ${escapeHtml(item.label)}${item.badge ? ` <span class="mgr-pill">${escapeHtml(item.badge)}</span>` : ''}
        </button>`,
      )
      .join('')}
  </div>`;
}
