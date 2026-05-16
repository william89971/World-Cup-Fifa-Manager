import { button } from '../components/Button';
import { pill } from '../components/Pill';
import type { ScreenModule } from '../app/ScreenRouter';

export interface HomeScreenProps {
  hasSave: boolean;
  saveSummary?: string;
}

export interface HomeScreenHandlers {
  onTournament: () => void;
  onManagerMode: () => void;
  onTraining: () => void;
  onSettings: () => void;
}

export function createHomeScreen(handlers: HomeScreenHandlers): ScreenModule<HomeScreenProps> {
  return {
    render(host, props) {
      console.log('[menu] HomeScreen rendered (hasSave=' + props.hasSave + ')');
      const summary = props.saveSummary
        ? pill({ label: props.saveSummary, tone: 'accent' })
        : pill({ label: 'No save yet', tone: 'default' });
      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-hero">
            <p class="mgr-topbar__eyebrow">Original football manager</p>
            <h1>Global Retro Cup — Manager</h1>
            <p>Lead a country through a 48-team retro tournament. Set tactics, train your squad, scout opponents, then watch the match unfold.</p>
            <div style="margin-top:16px;">${summary}</div>
          </div>
          <div class="mgr-container" style="max-width:540px;">
            <div class="mgr-col">
              ${button({ label: 'Tournament', dataAction: 'home-tournament', variant: 'primary', size: 'lg', block: true })}
              ${button({ label: 'Manager Mode', dataAction: 'home-manager', size: 'lg', block: true, disabled: false })}
              ${button({ label: 'Training', dataAction: 'home-training', size: 'lg', block: true })}
              ${button({ label: 'Settings', dataAction: 'home-settings', size: 'lg', block: true })}
            </div>
            <p class="mgr-muted" style="text-align:center; font-size:11px; margin-top:24px; letter-spacing:0.08em; text-transform:uppercase;">
              Original tournament · Fictional rosters · No federation or third-party assets
            </p>
          </div>
        </div>
      `;
      host.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
        el.addEventListener('click', () => {
          const action = el.dataset.action;
          if (action === 'home-tournament') {
            console.log('[menu] Tournament clicked');
            handlers.onTournament();
          } else if (action === 'home-manager') {
            console.log('[menu] Manager Mode clicked');
            handlers.onManagerMode();
          } else if (action === 'home-training') {
            console.log('[menu] Training clicked');
            handlers.onTraining();
          } else if (action === 'home-settings') {
            console.log('[menu] Settings clicked');
            handlers.onSettings();
          }
        });
      });
    },
  };
}
