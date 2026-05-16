import { button } from '../../components/Button';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { escapeHtml } from '../../components/colors';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';
import type { NewsItem } from '../../manager/types';

export interface InboxScreenProps {
  tournament: TournamentState;
}

export interface InboxScreenHandlers {
  onBack: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function createInboxScreen(handlers: InboxScreenHandlers): ScreenModule<InboxScreenProps> {
  return {
    render(host, props) {
      let selectedId: string | null = null;
      const tournament = props.tournament;

      function rerender(): void {
        const news = tournament.news;
        const selected = news.find((n) => n.id === selectedId) ?? news[0];
        host.innerHTML = `
          <div class="mgr-screen">
            <div class="mgr-container">
              ${topBar({
                eyebrow: 'Manager Mode',
                title: 'Inbox',
                subtitle: `${news.length} messages · ${news.filter((n) => !n.read).length} unread`,
                backDataAction: 'back',
                actions: [{ label: 'Mark all read', dataAction: 'mark-all' }],
              })}
              <div class="mgr-grid" style="grid-template-columns: minmax(260px, 1fr) minmax(280px, 2fr);">
                <section class="mgr-card" style="max-height:70vh; overflow-y:auto;">
                  ${news.length === 0
                    ? '<p class="mgr-muted">Inbox is empty. Play a match to generate news.</p>'
                    : news.map((item) => itemRow(item, selected?.id === item.id)).join('')}
                </section>
                <section class="mgr-card">
                  ${selected ? renderDetail(selected) : '<p class="mgr-muted">Pick a message to read.</p>'}
                </section>
              </div>
            </div>
          </div>
        `;
        bind();
      }

      function bind(): void {
        host.querySelector('[data-action="back"]')?.addEventListener('click', handlers.onBack);
        host.querySelector('[data-action="mark-all"]')?.addEventListener('click', () => {
          handlers.onMarkAllRead();
          rerender();
        });
        host.querySelectorAll<HTMLElement>('[data-action="open"]').forEach((el) =>
          el.addEventListener('click', () => {
            const id = el.dataset.id;
            if (!id) return;
            selectedId = id;
            handlers.onMarkRead(id);
            rerender();
          }),
        );
      }

      rerender();
    },
  };
}

function itemRow(item: NewsItem, isSelected: boolean): string {
  return `<button type="button" class="mgr-btn mgr-btn--block" data-action="open" data-id="${item.id}" style="justify-content:flex-start; padding:10px; height:auto; flex-direction:column; align-items:flex-start; gap:4px; text-transform:none; letter-spacing:0; background:${isSelected ? 'rgba(45,125,255,0.18)' : ''};">
    <div class="mgr-row" style="justify-content:space-between; width:100%;">
      <strong>${escapeHtml(item.title)}</strong>${item.read ? '' : pill({ label: 'NEW', tone: 'accent' })}
    </div>
    <span class="mgr-muted" style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em;">${escapeHtml(item.kind)}</span>
  </button>`;
}

function renderDetail(item: NewsItem): string {
  return `<h2 class="mgr-card__title">${escapeHtml(item.title)}</h2>
    <p class="mgr-muted">${pill({ label: item.kind, tone: 'accent' })}</p>
    <p>${escapeHtml(item.body)}</p>`;
}
