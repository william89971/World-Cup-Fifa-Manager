import { button } from '../../components/Button';
import { tabs } from '../../components/Tabs';
import { table } from '../../components/Table';
import { topBar } from '../../components/TopBar';
import { pill } from '../../components/Pill';
import { bar } from '../../components/Bar';
import { escapeHtml, ratingBarClass } from '../../components/colors';
import { playerKey } from '../../tournament/TournamentState';
import { formatRoleLabel, TRAIT_KEYS } from '../../game/playerTypes';
import type { ScreenModule } from '../../app/ScreenRouter';
import type { TournamentState } from '../../tournament/TournamentState';
import type { TournamentPlayerProfile } from '../../tournament/teams';

export interface SquadScreenProps {
  tournament: TournamentState;
  tab?: 'xi' | 'bench' | 'all';
  sortBy?: 'role' | 'ovr' | 'condition' | 'morale' | 'form';
  filterRole?: 'all' | 'GK' | 'DEF' | 'MID' | 'ATT';
}

export interface SquadScreenHandlers {
  onBack: () => void;
  onOpenPlayer: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
  onMoveToXI: (playerId: string) => void;
  onMoveToBench: (playerId: string) => void;
  onSetTab: (tab: 'xi' | 'bench' | 'all') => void;
  onSetSort: (sort: 'role' | 'ovr' | 'condition' | 'morale' | 'form') => void;
  onSetFilter: (filter: 'all' | 'GK' | 'DEF' | 'MID' | 'ATT') => void;
}

function roleBand(role: TournamentPlayerProfile['role']): 'GK' | 'DEF' | 'MID' | 'ATT' {
  if (role === 'goalkeeper') return 'GK';
  if (role.includes('Back')) return 'DEF';
  if (role.includes('Mid')) return 'MID';
  return 'ATT';
}

function overall(p: TournamentPlayerProfile): number {
  let sum = 0;
  for (const k of TRAIT_KEYS) sum += p.traits[k];
  return Math.round((sum / TRAIT_KEYS.length) * 100);
}

export function createSquadScreen(handlers: SquadScreenHandlers): ScreenModule<SquadScreenProps> {
  return {
    render(host, props) {
      const tournament = props.tournament;
      const team = tournament.getTeam(tournament.selectedTeamId);
      const lineup = tournament.selectedLineup;
      const captainId = lineup?.captainId;
      const tab = props.tab ?? 'all';
      const sortBy = props.sortBy ?? 'role';
      const filter = props.filterRole ?? 'all';

      const all: Array<TournamentPlayerProfile & { onBench: boolean; id: string }> = [
        ...team.players.map((p) => ({ ...p, onBench: false, id: playerKey(team.id, p) })),
        ...team.bench.map((p) => ({ ...p, onBench: true, id: playerKey(team.id, p) })),
      ];
      let rows = all;
      if (tab === 'xi') rows = all.filter((p) => !p.onBench);
      else if (tab === 'bench') rows = all.filter((p) => p.onBench);
      if (filter !== 'all') rows = rows.filter((p) => roleBand(p.role) === filter);

      rows = [...rows].sort((a, b) => {
        if (sortBy === 'ovr') return overall(b) - overall(a);
        if (sortBy === 'condition') return (b.condition ?? 100) - (a.condition ?? 100);
        if (sortBy === 'morale') return (b.morale ?? 70) - (a.morale ?? 70);
        if (sortBy === 'form') return (b.form ?? 0) - (a.form ?? 0);
        // role
        const order = ['goalkeeper', 'leftBack', 'centerBackLeft', 'centerBackRight', 'rightBack', 'defensiveMid', 'centralMid', 'attackingMid', 'leftWing', 'rightWing', 'striker'];
        return order.indexOf(a.role) - order.indexOf(b.role);
      });

      const tableMarkup = table({
        columns: [
          { key: 'name', label: 'Player' },
          { key: 'role', label: 'Role' },
          { key: 'num', label: '#', align: 'center' },
          { key: 'ovr', label: 'OVR', align: 'center' },
          { key: 'cond', label: 'Cond' },
          { key: 'mor', label: 'Mor' },
          { key: 'form', label: 'Form', align: 'center' },
          { key: 'status', label: 'Status', align: 'right' },
        ],
        rows: rows.map((p) => {
          const cond = p.condition ?? 100;
          const mor = p.morale ?? 70;
          const form = p.form ?? 0;
          const tone = cond < 40 ? 'danger' : cond < 60 ? 'warn' : undefined;
          const statusBadges: string[] = [];
          if (p.id === captainId) statusBadges.push(pill({ label: 'C', tone: 'accent', title: 'Captain' }));
          if (p.onBench) statusBadges.push(pill({ label: 'Bench' }));
          else statusBadges.push(pill({ label: 'XI', tone: 'success' }));
          return {
            tone,
            dataAction: 'open-player',
            dataAttrs: { id: p.id },
            cells: {
              name: `<strong>${escapeHtml(p.name)}</strong> <span class="mgr-muted">${escapeHtml(p.personality)}</span>`,
              role: escapeHtml(formatRoleLabel(p.role)),
              num: String(p.number),
              ovr: `<span class="mgr-pill mgr-pill--accent">${overall(p)}</span>`,
              cond: bar({ value: cond, max: 100, colorClass: ratingBarClass(cond) }),
              mor: bar({ value: mor, max: 100, colorClass: ratingBarClass(mor) }),
              form: form > 0 ? `<span style="color:var(--success)">+${form.toFixed(1)}</span>` : form < 0 ? `<span style="color:var(--danger)">${form.toFixed(1)}</span>` : '0',
              status: statusBadges.join(' '),
            },
          };
        }),
        emptyLabel: 'No players match this filter.',
      });

      host.innerHTML = `
        <div class="mgr-screen">
          <div class="mgr-container">
            ${topBar({
              eyebrow: 'Manager Mode',
              title: `${team.name} — Squad`,
              subtitle: `Tap a player for full profile. Captain: ${captainId ? captainName(captainId, all) : '—'}`,
              backDataAction: 'back',
              actions: [
                { label: 'Tactics', dataAction: 'nav-tactics' },
                { label: 'Lineup', dataAction: 'nav-lineup' },
              ],
            })}
            ${tabs({
              items: [
                { id: 'all', label: 'All (' + all.length + ')' },
                { id: 'xi', label: 'Starting XI' },
                { id: 'bench', label: 'Bench' },
              ],
              activeId: tab,
              dataAction: 'set-tab',
            })}
            <div class="mgr-row">
              <span class="mgr-muted" style="margin-right:8px;">Sort:</span>
              ${button({ label: 'Role', dataAction: 'set-sort', dataAttrs: { sort: 'role' }, variant: sortBy === 'role' ? 'primary' : 'default', size: 'sm' })}
              ${button({ label: 'OVR', dataAction: 'set-sort', dataAttrs: { sort: 'ovr' }, variant: sortBy === 'ovr' ? 'primary' : 'default', size: 'sm' })}
              ${button({ label: 'Cond', dataAction: 'set-sort', dataAttrs: { sort: 'condition' }, variant: sortBy === 'condition' ? 'primary' : 'default', size: 'sm' })}
              ${button({ label: 'Morale', dataAction: 'set-sort', dataAttrs: { sort: 'morale' }, variant: sortBy === 'morale' ? 'primary' : 'default', size: 'sm' })}
              ${button({ label: 'Form', dataAction: 'set-sort', dataAttrs: { sort: 'form' }, variant: sortBy === 'form' ? 'primary' : 'default', size: 'sm' })}
              <span class="mgr-spacer"></span>
              <span class="mgr-muted" style="margin-right:8px;">Filter:</span>
              ${['all', 'GK', 'DEF', 'MID', 'ATT'].map((f) => button({ label: f.toUpperCase(), dataAction: 'set-filter', dataAttrs: { filter: f }, variant: filter === f ? 'primary' : 'default', size: 'sm' })).join('')}
            </div>
            <section class="mgr-card">${tableMarkup}</section>
          </div>
        </div>
      `;

      host.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
        el.addEventListener('click', () => {
          const action = el.dataset.action;
          if (!action) return;
          if (action === 'back') handlers.onBack();
          else if (action === 'open-player' && el.dataset.id) handlers.onOpenPlayer(el.dataset.id);
          else if (action === 'set-tab' && el.dataset.tab) handlers.onSetTab(el.dataset.tab as 'xi' | 'bench' | 'all');
          else if (action === 'set-sort' && el.dataset.sort) handlers.onSetSort(el.dataset.sort as 'role' | 'ovr' | 'condition' | 'morale' | 'form');
          else if (action === 'set-filter' && el.dataset.filter) handlers.onSetFilter(el.dataset.filter as 'all' | 'GK' | 'DEF' | 'MID' | 'ATT');
          else if (action === 'nav-tactics') handlers.onSetTab('all'); // re-route via Game
        });
      });
    },
  };
}

function captainName(id: string, all: Array<{ id: string; name: string }>): string {
  return all.find((p) => p.id === id)?.name ?? '—';
}
