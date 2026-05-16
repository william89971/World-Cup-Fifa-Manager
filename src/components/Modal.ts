import { button, type ButtonProps } from './Button';
import { escapeHtml } from './colors';

export interface ModalAction extends ButtonProps {}

export interface ModalProps {
  title: string;
  body: string;
  actions: ModalAction[];
  dismissible?: boolean;
}

export function modalMarkup(props: ModalProps): string {
  return `<div class="mgr-modal-backdrop" data-action="modal-dismiss-bg">
    <div class="mgr-modal" role="dialog" aria-modal="true">
      <h2>${escapeHtml(props.title)}</h2>
      <div>${props.body}</div>
      <div class="mgr-modal__actions">
        ${props.actions.map((action) => button(action)).join('')}
      </div>
    </div>
  </div>`;
}

/**
 * Mount a transient modal into document.body, returning a dispose function.
 * Click handlers route through onAction with the data-action value of the
 * clicked element. The modal is removed when dispose() runs or when an action
 * with dataAction='modal-close' (or background click if dismissible) fires.
 */
export function mountModal(
  props: ModalProps,
  onAction: (action: string, dataAttrs: DOMStringMap) => void,
): () => void {
  const host = document.createElement('div');
  host.innerHTML = modalMarkup(props);
  document.body.append(host);

  const dispose = (): void => {
    host.remove();
  };

  host.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    const action = target.dataset.action;
    if (!action) return;
    if (action === 'modal-dismiss-bg') {
      if (props.dismissible !== false && target === event.target) dispose();
      return;
    }
    if (action === 'modal-close') {
      dispose();
      return;
    }
    onAction(action, target.dataset);
  });

  return dispose;
}
