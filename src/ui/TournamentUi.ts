import type { Fixture, Standing, TournamentSnapshot } from '../tournament/TournamentState';
import type { Difficulty, GameSettings, GraphicsQuality, SimDetail } from '../tournament/storage';
import {
  TOURNAMENT_TEAMS,
  getTeamById,
  type TournamentTeam,
  type TournamentPlayerProfile,
} from '../tournament/teams';
import {
  TRAIT_KEYS,
  formatRoleLabel,
  type FormationName,
  type TeamStyle,
  type TraitKey,
} from '../game/playerTypes';
import type { UserTactics } from '../game/GameState';

const TRAIT_LABEL: Record<TraitKey, string> = {
  aggression: 'Aggression',
  discipline: 'Discipline',
  creativity: 'Creativity',
  teamwork: 'Teamwork',
  shooting: 'Shooting',
  passing: 'Passing',
  dribbling: 'Dribbling',
  defending: 'Defending',
  speed: 'Pace',
  stamina: 'Stamina',
  positioning: 'Positioning',
  riskTaking: 'Risk taking',
  composure: 'Composure',
};

const FORMATION_OPTIONS: FormationName[] = ['4-3-3', '4-4-2', '3-5-2'];

const TEAM_STYLE_OPTIONS: Array<{ style: TeamStyle; blurb: string }> = [
  { style: 'possession', blurb: 'Keep the ball, drag opponents out of shape. Passing and teamwork up.' },
  { style: 'counterAttack', blurb: 'Sit deeper, break fast. Pace and risk-taking up.' },
  { style: 'highPress', blurb: 'Win the ball high. Aggression and stamina up, discipline down.' },
  { style: 'defensive', blurb: 'Compact low block. Defending and discipline up, risk-taking down.' },
  { style: 'balanced', blurb: 'No emphasis — uses the squad as-is.' },
  { style: 'directAttack', blurb: 'Vertical, get it forward fast. Shooting and risk-taking up.' },
];

export interface MatchCompleteViewModel {
  userTeamName: string;
  opponentTeamName: string;
  userScore: number;
  opponentScore: number;
  stage: string;
}

export interface TournamentUiHandlers {
  onNewTournament: () => void;
  onContinueTournament: () => void;
  onSelectTeam: (teamId: string) => void;
  onPlayNextMatch: () => void;
  onSimulateNextMatch: () => void;
  onSimulateAll: () => void;
  onOpenHome: () => void;
  onOpenCountrySelection: () => void;
  onOpenGroupStage: () => void;
  onOpenMatchPreview: () => void;
  onOpenBracket: () => void;
  onOpenSettings: () => void;
  onSetMatchLength: (seconds: number) => void;
  onToggleCrowd: () => void;
  onSetGraphicsQuality: (quality: GraphicsQuality) => void;
  onSetCameraSensitivity: (sensitivity: number) => void;
  onToggleSound: () => void;
  onSetMobileControlsOpacity: (opacity: number) => void;
  onResetTournamentSave: () => void;
  onResetSettings: () => void;
  onSetDifficulty: (difficulty: Difficulty) => void;
  onSetSimDetail: (detail: SimDetail) => void;
  onSetDefaultMatchSpeed: (speed: 1 | 2 | 4) => void;
  onToggleDebugMode: () => void;
  onAcknowledgeMatchComplete: () => void;
  onOpenSquad: () => void;
  onOpenTactics: () => void;
  onConfirmTactics: (tactics: UserTactics, lineupIds: string[]) => void;
}

export class TournamentUi {
  readonly element: HTMLDivElement;
  private handlers?: TournamentUiHandlers;
  // In-progress tactics editor state. Persisted across re-renders of the tactics
  // screen so the user's button picks stick when we redraw to highlight selection.
  private tacticsDraft?: { team: TournamentTeam; tactics: UserTactics };

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'tournament';
    this.element.addEventListener('click', this.handleClick);
    this.element.addEventListener('change', this.handleChange);
    parent.append(this.element);
  }

  bind(handlers: TournamentUiHandlers): void {
    this.handlers = handlers;
  }

  hide(): void {
    this.element.classList.add('tournament--hidden');
  }

  show(): void {
    this.element.classList.remove('tournament--hidden');
  }

  renderHome(hasSave: boolean): void {
    this.show();
    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--home">
        <header class="home-hero">
          <p class="tournament__eyebrow">Original international 11v11 tournament</p>
          <h1>World Cup 2026 — Manager</h1>
          <p>Choose a country-style team, survive the 48-team group stage, and play your way through a 32-team knockout bracket.</p>
          <div class="tournament__actions">
            <button class="ui-button ui-button--primary" data-action="new">New Tournament</button>
            ${hasSave ? '<button class="ui-button" data-action="continue">Continue Tournament</button>' : ''}
            <button class="ui-button" data-action="settings">Settings</button>
          </div>
        </header>
      </section>
    `;
  }

  renderCountrySelection(): void {
    this.show();
    this.element.innerHTML = `
      <section class="tournament__screen">
        ${this.renderTopBar('Country Selection')}
        <div class="team-grid">
          ${TOURNAMENT_TEAMS.map((team) => this.renderTeamButton(team)).join('')}
        </div>
      </section>
    `;
  }

  renderGroupStage(snapshot: TournamentSnapshot): void {
    this.show();
    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--dashboard">
        ${this.renderTopBar('Group Stage', snapshot)}
        ${this.renderNextMatchCard(snapshot)}
        <div class="tournament-layout tournament-layout--wide">
          <section class="tournament-card">
            <h2>Group Standings</h2>
            <div class="groups">${snapshot.groups.map((group) => this.renderGroup(group, snapshot)).join('')}</div>
          </section>
          <section class="tournament-card">
            <h2>Best Third-Place Ranking</h2>
            ${this.renderBestThirdTable(snapshot)}
          </section>
          <section class="tournament-card">
            <h2>Upcoming & Recent Fixtures</h2>
            <div class="fixture-list">${this.getRelevantFixtures(snapshot).map((fixture) => this.renderFixture(fixture, snapshot.selectedTeam.id)).join('')}</div>
          </section>
        </div>
      </section>
    `;
  }

  renderMatchPreview(snapshot: TournamentSnapshot): void {
    this.show();
    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--dashboard">
        ${this.renderTopBar('Match Preview', snapshot)}
        ${this.renderNextMatchCard(snapshot, true)}
        <div class="tournament__actions" style="margin: 12px 0;">
          <button class="ui-button" data-action="open-squad">View Squad</button>
          <button class="ui-button" data-action="open-tactics">Set Tactics &amp; Lineup</button>
        </div>
        <div class="tournament-layout">
          <section class="tournament-card">
            <h2>Selected Team</h2>
            ${this.renderTeamProfile(snapshot.selectedTeam)}
          </section>
          <section class="tournament-card">
            <h2>Tournament Progress</h2>
            ${this.renderProgress(snapshot)}
          </section>
        </div>
      </section>
    `;
  }

  renderSquad(team: TournamentTeam, snapshot?: TournamentSnapshot): void {
    this.show();
    const sorted = [...team.players].sort((a, b) => {
      const ai = TEAM_ROLE_ORDER.indexOf(a.role);
      const bi = TEAM_ROLE_ORDER.indexOf(b.role);
      if (ai !== bi) return ai - bi;
      return a.number - b.number;
    });
    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--dashboard">
        ${this.renderTopBar('Squad', snapshot)}
        <section class="tournament-card">
          <h2>${team.name} squad — talents, traits, weaknesses</h2>
          <p class="muted">Every player has 13 traits. Talents are the top three; weaknesses are anything below 0.50.</p>
          <div class="squad-grid">
            ${sorted.map((profile) => this.renderSquadCard(profile, team)).join('')}
          </div>
        </section>
      </section>
    `;
  }

  renderTactics(team: TournamentTeam, snapshot?: TournamentSnapshot, current?: UserTactics): void {
    this.show();
    const activeFormation: FormationName = current?.formation ?? team.formationPreferences[0] ?? '4-3-3';
    const activeStyle: TeamStyle = current?.teamStyle ?? team.teamStyle;
    // Cache draft state so in-screen tactic buttons can update it on each click.
    this.tacticsDraft = { team, tactics: { formation: activeFormation, teamStyle: activeStyle } };
    // Auto-pick best 11 for the active formation: take the highest-overall player per role
    // (using the canonical TEAM_ROLE_ORDER ordering).
    const lineup = pickBestEleven(team);

    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--dashboard">
        ${this.renderTopBar('Tactics & Lineup', snapshot)}
        <section class="tournament-card">
          <h2>Set up your match — ${team.name}</h2>
          <div class="tournament-layout">
            <div>
              <h3>Formation</h3>
              <div class="segmented">
                ${FORMATION_OPTIONS.map(
                  (formation) =>
                    `<button class="ui-button ${formation === activeFormation ? 'ui-button--primary' : ''}" data-action="tactic-formation" data-formation="${formation}">${formation}</button>`,
                ).join('')}
              </div>

              <h3 style="margin-top: 18px;">Team style</h3>
              <div class="style-grid">
                ${TEAM_STYLE_OPTIONS.map(
                  ({ style, blurb }) =>
                    `<button class="ui-button ${style === activeStyle ? 'ui-button--primary' : ''}" data-action="tactic-style" data-team-style="${style}" title="${blurb}">${formatTeamStyle(style)}</button>`,
                ).join('')}
              </div>
              <p class="muted" style="margin-top: 8px;">${TEAM_STYLE_OPTIONS.find((o) => o.style === activeStyle)?.blurb ?? ''}</p>
            </div>

            <div>
              <h3>Starting XI (auto-picked best XI)</h3>
              <ul class="lineup-list">
                ${lineup
                  .map(
                    (profile) =>
                      `<li><strong>${formatRoleLabel(profile.role)}</strong> &nbsp; #${profile.number} ${profile.name} &nbsp; <span class="muted">${profile.personality}</span> &nbsp; <span class="muted">${profile.topTraits.map((t) => TRAIT_LABEL[t.key]).join(' / ')}</span></li>`,
                  )
                  .join('')}
              </ul>
            </div>
          </div>

          <div class="tournament__actions" style="margin-top: 18px;">
            <button class="ui-button ui-button--primary"
              data-action="confirm-tactics"
              data-formation="${activeFormation}"
              data-team-style="${activeStyle}"
              data-lineup="${lineup.map((p) => squadPlayerId(team, p)).join(',')}">
              Confirm &amp; Watch Match
            </button>
            <button class="ui-button" data-action="preview">Back to Preview</button>
          </div>
        </section>
      </section>
    `;
  }

  private renderSquadCard(profile: TournamentPlayerProfile, team: TournamentTeam): string {
    const orderedTraits = [...TRAIT_KEYS].map((key) => ({ key, value: profile.traits[key] }));
    const weaknesses = orderedTraits
      .filter((t) => t.value < 0.5)
      .sort((a, b) => a.value - b.value)
      .slice(0, 3);
    const talents = profile.topTraits.slice(0, 3);
    const teamColorCss = colorToCssNumber(team.colors.primary);
    return `
      <article class="squad-card" style="border-left: 4px solid ${teamColorCss};">
        <header>
          <strong>#${profile.number} ${profile.name}</strong>
          <span class="muted">${formatRoleLabel(profile.role)} · ${profile.personality}</span>
        </header>
        <div class="squad-card__traits">
          ${orderedTraits
            .map(
              (trait) => `
                <div class="trait-row">
                  <span>${TRAIT_LABEL[trait.key]}</span>
                  <div class="trait-bar">
                    <span style="width: ${Math.round(trait.value * 100)}%; background: ${traitColor(trait.value)};"></span>
                  </div>
                  <span class="trait-value">${Math.round(trait.value * 100)}</span>
                </div>
              `,
            )
            .join('')}
        </div>
        <footer class="squad-card__summary">
          <div><strong>Talents</strong> ${talents.map((t) => TRAIT_LABEL[t.key]).join(' · ') || '—'}</div>
          <div><strong>Weaknesses</strong> ${weaknesses.map((t) => TRAIT_LABEL[t.key]).join(' · ') || 'None'}</div>
        </footer>
      </article>
    `;
  }

  renderBracket(snapshot: TournamentSnapshot): void {
    this.show();
    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--dashboard">
        ${this.renderTopBar('Knockout Bracket', snapshot)}
        <section class="tournament-card">
          <h2>Knockout Bracket</h2>
          ${this.renderBracketContent(snapshot.fixtures, snapshot.selectedTeam.id)}
        </section>
      </section>
    `;
  }

  renderChampion(snapshot: TournamentSnapshot): void {
    const champion = snapshot.championTeamId
      ? getTeamById(snapshot.championTeamId)
      : undefined;
    this.show();
    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--dashboard">
        ${this.renderTopBar('Champion', snapshot)}
        ${
          champion
            ? this.renderChampionCard(champion)
            : '<section class="champion"><h2>No champion yet</h2></section>'
        }
        <section class="tournament-card">
          <h2>Final Bracket</h2>
          ${this.renderBracketContent(snapshot.fixtures, snapshot.selectedTeam.id)}
        </section>
      </section>
    `;
  }

  renderSettings(settings: GameSettings, snapshot?: TournamentSnapshot, hasSave = false): void {
    this.show();
    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--dashboard">
        ${this.renderTopBar('Settings', snapshot, hasSave)}
        <section class="tournament-card settings-grid">
          <div>
            <h2>Match Length</h2>
            <div class="segmented">
              ${[90, 180, 300]
                .map(
                  (seconds) =>
                    `<button class="ui-button ${settings.matchLengthSeconds === seconds ? 'ui-button--primary' : ''}" data-action="set-match-length" data-seconds="${seconds}">${seconds / 60} min</button>`,
                )
                .join('')}
            </div>
          </div>
          <div>
            <h2>Graphics Quality</h2>
            <div class="segmented">
              ${(['low', 'medium', 'high'] as const)
                .map(
                  (quality) =>
                    `<button class="ui-button ${settings.graphicsQuality === quality ? 'ui-button--primary' : ''}" data-action="set-quality" data-quality="${quality}">${quality}</button>`,
                )
                .join('')}
            </div>
          </div>
          <div>
            <h2>Camera</h2>
            <label class="settings-range">
              <span>Sensitivity ${settings.cameraSensitivity.toFixed(2)}x</span>
              <input type="range" min="0.55" max="1.6" step="0.05" value="${settings.cameraSensitivity}" data-action="set-camera-sensitivity" />
            </label>
          </div>
          <div>
            <h2>Touch Controls</h2>
            <label class="settings-range">
              <span>Opacity ${Math.round(settings.mobileControlsOpacity * 100)}%</span>
              <input type="range" min="0.45" max="1" step="0.01" value="${settings.mobileControlsOpacity}" data-action="set-mobile-opacity" />
            </label>
          </div>
          <div>
            <h2>Presentation</h2>
            <button class="ui-button" data-action="toggle-crowd">Crowd placeholders: ${settings.crowdEnabled ? 'On' : 'Off'}</button>
            <button class="ui-button" data-action="toggle-sound">Sound hooks: ${settings.soundEnabled ? 'On' : 'Off'}</button>
          </div>
          <div>
            <h2>Difficulty</h2>
            <div class="segmented">
              ${(['easy', 'normal', 'hard'] as const)
                .map(
                  (difficulty) =>
                    `<button class="ui-button ${settings.difficulty === difficulty ? 'ui-button--primary' : ''}" data-action="set-difficulty" data-difficulty="${difficulty}">${difficulty}</button>`,
                )
                .join('')}
            </div>
          </div>
          <div>
            <h2>Simulation detail</h2>
            <div class="segmented">
              ${(['full', 'instant'] as const)
                .map(
                  (detail) =>
                    `<button class="ui-button ${settings.simDetail === detail ? 'ui-button--primary' : ''}" data-action="set-sim-detail" data-detail="${detail}">${detail}</button>`,
                )
                .join('')}
            </div>
          </div>
          <div>
            <h2>Default match speed</h2>
            <div class="segmented">
              ${([1, 2, 4] as const)
                .map(
                  (speed) =>
                    `<button class="ui-button ${settings.defaultMatchSpeed === speed ? 'ui-button--primary' : ''}" data-action="set-speed" data-speed="${speed}">${speed}×</button>`,
                )
                .join('')}
            </div>
          </div>
          <div>
            <h2>Debug</h2>
            <button class="ui-button" data-action="toggle-debug">Debug mode: ${settings.debugMode ? 'On' : 'Off'}</button>
          </div>
          <div>
            <h2>Reset</h2>
            <button class="ui-button" data-action="reset-save">Reset tournament save</button>
            <button class="ui-button" data-action="reset-settings">Reset settings</button>
          </div>
        </section>
      </section>
    `;
  }

  renderMatchComplete(view: MatchCompleteViewModel): void {
    this.show();
    this.element.innerHTML = `
      <section class="tournament__screen tournament__screen--home">
        <section class="final-score-card">
          <p class="tournament__eyebrow">${view.stage} · Full time</p>
          <h1>${view.userTeamName} ${view.userScore} : ${view.opponentScore} ${view.opponentTeamName}</h1>
          <div class="tournament__actions">
            <button class="ui-button ui-button--primary" data-action="match-complete-next">Next Match</button>
            <button class="ui-button" data-action="groups">Group Stage</button>
            <button class="ui-button" data-action="bracket">Bracket</button>
          </div>
        </section>
      </section>
    `;
  }

  private renderTopBar(title: string, snapshot?: TournamentSnapshot, hasSave = false): string {
    return `
      <header class="tournament__header">
        <div>
          <p class="tournament__eyebrow">${title}</p>
          <h1>World Cup 2026 — Manager</h1>
          ${
            snapshot
              ? `<p class="tournament__summary">Controlling ${snapshot.selectedTeam.name}. ${snapshot.userEliminated ? 'Your team is eliminated; simulate to crown a champion.' : 'Play your fixtures and simulate the rest.'}</p>`
              : '<p class="tournament__summary">Country colors, inline flag layouts, fictional rosters, and no official federation or tournament assets.</p>'
          }
        </div>
        <div class="tournament__actions">
          <button class="ui-button" data-action="home">Home</button>
          ${snapshot || hasSave ? '<button class="ui-button" data-action="groups">Groups</button>' : ''}
          ${snapshot ? '<button class="ui-button" data-action="preview">Match Preview</button>' : ''}
          ${snapshot ? '<button class="ui-button" data-action="bracket">Bracket</button>' : ''}
          <button class="ui-button" data-action="settings">Settings</button>
        </div>
      </header>
    `;
  }

  private renderTeamButton(team: TournamentTeam): string {
    return `
      <button class="team-card" data-action="select-team" data-team-id="${team.id}">
        ${this.renderFlag(team)}
        <span class="team-card__name">${team.name}<small>${team.code}</small></span>
        <span class="team-card__rating">OVR ${team.rating.overall}</span>
      </button>
    `;
  }

  private renderNextMatchCard(snapshot: TournamentSnapshot, detailed = false): string {
    const fixture = snapshot.currentFixture ?? snapshot.nextFixture;

    if (!fixture) {
      return `
        <section class="next-match">
          <div>
            <p class="tournament__eyebrow">${snapshot.championTeamId ? 'Complete' : 'CPU phase'}</p>
            <h2>${snapshot.userEliminated ? 'Your team is eliminated' : 'No playable match queued'}</h2>
            <p>${snapshot.championTeamId ? 'The tournament has a champion.' : 'Simulate remaining fixtures to continue the tournament.'}</p>
          </div>
          ${!snapshot.championTeamId ? '<button class="ui-button ui-button--primary" data-action="simulate-all">Simulate remaining</button>' : ''}
        </section>
      `;
    }

    const home = getTeamById(fixture.homeTeamId);
    const away = getTeamById(fixture.awayTeamId);
    const isUserFixture =
      fixture.homeTeamId === snapshot.selectedTeam.id || fixture.awayTeamId === snapshot.selectedTeam.id;

    return `
      <section class="next-match">
        <div>
          <p class="tournament__eyebrow">${stageLabel(fixture.stage)}</p>
          <h2>${home.name} vs ${away.name}</h2>
          <p>${fixture.knockout ? 'Knockout matches use a simple penalty result if tied.' : 'Group standings use points, goal difference, goals for, then tie seed.'}</p>
          ${detailed ? `<div class="rating-row">${this.renderRatingPill(home)}${this.renderRatingPill(away)}</div>` : ''}
        </div>
        <div class="next-match__teams">
          ${this.renderMiniTeam(home)}
          <span class="next-match__versus">vs</span>
          ${this.renderMiniTeam(away)}
        </div>
        <div class="tournament__actions">
          ${
            isUserFixture && !snapshot.userEliminated
              ? '<button class="ui-button ui-button--primary" data-action="play">Play Match</button>'
              : '<button class="ui-button ui-button--primary" data-action="simulate-next">Simulate Match</button>'
          }
          <button class="ui-button" data-action="simulate-all">Simulate remaining</button>
        </div>
      </section>
    `;
  }

  private renderGroup(group: TournamentSnapshot['groups'][number], snapshot: TournamentSnapshot): string {
    return `
      <div class="group-table">
        <h3>Group ${group.id}</h3>
        <table>
          <thead><tr><th>Team</th><th>Pts</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>GF</th><th>GA</th></tr></thead>
          <tbody>
            ${rankStandings(group.standings)
              .map((standing) => this.renderStandingRow(standing, snapshot.selectedTeam.id))
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderBestThirdTable(snapshot: TournamentSnapshot): string {
    const rows = snapshot.groups
      .map((group) => rankStandings(group.standings)[2])
      .filter(Boolean)
      .sort(compareStandings)
      .map((standing, index) => {
        const team = getTeamById(standing.teamId);
        return `
          <tr class="${index < 8 ? 'qualified-row' : ''} ${standing.teamId === snapshot.selectedTeam.id ? 'user-row' : ''}">
            <td>${index + 1}</td>
            <td>${this.renderTinyFlag(team)} ${team.name}</td>
            <td>${standing.points}</td>
            <td>${standing.goalDifference}</td>
            <td>${standing.goalsFor}</td>
            <td>${standing.goalsAgainst}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <table>
        <thead><tr><th>#</th><th>Team</th><th>Pts</th><th>GD</th><th>GF</th><th>GA</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted">Top 8 third-place teams qualify for the Round of 32.</p>
    `;
  }

  private renderStandingRow(standing: Standing, selectedTeamId: string): string {
    const team = getTeamById(standing.teamId);
    return `
      <tr class="${standing.teamId === selectedTeamId ? 'user-row' : ''}">
        <td>${this.renderTinyFlag(team)} ${team.name}</td>
        <td>${standing.points}</td>
        <td>${standing.wins}</td>
        <td>${standing.draws}</td>
        <td>${standing.losses}</td>
        <td>${standing.goalDifference}</td>
        <td>${standing.goalsFor}</td>
        <td>${standing.goalsAgainst}</td>
      </tr>
    `;
  }

  private renderFixture(fixture: Fixture, selectedTeamId: string): string {
    const home = getTeamById(fixture.homeTeamId);
    const away = getTeamById(fixture.awayTeamId);
    const score =
      fixture.status === 'complete'
        ? `${fixture.homeScore} - ${fixture.awayScore}${fixture.decidedByPenalties ? ' (pens)' : ''}`
        : 'pending';
    const userFixture =
      fixture.homeTeamId === selectedTeamId || fixture.awayTeamId === selectedTeamId;

    return `
      <div class="fixture-row ${userFixture ? 'fixture-row--user' : ''}">
        <span>${stageLabel(fixture.stage)}${fixture.groupId ? ` ${fixture.groupId}` : ''}</span>
        <strong>${this.renderTinyFlag(home)} ${home.code}</strong>
        <em>${score}</em>
        <strong>${this.renderTinyFlag(away)} ${away.code}</strong>
      </div>
    `;
  }

  private renderBracketContent(fixtures: Fixture[], selectedTeamId: string): string {
    const knockoutFixtures = fixtures.filter((fixture) => fixture.knockout);

    if (knockoutFixtures.length === 0) {
      return '<p class="muted">Complete the group stage to generate the Round of 32.</p>';
    }

    const rounds = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];
    return `
      <div class="bracket">
        ${rounds
          .map((round) => {
            const roundFixtures = knockoutFixtures.filter((fixture) => fixture.stage === round);
            if (roundFixtures.length === 0) return '';
            return `
              <div class="bracket__round">
                <h3>${stageLabel(round)}</h3>
                ${roundFixtures.map((fixture) => this.renderFixture(fixture, selectedTeamId)).join('')}
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private renderChampionCard(team: TournamentTeam): string {
    return `
      <section class="champion">
        ${this.renderFlag(team)}
        <div>
          <p class="tournament__eyebrow">Champion</p>
          <h2>${team.name}</h2>
          <p>${team.name} wins the World Cup.</p>
        </div>
      </section>
    `;
  }

  private renderTeamProfile(team: TournamentTeam): string {
    return `
      <div class="team-profile">
        ${this.renderFlag(team)}
        <h3>${team.name} <span>${team.code}</span></h3>
        <div class="rating-row">
          ${this.renderRatingPill(team)}
          <span>${formatTeamStyle(team.teamStyle)}</span>
          <span>${team.formationPreferences.join(' / ')}</span>
          <span>ATK ${team.rating.attack}</span>
          <span>DEF ${team.rating.defense}</span>
          <span>SPD ${team.rating.speed}</span>
          <span>STA ${team.rating.stamina}</span>
        </div>
        <div class="roster-list">
          ${team.players
            .map(
              (player) =>
                `<span>#${player.number} ${player.name} · ${player.role} · ${player.personality} · ${player.topTraits.map((trait) => trait.key).join(', ')}</span>`,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  private renderProgress(snapshot: TournamentSnapshot): string {
    const complete = snapshot.fixtures.filter((fixture) => fixture.status === 'complete').length;
    return `
      <p>${complete} of ${snapshot.fixtures.length} fixtures complete.</p>
      <p>${snapshot.championTeamId ? `${getTeamById(snapshot.championTeamId).name} is champion.` : snapshot.userEliminated ? 'Your team is eliminated.' : 'Your team is still alive.'}</p>
    `;
  }

  private getRelevantFixtures(snapshot: TournamentSnapshot): Fixture[] {
    const pending = snapshot.fixtures.filter((fixture) => fixture.status === 'pending').slice(0, 12);
    const completed = snapshot.fixtures.filter((fixture) => fixture.status === 'complete').slice(-12);
    return [...completed, ...pending].slice(-24);
  }

  private renderMiniTeam(team: TournamentTeam): string {
    return `
      <div class="mini-team">
        ${this.renderFlag(team)}
        <span>${team.name}</span>
      </div>
    `;
  }

  private renderRatingPill(team: TournamentTeam): string {
    return `<span class="rating-pill">${team.code} OVR ${team.rating.overall}</span>`;
  }

  private renderTinyFlag(team: TournamentTeam): string {
    return this.renderFlag(team, true);
  }

  private renderFlag(team: TournamentTeam, tiny = false): string {
    return `<span class="flag ${tiny ? 'flag--tiny' : ''}">${team.flagSvg}</span>`;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const target =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[data-action]')
        : null;
    if (!target || !this.handlers) return;

    const action = target.dataset.action;
    if (action === 'new') this.handlers.onNewTournament();
    else if (action === 'continue') this.handlers.onContinueTournament();
    else if (action === 'select-team' && target.dataset.teamId) this.handlers.onSelectTeam(target.dataset.teamId);
    else if (action === 'play') this.handlers.onPlayNextMatch();
    else if (action === 'simulate-next') this.handlers.onSimulateNextMatch();
    else if (action === 'simulate-all') this.handlers.onSimulateAll();
    else if (action === 'home') this.handlers.onOpenHome();
    else if (action === 'country') this.handlers.onOpenCountrySelection();
    else if (action === 'groups') this.handlers.onOpenGroupStage();
    else if (action === 'preview') this.handlers.onOpenMatchPreview();
    else if (action === 'bracket') this.handlers.onOpenBracket();
    else if (action === 'settings') this.handlers.onOpenSettings();
    else if (action === 'set-match-length' && target.dataset.seconds) this.handlers.onSetMatchLength(Number(target.dataset.seconds));
    else if (action === 'toggle-crowd') this.handlers.onToggleCrowd();
    else if (action === 'set-quality' && isGraphicsQuality(target.dataset.quality)) this.handlers.onSetGraphicsQuality(target.dataset.quality);
    else if (action === 'toggle-sound') this.handlers.onToggleSound();
    else if (action === 'reset-save') this.handlers.onResetTournamentSave();
    else if (action === 'reset-settings') this.handlers.onResetSettings();
    else if (action === 'set-difficulty' && target.dataset.difficulty) {
      const d = target.dataset.difficulty;
      if (d === 'easy' || d === 'normal' || d === 'hard') this.handlers.onSetDifficulty(d);
    }
    else if (action === 'set-sim-detail' && target.dataset.detail) {
      const d = target.dataset.detail;
      if (d === 'full' || d === 'instant') this.handlers.onSetSimDetail(d);
    }
    else if (action === 'set-speed' && target.dataset.speed) {
      const s = Number(target.dataset.speed);
      if (s === 1 || s === 2 || s === 4) this.handlers.onSetDefaultMatchSpeed(s);
    }
    else if (action === 'toggle-debug') this.handlers.onToggleDebugMode();
    else if (action === 'match-complete-next') this.handlers.onAcknowledgeMatchComplete();
    else if (action === 'open-squad') this.handlers.onOpenSquad();
    else if (action === 'open-tactics') this.handlers.onOpenTactics();
    else if (action === 'tactic-formation' && target.dataset.formation && this.tacticsDraft) {
      this.tacticsDraft.tactics.formation = target.dataset.formation as FormationName;
      this.renderTactics(this.tacticsDraft.team, undefined, this.tacticsDraft.tactics);
    }
    else if (action === 'tactic-style' && target.dataset.teamStyle && this.tacticsDraft) {
      this.tacticsDraft.tactics.teamStyle = target.dataset.teamStyle as TeamStyle;
      this.renderTactics(this.tacticsDraft.team, undefined, this.tacticsDraft.tactics);
    }
    else if (action === 'confirm-tactics') {
      // Tactics + lineup are stored as data attributes on the confirm button so the
      // UI stays stateless. The screen render writes them when the user clicks
      // formation/style buttons (via dispatching the event up the tree).
      const formationAttr = target.dataset.formation as FormationName | undefined;
      const styleAttr = target.dataset.teamStyle as TeamStyle | undefined;
      const lineup = (target.dataset.lineup ?? '').split(',').filter(Boolean);
      if (formationAttr && styleAttr && lineup.length === 11) {
        this.handlers.onConfirmTactics({ formation: formationAttr, teamStyle: styleAttr }, lineup);
      }
    }
  };

  private readonly handleChange = (event: Event): void => {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    if (!target || !this.handlers) return;

    const action = target.dataset.action;
    if (action === 'set-camera-sensitivity') {
      this.handlers.onSetCameraSensitivity(Number(target.value));
    } else if (action === 'set-mobile-opacity') {
      this.handlers.onSetMobileControlsOpacity(Number(target.value));
    }
  };
}

function rankStandings(standings: Standing[]): Standing[] {
  return [...standings].sort(compareStandings);
}

function compareStandings(a: Standing, b: Standing): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.tieSeed - b.tieSeed;
}

function stageLabel(stage: string): string {
  if (stage === 'Group') return 'Group Stage';
  if (stage === 'Quarter-finals') return 'Quarter-final';
  if (stage === 'Semi-finals') return 'Semi-final';
  return stage;
}

function formatTeamStyle(style: string): string {
  return style
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}

function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === 'low' || value === 'medium' || value === 'high';
}

// Canonical role-list order used to lay out squad lists and starting lineups.
// Matches the TEAM.roles array in constants.ts.
const TEAM_ROLE_ORDER = [
  'goalkeeper',
  'leftBack',
  'centerBackLeft',
  'centerBackRight',
  'rightBack',
  'defensiveMid',
  'centralMid',
  'attackingMid',
  'leftWing',
  'rightWing',
  'striker',
] as const;

function colorToCssNumber(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

// Map a trait value (0..1) to a colour: low = warm red, mid = amber, high = green.
function traitColor(value: number): string {
  if (value >= 0.75) return '#3fdc7c';
  if (value >= 0.5) return '#f0bf3a';
  return '#e6573b';
}

// Stable per-player ID used as the lineup token. Composes team id + role + number
// so the value survives serialisation and uniquely identifies a profile.
export function squadPlayerId(team: TournamentTeam, profile: TournamentPlayerProfile): string {
  return `${team.id}:${profile.role}:${profile.number}`;
}

// Resolve an ordered squadPlayerId[] back to the matching TournamentPlayerProfile[]
// from a team's roster. Players not found are silently skipped.
export function resolveLineupByIds(team: TournamentTeam, ids: string[]): TournamentPlayerProfile[] {
  const byId = new Map<string, TournamentPlayerProfile>();
  for (const profile of team.players) {
    byId.set(squadPlayerId(team, profile), profile);
  }
  const result: TournamentPlayerProfile[] = [];
  for (const id of ids) {
    const profile = byId.get(id);
    if (profile) result.push(profile);
  }
  return result;
}

// Pick the highest-overall player for each role from a squad. Overall is the mean
// of all 13 traits — same heuristic used by simulateMatch's xG math.
export function pickBestEleven(team: TournamentTeam): TournamentPlayerProfile[] {
  const lineup: TournamentPlayerProfile[] = [];
  for (const role of TEAM_ROLE_ORDER) {
    const candidates = team.players.filter((p) => p.role === role);
    if (candidates.length === 0) continue;
    const best = candidates.reduce((acc, candidate) =>
      traitOverall(candidate) > traitOverall(acc) ? candidate : acc,
    );
    lineup.push(best);
  }
  return lineup;
}

function traitOverall(profile: TournamentPlayerProfile): number {
  let sum = 0;
  for (const key of TRAIT_KEYS) sum += profile.traits[key];
  return sum / TRAIT_KEYS.length;
}
