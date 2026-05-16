import {
  ACESFilmicToneMapping,
  BasicShadowMap,
  PCFShadowMap,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { CombinedInput } from '../controls/CombinedInput';
import type { GameInput } from '../controls/GameInput';
import { KeyboardInput } from '../controls/KeyboardInput';
import { TouchControls } from '../controls/TouchControls';
import { Ball } from '../entities/Ball';
import { Goal } from '../entities/Goal';
import { createTeam, type Team } from '../entities/Team';
import { createPhysicsWorld, type PhysicsWorld } from '../physics/physicsWorld';
import { CameraSystem } from '../systems/CameraSystem';
import { selectFormation } from '../systems/FormationSystem';
import { KeeperBlockSystem } from '../systems/KeeperBlockSystem';
import { MatchSystem, type MatchResult } from '../systems/MatchSystem';
import { MinimapSystem } from '../systems/MinimapSystem';
import { PassTargetHintSystem } from '../systems/PassTargetHintSystem';
import { PlayerControlSystem } from '../systems/PlayerControlSystem';
import { PlayerSelectionSystem } from '../systems/PlayerSelectionSystem';
import { PossessionIndicatorSystem } from '../systems/PossessionIndicatorSystem';
import { PossessionSystem } from '../systems/PossessionSystem';
import { ShotFeedbackSystem } from '../systems/ShotFeedbackSystem';
import { TackleSystem } from '../systems/TackleSystem';
import { TeamAISystem } from '../systems/TeamAISystem';
import { TournamentState, type Fixture } from '../tournament/TournamentState';
import {
  clearTournamentSave,
  hasTournamentSave,
  loadSettings,
  loadTournament,
  resetSettings,
  saveSettings,
  saveTournament,
  type GraphicsQuality,
  type GameSettings,
} from '../tournament/storage';
import type { TournamentTeam } from '../tournament/teams';
import { Hud } from '../ui/Hud';
import { TournamentUi, resolveLineupByIds } from '../ui/TournamentUi';
import { BALL, PHYSICS } from './constants';
import { createCamera } from './camera';
import { createInitialGameState, type UserTactics, type GameScreen } from './GameState';
import type { TournamentPlayerProfile } from '../tournament/teams';
import { addLighting } from './lighting';
import { createPitch, createScene } from './scene';
import { soundHooks } from './soundHooks';
import { createStadiumEnvironment } from './stadium';
import { ScreenRouter } from '../app/ScreenRouter';
import { AutosaveBadge } from '../save/AutosaveBadge';
import { createHomeScreen } from '../screens/HomeScreen';
import { createManagerHub } from '../screens/manager/ManagerHub';
import { createSquadScreen } from '../screens/manager/SquadScreen';
import { createPlayerProfile } from '../screens/manager/PlayerProfile';
import { createTacticsScreen } from '../screens/manager/TacticsScreen';
import { createFormationPitchScreen } from '../screens/manager/FormationPitchScreen';
import { createLineupScreen } from '../screens/manager/LineupScreen';
import { InMatchPanel, type InMatchTab } from '../screens/manager/InMatchPanel';
import { createPostMatchScreen } from '../screens/manager/PostMatchScreen';
import { createTrainingScreen } from '../screens/manager/TrainingScreen';
import { createScoutingScreen } from '../screens/manager/ScoutingScreen';
import { createInboxScreen } from '../screens/manager/InboxScreen';
import { createFixturesScreen } from '../screens/manager/FixturesScreen';
import { createStandingsScreen } from '../screens/manager/StandingsScreen';
import { createBracketScreen } from '../screens/manager/BracketScreen';
import { createMatchPreviewScreen } from '../screens/manager/MatchPreviewScreen';
import type { LineupDraft, ManagerTactics, MatchReport, TrainingFocus, TrainingIntensity } from '../manager/types';
import { findPlayerByKey } from '../tournament/TournamentState';
import { MatchEventBus } from '../systems/MatchEventBus';
import { MatchStatsSystem } from '../systems/MatchStatsSystem';
import { CommentarySystem } from '../systems/CommentarySystem';
import { SubstitutionSystem } from '../systems/SubstitutionSystem';
import { applyMatchAftermath, buildMatchReportFromEngine } from '../manager/postmatch/applyAftermath';
import { runTrainingSession } from '../manager/training/runTraining';
import { generateTrainingNews } from '../manager/inbox/generators';

export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera = createCamera(window.innerWidth / window.innerHeight);
  private readonly keyboardInput: KeyboardInput;
  private readonly touchControls: TouchControls;
  private readonly input: GameInput;
  private readonly ball: Ball;
  private readonly goals: Goal[];
  private readonly hud: Hud;
  private readonly minimap: MinimapSystem;
  private readonly possessionIndicator: PossessionIndicatorSystem;
  private readonly shotFeedback: ShotFeedbackSystem;
  private readonly passTargetHint: PassTargetHintSystem;
  private readonly tournamentUi: TournamentUi;
  private readonly router: ScreenRouter;
  private readonly stadium = createStadiumEnvironment();
  private readonly state = createInitialGameState();
  private settings: GameSettings = loadSettings();
  private tournament?: TournamentState;
  private blueTeam?: Team;
  private redTeam?: Team;
  private playerSelection?: PlayerSelectionSystem;
  private playerControl?: PlayerControlSystem;
  private possessionSystem?: PossessionSystem;
  private teamAI?: TeamAISystem;
  private tackleSystem?: TackleSystem;
  private keeperBlockSystem?: KeeperBlockSystem;
  private cameraSystem?: CameraSystem;
  private matchSystem?: MatchSystem;
  // Match-scoped engine extensions (Wave 3).
  private matchBus?: MatchEventBus;
  private statsSystem?: MatchStatsSystem;
  private commentarySystem?: CommentarySystem;
  private subSystem?: SubstitutionSystem;
  private inMatchPanel?: InMatchPanel;
  private halftimeOverlay?: HTMLDivElement;
  private halftimeShown = false;
  private physicsAccumulator = 0;
  private animationFrame = 0;
  private lastTimestamp = 0;
  private fps = 0;
  private debugVisible = false;
  // Pending tactics/lineup captured from the pre-match tactics screen and consumed
  // once by startPlayableFixture → rebuildMatchTeams.
  private pendingUserTactics?: UserTactics;
  private pendingUserLineupIds?: string[];

  // Manager-mode screen state (Wave 2+). Persisted across re-renders of the same screen.
  private squadTab: 'xi' | 'bench' | 'all' = 'all';
  private squadSort: 'role' | 'ovr' | 'condition' | 'morale' | 'form' = 'role';
  private squadFilter: 'all' | 'GK' | 'DEF' | 'MID' | 'ATT' = 'all';
  private fixturesFilter: 'all' | 'mine' | 'group' | 'knockouts' = 'all';
  private fixturesStatus: 'all' | 'results' | 'upcoming' = 'all';

  private constructor(
    private readonly root: HTMLElement,
    private readonly physics: PhysicsWorld,
  ) {
    this.scene = createScene();
    addLighting(this.scene);
    this.scene.add(createPitch());
    this.scene.add(this.stadium);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.root.append(this.renderer.domElement);

    this.ball = new Ball(this.physics.world);
    this.goals = [new Goal('north'), new Goal('south')];
    this.scene.add(this.ball.mesh);
    for (const goal of this.goals) {
      this.scene.add(goal.group);
    }

    this.hud = new Hud(this.root);
    this.hud.bindActions({
      onTogglePause: () => this.matchSystem?.togglePause(),
      onSetSpeed: (speed) => this.matchSystem?.setSpeed(speed),
      onOpenPanel: (tab) => this.openInMatchPanel(tab),
    });
    this.minimap = new MinimapSystem(this.root);
    this.possessionIndicator = new PossessionIndicatorSystem(this.scene, this.ball);
    this.shotFeedback = new ShotFeedbackSystem(
      this.scene,
      this.ball,
      (intensity, duration) => this.cameraSystem?.addShake(intensity, duration),
    );
    this.passTargetHint = new PassTargetHintSystem(this.scene, this.ball);
    this.keyboardInput = new KeyboardInput();
    this.touchControls = new TouchControls(this.root);
    this.input = new CombinedInput([this.keyboardInput, this.touchControls]);
    this.tournamentUi = new TournamentUi(this.root);
    this.router = new ScreenRouter(this.root);
    new AutosaveBadge(this.root);
    this.registerScreens();
    this.tournamentUi.bind({
      onNewTournament: this.handleNewTournament,
      onContinueTournament: this.handleContinueTournament,
      onSelectTeam: this.handleTeamSelected,
      onPlayNextMatch: this.handlePlayNextMatch,
      onSimulateNextMatch: this.handleSimulateNextMatch,
      onSimulateAll: this.handleSimulateAll,
      onOpenHome: this.handleOpenHome,
      onOpenCountrySelection: this.handleOpenCountrySelection,
      onOpenGroupStage: this.handleOpenGroupStage,
      onOpenMatchPreview: this.handleOpenMatchPreview,
      onOpenBracket: this.handleOpenBracket,
      onOpenSettings: this.handleOpenSettings,
      onSetMatchLength: this.handleSetMatchLength,
      onToggleCrowd: this.handleToggleCrowd,
      onSetGraphicsQuality: this.handleSetGraphicsQuality,
      onSetCameraSensitivity: this.handleSetCameraSensitivity,
      onToggleSound: this.handleToggleSound,
      onSetMobileControlsOpacity: this.handleSetMobileControlsOpacity,
      onResetTournamentSave: this.handleResetTournamentSave,
      onResetSettings: this.handleResetSettings,
      onAcknowledgeMatchComplete: this.handleAcknowledgeMatchComplete,
      onOpenSquad: this.handleOpenSquad,
      onOpenTactics: this.handleOpenTactics,
      onConfirmTactics: this.handleConfirmTactics,
      onSetDifficulty: (difficulty) => {
        this.settings = { ...this.settings, difficulty };
        saveSettings(this.settings);
        this.handleOpenSettings();
      },
      onSetSimDetail: (simDetail) => {
        this.settings = { ...this.settings, simDetail };
        saveSettings(this.settings);
        this.handleOpenSettings();
      },
      onSetDefaultMatchSpeed: (defaultMatchSpeed) => {
        this.settings = { ...this.settings, defaultMatchSpeed };
        saveSettings(this.settings);
        this.matchSystem?.setSpeed(defaultMatchSpeed);
        this.handleOpenSettings();
      },
      onToggleDebugMode: () => {
        this.settings = { ...this.settings, debugMode: !this.settings.debugMode };
        saveSettings(this.settings);
        this.handleOpenSettings();
      },
    });
    this.applySettings();
    this.updateTouchControlsVisibility();
    this.showHomeScreen();

    window.addEventListener('resize', this.handleResize);
  }

  private registerScreens(): void {
    this.router.register('home', createHomeScreen({
      onTournament: this.handleHomeTournament,
      onManagerMode: this.handleHomeManagerMode,
      onTraining: this.handleHomeTraining,
      onSettings: this.handleOpenSettings,
    }));
    this.router.register('managerHub', createManagerHub({
      onBack: this.handleOpenHome,
      onContinue: this.handleManagerContinue,
      onSimulateNext: this.handleSimulateNextMatch,
      onNavigate: this.handleManagerNavigate,
      onSaveAndQuit: this.handleManagerSaveAndQuit,
    }));
    this.router.register('squad', createSquadScreen({
      onBack: this.handleOpenManagerHub,
      onOpenPlayer: this.handleOpenPlayerProfile,
      onSetCaptain: this.handleSetCaptain,
      onMoveToXI: () => {},
      onMoveToBench: () => {},
      onSetTab: (tab) => { this.squadTab = tab; this.showSquad(); },
      onSetSort: (sort) => { this.squadSort = sort; this.showSquad(); },
      onSetFilter: (filter) => { this.squadFilter = filter; this.showSquad(); },
    }));
    this.router.register('profile', createPlayerProfile({
      onBack: this.handleOpenSquad,
      onSetCaptain: this.handleSetCaptain,
      onSaveNotes: this.handleSavePlayerNotes,
    }));
    this.router.register('tactics', createTacticsScreen({
      onBack: this.handleOpenManagerHub,
      onSave: this.handleSaveTactics,
      onOpenPitch: this.handleOpenFormationPitch,
    }));
    this.router.register('formationPitch', createFormationPitchScreen({
      onBack: this.handleOpenManagerHub,
      onSaveLineup: this.handleSaveLineup,
    }));
    this.router.register('lineup', createLineupScreen({
      onBack: this.handleOpenManagerHub,
      onConfirm: this.handleConfirmLineup,
      onOpenPitch: this.handleOpenFormationPitch,
    }));
    this.router.register('postMatch', createPostMatchScreen({
      onContinue: this.handleOpenManagerHub,
      onOpenStandings: () => this.handleManagerNavigate('standings'),
      onOpenSquad: () => this.handleManagerNavigate('squad'),
    }));
    this.router.register('training', createTrainingScreen({
      onBack: this.handleOpenManagerHub,
      onRunTraining: this.handleRunTraining,
    }));
    this.router.register('scouting', createScoutingScreen({
      onBack: this.handleOpenManagerHub,
      onApplySuggested: this.handleApplyScoutTactics,
      onOpenLineup: () => this.handleManagerNavigate('lineup'),
    }));
    this.router.register('inbox', createInboxScreen({
      onBack: this.handleOpenManagerHub,
      onMarkRead: this.handleMarkNewsRead,
      onMarkAllRead: this.handleMarkAllNewsRead,
    }));
    this.router.register('fixtures', createFixturesScreen({
      onBack: this.handleOpenManagerHub,
      onSetFilter: (f) => { this.fixturesFilter = f; this.showFixtures(); },
      onSetStatus: (s) => { this.fixturesStatus = s; this.showFixtures(); },
    }));
    this.router.register('standings', createStandingsScreen({
      onBack: this.handleOpenManagerHub,
    }));
    this.router.register('bracket', createBracketScreen({
      onBack: this.handleOpenManagerHub,
    }));
    this.router.register('matchPreview', createMatchPreviewScreen({
      onBack: this.handleOpenManagerHub,
      onWatchMatch: this.handleWatchMatch,
      onSimulate: this.handleSimulateUpcoming,
      onOpenLineup: () => this.handleManagerNavigate('lineup'),
      onOpenTactics: () => this.handleManagerNavigate('tactics'),
      onOpenScouting: () => this.handleManagerNavigate('scouting'),
    }));
  }

  private showFixtures(): void {
    if (!this.tournament) return;
    this.routerShow('fixtures', {
      tournament: this.tournament,
      filter: this.fixturesFilter,
      status: this.fixturesStatus,
    });
  }

  private handleRunTraining = (focus: TrainingFocus, intensity: TrainingIntensity): void => {
    if (!this.tournament) return;
    const session = runTrainingSession(this.tournament, { focus, intensity });
    const news = generateTrainingNews(session, this.tournament);
    for (const item of news) this.tournament.pushNews(item);
    saveTournament(this.tournament);
  };

  private handleApplyScoutTactics = (tactics: ManagerTactics): void => {
    if (!this.tournament) return;
    this.tournament.setTactics(this.tournament.selectedTeamId, tactics);
    saveTournament(this.tournament);
    this.handleOpenManagerHub();
  };

  private handleMarkNewsRead = (id: string): void => {
    if (!this.tournament) return;
    this.tournament.markNewsRead(id);
    saveTournament(this.tournament);
  };

  private handleMarkAllNewsRead = (): void => {
    if (!this.tournament) return;
    this.tournament.markAllNewsRead();
    saveTournament(this.tournament);
  };

  private handleWatchMatch = (): void => {
    if (!this.tournament) return;
    const fixture = this.tournament.getNextUserFixture();
    if (!fixture) {
      this.handleOpenManagerHub();
      return;
    }
    const userTactics = this.tournament.tactics[this.tournament.selectedTeamId];
    this.pendingUserTactics = userTactics
      ? { formation: userTactics.formation, teamStyle: userTactics.teamStyle }
      : undefined;
    const lineup = this.tournament.selectedLineup;
    this.pendingUserLineupIds = lineup?.startingXI;
    this.startPlayableFixture(fixture);
  };

  private handleSimulateUpcoming = (): void => {
    this.handleSimulateNextMatch();
  };

  private routerShow<P>(screen: Parameters<ScreenRouter['show']>[0], props: P): void {
    this.tournamentUi.hide();
    this.state.screen = screen as typeof this.state.screen;
    this.updateTouchControlsVisibility();
    this.router.show(screen, props);
  }

  private handleOpenManagerHub = (): void => {
    if (!this.tournament) {
      this.showHomeScreen();
      return;
    }
    this.routerShow('managerHub', { tournament: this.tournament });
  };

  private handleManagerContinue = (): void => {
    if (!this.tournament) return;
    const fixture = this.tournament.getNextUserFixture();
    if (!fixture) {
      // Fall back to simulate-next behaviour if user has no upcoming fixture.
      this.handleSimulateNextMatch();
      return;
    }
    // Send to lineup → preview → match flow.
    this.routerShow('lineup', { tournament: this.tournament, upcomingFixture: fixture });
  };

  private handleManagerSaveAndQuit = (): void => {
    if (this.tournament) saveTournament(this.tournament);
    this.handleOpenHome();
  };

  private handleManagerNavigate = (
    target: 'squad' | 'tactics' | 'lineup' | 'pitch' | 'training' | 'scouting' | 'fixtures' | 'standings' | 'bracket' | 'inbox' | 'settings',
  ): void => {
    if (!this.tournament) { this.showHomeScreen(); return; }
    switch (target) {
      case 'squad': this.showSquad(); break;
      case 'tactics': this.routerShow('tactics', { tournament: this.tournament }); break;
      case 'lineup': this.routerShow('lineup', { tournament: this.tournament, upcomingFixture: this.tournament.getNextUserFixture() }); break;
      case 'pitch': this.routerShow('formationPitch', { tournament: this.tournament }); break;
      case 'training':
        if (this.router.has('training')) this.routerShow('training', { tournament: this.tournament });
        else this.handleOpenManagerHub();
        break;
      case 'scouting':
        if (this.router.has('scouting')) this.routerShow('scouting', { tournament: this.tournament });
        else this.handleOpenManagerHub();
        break;
      case 'fixtures': this.showFixtures(); break;
      case 'standings': this.routerShow('standings', { tournament: this.tournament }); break;
      case 'bracket': this.routerShow('bracket', { tournament: this.tournament }); break;
      case 'inbox':
        if (this.router.has('inbox')) this.routerShow('inbox', { tournament: this.tournament });
        else this.handleOpenManagerHub();
        break;
      case 'settings':
        this.handleOpenSettings();
        break;
    }
  };

  private showSquad(): void {
    if (!this.tournament) return;
    this.routerShow('squad', {
      tournament: this.tournament,
      tab: this.squadTab,
      sortBy: this.squadSort,
      filterRole: this.squadFilter,
    });
  }

  private handleOpenSquad = (): void => { this.showSquad(); };

  private handleOpenPlayerProfile = (playerId: string): void => {
    if (!this.tournament) return;
    this.state.focusedPlayerId = playerId;
    this.routerShow('profile', { tournament: this.tournament, playerId });
  };

  private handleSetCaptain = (playerId: string): void => {
    if (!this.tournament) return;
    const lineup = this.tournament.selectedLineup;
    if (!lineup) return;
    lineup.captainId = playerId;
    // Mark profile.isCaptain on the right player.
    const team = this.tournament.getTeam(this.tournament.selectedTeamId);
    for (const p of [...team.players, ...team.bench]) {
      p.isCaptain = false;
    }
    const target = findPlayerByKey(team, playerId);
    if (target) target.isCaptain = true;
    saveTournament(this.tournament);
    // Stay on current screen.
    if (this.state.screen === 'squad') this.showSquad();
    else if (this.state.screen === 'profile') this.handleOpenPlayerProfile(playerId);
  };

  private handleSavePlayerNotes = (playerId: string, notes: string): void => {
    if (!this.tournament) return;
    const team = this.tournament.getTeam(this.tournament.selectedTeamId);
    const target = findPlayerByKey(team, playerId);
    if (target) target.notes = notes;
    saveTournament(this.tournament);
  };

  private handleSaveTactics = (tactics: ManagerTactics): void => {
    if (!this.tournament) return;
    this.tournament.setTactics(this.tournament.selectedTeamId, tactics);
    saveTournament(this.tournament);
    this.handleOpenManagerHub();
  };

  private handleOpenFormationPitch = (): void => {
    if (!this.tournament) return;
    this.routerShow('formationPitch', { tournament: this.tournament });
  };

  private handleSaveLineup = (lineup: LineupDraft): void => {
    if (!this.tournament) return;
    this.tournament.setLineup(this.tournament.selectedTeamId, lineup);
    saveTournament(this.tournament);
    this.handleOpenManagerHub();
  };

  private handleConfirmLineup = (lineup: LineupDraft): void => {
    if (!this.tournament) return;
    this.tournament.setLineup(this.tournament.selectedTeamId, lineup);
    saveTournament(this.tournament);
    const fixture = this.tournament.getNextUserFixture();
    if (!fixture) {
      this.handleOpenManagerHub();
      return;
    }
    this.routerShow('matchPreview', { tournament: this.tournament, fixture });
  };

  private showHomeScreen(): void {
    this.tournamentUi.hide();
    const summary = this.buildSaveSummary();
    this.router.show('home', { hasSave: hasTournamentSave(), saveSummary: summary });
  }

  private buildSaveSummary(): string | undefined {
    const tournament = this.tournament ?? loadTournament();
    if (!tournament) return undefined;
    const snap = tournament.getSnapshot();
    const stage = snap.currentFixture?.stage ?? snap.nextFixture?.stage ?? 'Tournament';
    const stageLabel = stage === 'Group' ? 'Group Stage' : stage;
    return `Save: ${snap.selectedTeam.name} · ${stageLabel}`;
  }

  private readonly handleHomeTournament = (): void => {
    if (hasTournamentSave()) {
      // Continue is the default; new tournament is via modal.
      this.handleContinueTournament();
    } else {
      this.handleNewTournament();
    }
  };

  private readonly handleHomeManagerMode = (): void => {
    if (hasTournamentSave()) {
      this.handleContinueTournament();
    } else {
      this.handleNewTournament();
    }
  };

  private readonly handleHomeTraining = (): void => {
    if (hasTournamentSave()) {
      const tournament = loadTournament();
      if (tournament) {
        this.clearLiveMatch();
        this.tournament = tournament;
        // Wave 2 will route to the dedicated training screen; for now use the manager-hub-ish
        // groupStage view so the button is wired and the rest of the flow stays accessible.
        this.router.hide();
        this.tournamentUi.show();
        this.state.screen = 'training';
        if (this.router.has('training')) {
          this.tournamentUi.hide();
          this.router.show('training', { tournament });
        } else {
          this.state.screen = 'groupStage';
          this.tournamentUi.renderGroupStage(tournament.getSnapshot());
        }
      }
    } else {
      console.log('[menu] Training requested with no save — sending to country selection');
      this.handleNewTournament();
    }
  };

  static async create(root: HTMLElement): Promise<Game> {
    const physics = await createPhysicsWorld();
    return new Game(root, physics);
  }

  start(): void {
    this.lastTimestamp = performance.now();
    this.loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.input.dispose();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }

  private readonly loop = (): void => {
    this.animationFrame = requestAnimationFrame(this.loop);

    const now = performance.now();
    const delta = Math.min((now - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = now;
    this.fps = delta > 0 ? Math.round(1 / delta) : this.fps;

    if (this.state.screen === 'matchPlaying' && this.matchSystem) {
      this.updateMatch(delta);
    }

    this.stepPhysics(delta);
    this.ball.limitSpeed(BALL.maxSpeed);
    this.ball.syncMesh();
    if (this.state.screen === 'matchPlaying') {
      this.updateReadabilitySystems(delta);
    }
    this.cameraSystem?.update(delta);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  private updateMatch(delta: number): void {
    if (
      !this.matchSystem ||
      !this.playerSelection ||
      !this.playerControl ||
      !this.teamAI ||
      !this.possessionSystem ||
      !this.blueTeam ||
      !this.redTeam
    ) {
      return;
    }

    if (this.input.wasDebugPressed()) {
      this.debugVisible = !this.debugVisible;
    }
    this.teamAI.setDebugVisible(this.debugVisible);

    if (this.input.wasPausePressed()) {
      this.matchSystem.togglePause();
    }
    if (this.keyboardInput.wasManagerPausePressed()) {
      this.matchSystem.togglePause();
    }
    if (this.keyboardInput.wasManagerSpeed1Pressed()) this.matchSystem.setSpeed(1);
    if (this.keyboardInput.wasManagerSpeed2Pressed()) this.matchSystem.setSpeed(2);
    if (this.keyboardInput.wasManagerSpeed4Pressed()) this.matchSystem.setSpeed(4);
    if (this.keyboardInput.wasManagerEscapePressed() && this.inMatchPanel?.isOpen()) {
      this.inMatchPanel.close();
      if (this.matchSystem.getViewState().paused) this.matchSystem.togglePause();
    }

    if (this.input.wasRestartPressed()) {
      this.debugVisible = false;
      this.teamAI.setDebugVisible(false);
      this.matchSystem.restart();
    }

    this.possessionSystem.update([this.blueTeam, this.redTeam], delta);

    const speed = this.matchSystem.getSpeed();
    const scaledDelta = delta * speed;
    if (!this.matchSystem.isResetting) {
      this.playerSelection.update();
      this.playerControl.update(delta);
      this.teamAI.update(scaledDelta);
      this.tackleSystem?.update([this.blueTeam, this.redTeam], scaledDelta);
      this.possessionSystem.update([this.blueTeam, this.redTeam], delta);
    }

    this.matchSystem.update(delta);
    this.statsSystem?.update(scaledDelta);
    const possessionTeamColor = this.possessionSystem.getState().team?.color;
    this.commentarySystem?.update(scaledDelta, this.matchSystem.getCurrentMinute(), possessionTeamColor);
    this.keeperBlockSystem?.sync();
    this.updatePlayerVisuals(delta);
    this.updateHud();
  }

  private updateHud(): void {
    if (
      !this.matchSystem ||
      !this.playerSelection ||
      !this.playerControl ||
      !this.blueTeam ||
      !this.redTeam ||
      !this.teamAI ||
      !this.possessionSystem
    ) {
      return;
    }

    const matchView = this.matchSystem.getViewState();
    const controlledPlayer = this.playerSelection.getControlledPlayer();
    const possessionLabel = this.possessionSystem.getOwnerLabel();
    const aiStateCounts = this.teamAI.getStateCounts();
    this.hud.update({
      score: matchView.score,
      elapsedSeconds: matchView.elapsedSeconds,
      remainingSeconds: matchView.remainingSeconds,
      userTeamName: this.blueTeam.name,
      opponentTeamName: this.redTeam.name,
      userColor: this.blueTeam.tournamentTeam?.colors.primary ?? 0x2587ff,
      opponentColor: this.redTeam.tournamentTeam?.colors.primary ?? 0xf04b55,
      controlledPlayerNumber: controlledPlayer.number,
      controlledPlayerName: controlledPlayer.displayName,
      controlledPlayerRole: controlledPlayer.role,
      controlledPlayerPersonality: controlledPlayer.personality,
      controlledPlayerTraits: controlledPlayer.getTopTraitsLabel(),
      stamina: this.playerControl.getControlledStamina(),
      shotCharge: this.playerControl.getShotCharge(),
      hasPossession: this.playerControl.hasPossession(),
      possessionLabel,
      possessionStatus: this.getPossessionStatus(),
      passTargetHint: this.playerControl.getSelectedPassTargetDebug(),
      restartLabel: matchView.restart.label,
      restartSeconds: matchView.restart.secondsRemaining,
      message:
        this.shotFeedback.getMessage() ||
        this.playerControl.getCallForPassMessage() ||
        matchView.message,
      stageLabel: this.state.liveMatch?.fixture.stage ?? 'Friendly',
      // Manager-mode enrichment
      stats: this.statsSystem?.getStats(),
      commentary: this.commentarySystem?.getLines(6),
      subsRemaining: this.subSystem
        ? { home: this.subSystem.getSubsRemaining('blue'), away: this.subSystem.getSubsRemaining('red') }
        : undefined,
      speed: this.matchSystem.getSpeed(),
      paused: matchView.paused,
      debugVisible: this.debugVisible,
      debugLines: [
        `FPS: ${this.fps}`,
        `Possession: ${possessionLabel}`,
        `Ball speed: ${this.ball.getSpeed().toFixed(2)}`,
        `Controlled: #${controlledPlayer.number} ${controlledPlayer.roleLabel}`,
        `Pass target: ${this.playerControl.getSelectedPassTargetDebug()}`,
        `Through target: ${this.playerControl.getSelectedThroughPassTargetDebug()}`,
        `Restart: ${matchView.restart.label || 'none'} ${matchView.restart.secondsRemaining.toFixed(2)}s`,
        `Shot: ${Math.round(this.playerControl.getShotCharge() * 100)}%`,
        `AI counts: ${aiStateCounts.join(', ') || 'none'}`,
      ],
    });
  }

  private updateReadabilitySystems(delta: number): void {
    if (
      !this.playerSelection ||
      !this.playerControl ||
      !this.possessionSystem ||
      !this.blueTeam ||
      !this.redTeam
    ) {
      return;
    }

    const controlledPlayer = this.playerSelection.getControlledPlayer();
    this.possessionIndicator.update(
      this.possessionSystem,
      controlledPlayer,
      this.blueTeam,
      this.redTeam,
    );
    this.shotFeedback.update(delta, [this.blueTeam, this.redTeam]);
    this.minimap.update(delta, this.blueTeam, this.redTeam, this.ball, controlledPlayer);

    const passTargetPosition = this.playerControl.getSelectedPassTargetPosition();
    this.passTargetHint.update({
      visible: this.playerControl.hasPossession() && !!passTargetPosition,
      targetPosition: passTargetPosition,
      color: this.blueTeam.tournamentTeam?.colors.primary ?? 0x7ee2a5,
    });
  }

  private getPossessionStatus(): string {
    if (!this.possessionSystem || !this.blueTeam || !this.redTeam) {
      return 'Loose Ball';
    }

    const state = this.possessionSystem.getState();
    if (!state.team || !state.owner) {
      return 'Loose Ball';
    }

    return state.team === this.blueTeam ? 'Your Ball' : 'Opponent Ball';
  }

  private startPlayableFixture(fixture: Fixture): void {
    if (!this.tournament) {
      return;
    }

    this.debugVisible = false;
    const userIsHome = fixture.homeTeamId === this.tournament.selectedTeamId;
    const userTactics = this.pendingUserTactics;
    const userLineupIds = this.pendingUserLineupIds;
    // Consume one-shot pending tactics so the next match starts fresh.
    this.pendingUserTactics = undefined;
    this.pendingUserLineupIds = undefined;
    this.state.liveMatch = { fixture, userIsHome, userTactics, userLineup: userLineupIds };
    const userTeam = this.tournament.selectedTeam;
    const opponentTeam = this.tournament.getTeam(
      userIsHome ? fixture.awayTeamId : fixture.homeTeamId,
    );

    this.rebuildMatchTeams(userTeam, opponentTeam, fixture.stage, userTactics, userLineupIds);
    this.matchSystem = new MatchSystem(
      this.ball,
      this.blueTeam!,
      this.redTeam!,
      this.goals,
      this.handleMatchComplete,
      this.settings.matchLengthSeconds,
      () => this.possessionSystem?.forceLoose('kickoff reset', 300),
      () => this.possessionSystem?.getLastTouchTeam()?.color,
    );
    // Wave 3: match-scoped engine extensions.
    this.matchBus = new MatchEventBus();
    this.matchSystem.attachEventBus(this.matchBus);
    this.tackleSystem?.attachEventBus(this.matchBus, () => this.matchSystem?.getCurrentMinute() ?? 0);
    this.statsSystem = new MatchStatsSystem(this.possessionSystem!, this.blueTeam!, this.redTeam!);
    this.commentarySystem = new CommentarySystem(this.blueTeam!, this.redTeam!);
    this.subSystem = new SubstitutionSystem(this.blueTeam!, this.redTeam!, this.matchBus, this.teamAI!, {
      add: (g: unknown) => this.scene.add(g as never),
      remove: (g: unknown) => this.scene.remove(g as never),
    });
    this.matchBus.on((event) => {
      this.statsSystem?.onEvent(event);
      this.commentarySystem?.onEvent(event);
      if (event.type === 'half' && !this.halftimeShown) this.showHalftimeOverlay();
    });
    // Apply user-saved tactics to the AI for both teams.
    if (this.tournament) {
      const userTactics = this.tournament.tactics[this.tournament.selectedTeamId];
      if (userTactics) this.teamAI?.setTacticsFor(this.blueTeam!.color, userTactics);
      const opponentTeamId = userIsHome ? fixture.awayTeamId : fixture.homeTeamId;
      const opponentTactics = this.tournament.tactics[opponentTeamId];
      if (opponentTactics) this.teamAI?.setTacticsFor(this.redTeam!.color, opponentTactics);
    }
    this.halftimeShown = false;
    if (!this.inMatchPanel) {
      this.inMatchPanel = new InMatchPanel(this.root, {
        onClose: () => { this.inMatchPanel?.close(); this.matchSystem?.togglePause(); },
        onSetTab: (tab) => this.inMatchPanel?.setTab(tab),
        onApplyTactics: (tactics) => this.handleInMatchTacticChange(tactics),
        onConfirmSub: (outId, inId) => this.handleInMatchSub(outId, inId),
      });
    }
    this.tournamentUi.hide();
    this.router.hide();
    this.hud.show();
    this.minimap.show();
    this.state.screen = 'matchPlaying';
    this.updateTouchControlsVisibility();
    this.updateHud();
  }

  private openInMatchPanel(tab: InMatchTab): void {
    if (!this.inMatchPanel || !this.matchSystem || !this.blueTeam || !this.subSystem) return;
    // Pause the match while the panel is open.
    if (!this.matchSystem.getViewState().paused) this.matchSystem.togglePause();
    const xi = this.blueTeam.players.map((p) => ({ id: p.id, name: p.displayName, role: p.role, number: p.number }));
    const bench = this.blueTeam.bench.map((p) => ({ id: p.id, name: p.displayName, role: p.role, number: p.number }));
    this.inMatchPanel.open({
      open: true,
      tab,
      tactics: this.tournament?.tactics[this.tournament.selectedTeamId] ?? {
        formation: this.blueTeam.formation,
        teamStyle: this.blueTeam.teamStyle,
        mentality: 0,
        sliders: { pressing: 60, lineHeight: 55, tempo: 55, width: 50, directness: 50, risk: 50, buildUp: 50, tackling: 55 },
      },
      subsRemaining: this.subSystem.getSubsRemaining('blue'),
      startingXI: xi,
      bench,
      stats: this.statsSystem?.getStats() ?? {
        possessionPct: 50, shots: { home: 0, away: 0 }, shotsOnTarget: { home: 0, away: 0 }, passes: { home: 0, away: 0 }, passAccuracy: { home: 80, away: 80 }, tackles: { home: 0, away: 0 }, fouls: { home: 0, away: 0 }, corners: { home: 0, away: 0 }, offsides: { home: 0, away: 0 }, yellows: { home: 0, away: 0 }, reds: { home: 0, away: 0 },
      },
      events: this.statsSystem?.getEvents(20) ?? [],
    });
  }

  private handleInMatchTacticChange(tactics: ManagerTactics): void {
    if (!this.tournament || !this.teamAI || !this.blueTeam || !this.matchBus || !this.matchSystem) return;
    this.tournament.setTactics(this.tournament.selectedTeamId, tactics);
    this.teamAI.setTacticsFor(this.blueTeam.color, tactics);
    this.matchBus.emit({
      minute: this.matchSystem.getCurrentMinute(),
      type: 'tactic',
      team: 'blue',
      detail: `${tactics.formation} · ${tactics.teamStyle}`,
    });
    saveTournament(this.tournament);
    // Refresh panel UI.
    this.openInMatchPanel('tactics');
  }

  private handleInMatchSub(outId: string, inId: string): void {
    if (!this.subSystem || !this.matchSystem) return;
    const result = this.subSystem.requestSub('blue', outId, inId, this.matchSystem.getCurrentMinute());
    if (!result.ok) console.warn('[sub] rejected:', result.reason);
    // Refresh panel with new bench/XI state.
    this.openInMatchPanel('subs');
  }

  private showHalftimeOverlay(): void {
    if (this.halftimeShown) return;
    this.halftimeShown = true;
    if (!this.matchSystem) return;
    const score = this.matchSystem.getViewState().score;
    // Pause match while overlay is shown.
    if (!this.matchSystem.getViewState().paused) this.matchSystem.togglePause();
    const overlay = document.createElement('div');
    overlay.className = 'mgr-halftime';
    overlay.innerHTML = `
      <div class="mgr-halftime__card">
        <p class="mgr-topbar__eyebrow">Half time</p>
        <h2>${this.blueTeam?.name ?? 'Home'} ${score.blue} - ${score.red} ${this.redTeam?.name ?? 'Away'}</h2>
        <p class="mgr-muted">Team talk — pick the message:</p>
        <button class="mgr-btn mgr-btn--primary" data-team-talk="encourage">Encourage (morale +)</button>
        <button class="mgr-btn" data-team-talk="calm">Calm down (composure +)</button>
        <button class="mgr-btn" data-team-talk="press">Demand pressing (intensity +)</button>
      </div>
    `;
    document.body.append(overlay);
    this.halftimeOverlay = overlay;
    overlay.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-team-talk]') : null;
      if (!target) return;
      this.applyTeamTalk(target.dataset.teamTalk as 'encourage' | 'calm' | 'press');
      overlay.remove();
      this.halftimeOverlay = undefined;
      if (this.matchSystem?.getViewState().paused) this.matchSystem.togglePause();
    });
  }

  private applyTeamTalk(kind: 'encourage' | 'calm' | 'press'): void {
    if (!this.tournament || !this.blueTeam) return;
    // Encourage → small morale bump on every starter
    if (kind === 'encourage') {
      const team = this.tournament.getTeam(this.tournament.selectedTeamId);
      for (const p of team.players) {
        p.morale = Math.min(100, (p.morale ?? 70) + 4);
      }
    } else if (kind === 'press' && this.teamAI) {
      const current = this.tournament.tactics[this.tournament.selectedTeamId];
      if (current) {
        const next: ManagerTactics = { ...current, sliders: { ...current.sliders, pressing: Math.min(100, current.sliders.pressing + 15) } };
        this.tournament.setTactics(this.tournament.selectedTeamId, next);
        this.teamAI.setTacticsFor(this.blueTeam.color, next);
      }
    }
    saveTournament(this.tournament);
  }

  private rebuildMatchTeams(
    userTeam: TournamentTeam,
    opponentTeam: TournamentTeam,
    stage: Fixture['stage'],
    userTactics?: UserTactics,
    userLineupIds?: string[],
  ): void {
    this.clearMatchTeams();
    // User team honours pre-match overrides for formation, team style, and the
    // starting XI. Opponent uses the AI's selectFormation heuristic.
    const userFormation = userTactics?.formation ?? selectFormation(userTeam, opponentTeam, stage);
    const opponentFormation = selectFormation(opponentTeam, userTeam, stage);
    const lineupOverride: TournamentPlayerProfile[] | undefined = userLineupIds
      ? resolveLineupByIds(userTeam, userLineupIds)
      : undefined;
    this.blueTeam = createTeam('blue', userTeam, {
      formation: userFormation,
      teamStyle: userTactics?.teamStyle,
      lineupOverride,
      bench: userTeam.bench,
    });
    this.redTeam = createTeam('red', opponentTeam, {
      formation: opponentFormation,
      bench: opponentTeam.bench,
    });

    for (const player of [...this.blueTeam.players, ...this.redTeam.players]) {
      this.scene.add(player.group);
    }

    this.playerSelection = new PlayerSelectionSystem(
      this.blueTeam.players,
      this.input,
      this.ball,
      this.blueTeam,
    );
    this.possessionSystem = new PossessionSystem(this.ball);
    this.playerControl = new PlayerControlSystem(
      this.input,
      () => this.playerSelection!.getControlledPlayer(),
      this.blueTeam,
      this.redTeam,
      this.ball,
      this.possessionSystem,
      (position, message, restartTeamColor) =>
        this.matchSystem?.restartForOffside(position, message, restartTeamColor),
      (event) => this.shotFeedback.recordShot(event),
    );
    this.teamAI = new TeamAISystem(
      this.ball,
      this.blueTeam,
      this.redTeam,
      () => this.playerSelection!.getControlledPlayer(),
      this.possessionSystem,
      (position, message, restartTeamColor) =>
        this.matchSystem?.restartForOffside(position, message, restartTeamColor),
    );
    this.tackleSystem = new TackleSystem(
      this.input,
      this.ball,
      this.possessionSystem,
      () => this.playerSelection!.getControlledPlayer(),
    );
    this.keeperBlockSystem = new KeeperBlockSystem(this.physics.world, [
      this.blueTeam,
      this.redTeam,
    ]);
    this.cameraSystem = new CameraSystem(
      this.camera,
      () => this.playerSelection?.getControlledPlayer() ?? null,
      this.settings.cameraSensitivity,
      this.ball,
    );
    this.cameraSystem.mode = 'broadcast';
  }

  private clearMatchTeams(): void {
    this.keeperBlockSystem?.dispose();
    this.keeperBlockSystem = undefined;
    for (const player of [
      ...(this.blueTeam?.players ?? []),
      ...(this.redTeam?.players ?? []),
    ]) {
      this.scene.remove(player.group);
    }
  }

  private clearLiveMatch(): void {
    this.matchSystem = undefined;
    this.playerSelection = undefined;
    this.playerControl = undefined;
    this.possessionSystem = undefined;
    this.teamAI = undefined;
    this.tackleSystem = undefined;
    this.cameraSystem = undefined;
    this.statsSystem = undefined;
    this.commentarySystem = undefined;
    this.subSystem = undefined;
    this.matchBus?.clear();
    this.matchBus = undefined;
    this.inMatchPanel?.close();
    this.halftimeOverlay?.remove();
    this.halftimeOverlay = undefined;
    this.halftimeShown = false;
    this.state.liveMatch = undefined;
    this.clearMatchTeams();
    this.blueTeam = undefined;
    this.redTeam = undefined;
    this.ball.reset();
    this.hud.hide();
    this.minimap.hide();
    this.possessionIndicator.hide();
    this.passTargetHint.hide();
    this.updateTouchControlsVisibility();
  }

  private readonly handleNewTournament = (): void => {
    clearTournamentSave();
    this.router.hide();
    this.clearLiveMatch();
    this.tournament = undefined;
    this.state.lastMatchResult = undefined;
    this.state.screen = 'countrySelection';
    this.updateTouchControlsVisibility();
    this.tournamentUi.show();
    this.tournamentUi.renderCountrySelection();
  };

  private readonly handleContinueTournament = (): void => {
    const tournament = loadTournament();
    if (!tournament) {
      this.showHomeScreen();
      return;
    }

    this.clearLiveMatch();
    this.tournament = tournament;
    if (tournament.championTeamId) {
      this.router.hide();
      this.tournamentUi.show();
      this.state.screen = 'champion';
      this.updateTouchControlsVisibility();
      this.tournamentUi.renderChampion(tournament.getSnapshot());
      return;
    }
    this.handleOpenManagerHub();
  };

  private readonly handleTeamSelected = (teamId: string): void => {
    this.tournament = new TournamentState(teamId);
    this.tournament.simulateUntilUserMatchOrComplete();
    saveTournament(this.tournament);
    this.handleOpenManagerHub();
  };

  private readonly handlePlayNextMatch = (): void => {
    const fixture = this.tournament?.getNextUserFixture();
    if (fixture) {
      this.startPlayableFixture(fixture);
    }
  };

  private readonly handleSimulateAll = (): void => {
    if (!this.tournament) {
      return;
    }

    this.tournament.simulateAllRemaining();
    saveTournament(this.tournament);
    this.state.screen = this.tournament.championTeamId ? 'champion' : 'groupStage';
    this.updateTouchControlsVisibility();
    this.renderCurrentTournamentScreen();
  };

  private readonly handleSimulateNextMatch = (): void => {
    if (!this.tournament) {
      return;
    }

    const fixture = this.tournament.getPendingFixture();
    if (!fixture) return;

    const isUserFixture = this.tournament.isFixtureUserTeam(fixture);
    if (isUserFixture && !this.tournament.userEliminated) {
      this.startPlayableFixture(fixture);
      return;
    }

    this.tournament.simulateNextPendingFixture();
    this.tournament.simulateUntilUserMatchOrComplete();
    saveTournament(this.tournament);
    this.updateTouchControlsVisibility();
    this.renderCurrentTournamentScreen();
  };

  private readonly handleMatchComplete = (result: MatchResult): void => {
    const liveMatch = this.state.liveMatch;
    if (!this.tournament || !liveMatch) {
      return;
    }

    const homeScore = liveMatch.userIsHome ? result.blueScore : result.redScore;
    const awayScore = liveMatch.userIsHome ? result.redScore : result.blueScore;
    const fixture = liveMatch.fixture;
    this.tournament.recordUserFixture(fixture.id, homeScore, awayScore);

    // Build full match report from engine stats + events.
    const statsSnapshot = this.statsSystem?.getStats() ?? {
      possessionPct: 50,
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
      passes: { home: 0, away: 0 },
      passAccuracy: { home: 80, away: 80 },
      tackles: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      offsides: { home: 0, away: 0 },
      yellows: { home: 0, away: 0 },
      reds: { home: 0, away: 0 },
    };
    const eventsSnapshot = this.statsSystem?.getEvents(200) ?? [];

    const report: MatchReport = buildMatchReportFromEngine(this.tournament, {
      fixtureId: fixture.id,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeScore,
      awayScore,
      stage: fixture.stage,
      stats: statsSnapshot,
      events: eventsSnapshot,
    });
    applyMatchAftermath(this.tournament, report);
    this.tournament.simulateUntilUserMatchOrComplete();
    saveTournament(this.tournament);

    this.state.lastMatchReport = report;
    this.state.lastMatchResult = {
      userTeamName: this.blueTeam?.name ?? 'User',
      opponentTeamName: this.redTeam?.name ?? 'Opponent',
      userScore: result.blueScore,
      opponentScore: result.redScore,
      stage: fixture.stage,
    };
    this.clearLiveMatch();
    this.routerShow('postMatch', { tournament: this.tournament, report });
  };

  private readonly handleAcknowledgeMatchComplete = (): void => {
    this.state.screen = this.tournament?.championTeamId ? 'champion' : 'matchPreview';
    this.updateTouchControlsVisibility();
    this.renderCurrentTournamentScreen();
  };

  private readonly handleOpenHome = (): void => {
    this.clearLiveMatch();
    this.state.screen = 'home';
    this.updateTouchControlsVisibility();
    this.showHomeScreen();
  };

  private readonly handleOpenCountrySelection = (): void => {
    this.clearLiveMatch();
    this.state.screen = 'countrySelection';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderCountrySelection();
  };

  private readonly handleOpenGroupStage = (): void => {
    if (!this.tournament) {
      this.handleOpenHome();
      return;
    }
    this.router.hide();
    this.tournamentUi.show();
    this.state.screen = 'groupStage';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderGroupStage(this.tournament.getSnapshot());
  };

  private readonly handleOpenMatchPreview = (): void => {
    if (!this.tournament) {
      this.handleOpenHome();
      return;
    }
    this.router.hide();
    this.tournamentUi.show();
    this.state.screen = 'matchPreview';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderMatchPreview(this.tournament.getSnapshot());
  };

  private readonly handleOpenBracket = (): void => {
    if (!this.tournament) {
      this.handleOpenHome();
      return;
    }
    this.router.hide();
    this.tournamentUi.show();
    this.state.screen = 'bracket';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderBracket(this.tournament.getSnapshot());
  };

  private readonly handleOpenSettings = (): void => {
    this.state.screen = 'settings';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderSettings(
      this.settings,
      this.tournament?.getSnapshot(),
      hasTournamentSave(),
    );
  };

  private readonly handleSetMatchLength = (seconds: number): void => {
    this.settings = { ...this.settings, matchLengthSeconds: seconds };
    saveSettings(this.settings);
    this.handleOpenSettings();
  };

  private readonly handleToggleCrowd = (): void => {
    this.settings = { ...this.settings, crowdEnabled: !this.settings.crowdEnabled };
    this.applySettings();
    saveSettings(this.settings);
    this.handleOpenSettings();
  };

  private readonly handleSetGraphicsQuality = (quality: GraphicsQuality): void => {
    this.settings = { ...this.settings, graphicsQuality: quality };
    this.applySettings();
    saveSettings(this.settings);
    this.handleOpenSettings();
  };

  private readonly handleSetCameraSensitivity = (sensitivity: number): void => {
    this.settings = { ...this.settings, cameraSensitivity: sensitivity };
    this.applySettings();
    saveSettings(this.settings);
    this.handleOpenSettings();
  };

  private readonly handleToggleSound = (): void => {
    this.settings = { ...this.settings, soundEnabled: !this.settings.soundEnabled };
    this.applySettings();
    saveSettings(this.settings);
    this.handleOpenSettings();
  };

  private readonly handleSetMobileControlsOpacity = (opacity: number): void => {
    this.settings = { ...this.settings, mobileControlsOpacity: opacity };
    this.applySettings();
    saveSettings(this.settings);
    this.handleOpenSettings();
  };

  private readonly handleResetTournamentSave = (): void => {
    clearTournamentSave();
    this.clearLiveMatch();
    this.tournament = undefined;
    this.state.lastMatchResult = undefined;
    this.state.screen = 'home';
    this.updateTouchControlsVisibility();
    this.showHomeScreen();
  };

  private readonly handleResetSettings = (): void => {
    this.settings = resetSettings();
    this.applySettings();
    this.handleOpenSettings();
  };

  private readonly handleOpenTactics = (): void => {
    if (!this.tournament) {
      this.handleOpenHome();
      return;
    }
    this.routerShow('tactics', { tournament: this.tournament });
  };

  private readonly handleConfirmTactics = (tactics: UserTactics, lineupIds: string[]): void => {
    const fixture = this.tournament?.getNextUserFixture();
    if (!fixture) return;
    this.pendingUserTactics = tactics;
    this.pendingUserLineupIds = lineupIds;
    this.startPlayableFixture(fixture);
  };

  private renderCurrentTournamentScreen(): void {
    if (!this.tournament) {
      this.showHomeScreen();
      return;
    }

    const snapshot = this.tournament.getSnapshot();
    if (snapshot.championTeamId || this.state.screen === 'champion') {
      this.state.screen = 'champion';
      this.router.hide();
      this.tournamentUi.show();
      this.updateTouchControlsVisibility();
      this.tournamentUi.renderChampion(snapshot);
    } else {
      // Default to the new Manager Hub for any non-champion fallback.
      this.handleOpenManagerHub();
    }
  }

  private applySettings(): void {
    const dprCap = this.getPixelRatioCap(this.settings.graphicsQuality);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
    this.renderer.shadowMap.enabled = this.settings.graphicsQuality !== 'low';
    this.renderer.shadowMap.type =
      this.settings.graphicsQuality === 'high' ? PCFShadowMap : BasicShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.stadium.visible =
      this.settings.crowdEnabled && this.settings.graphicsQuality !== 'low';
    this.cameraSystem?.setSensitivity(this.settings.cameraSensitivity);
    this.touchControls.setOpacity(this.settings.mobileControlsOpacity);
    soundHooks.setEnabled(this.settings.soundEnabled);
  }

  private getPixelRatioCap(quality: GraphicsQuality): number {
    if (quality === 'low') return 1;
    if (quality === 'high') return 2;
    return 1.5;
  }

  private updateTouchControlsVisibility(): void {
    const visible = this.state.screen === 'matchPlaying' && TouchControls.shouldAutoShow();
    this.touchControls.setVisible(visible);
    document.body.classList.toggle('game-playing', this.state.screen === 'matchPlaying');
  }

  private updatePlayerVisuals(delta: number): void {
    const possessor = this.possessionSystem?.getState().owner;
    for (const player of [
      ...(this.blueTeam?.players ?? []),
      ...(this.redTeam?.players ?? []),
    ]) {
      player.updateVisual(delta, player === possessor);
    }
  }

  private stepPhysics(delta: number): void {
    this.physicsAccumulator += delta;

    let subSteps = 0;
    while (
      this.physicsAccumulator >= PHYSICS.fixedStep &&
      subSteps < PHYSICS.maxSubSteps
    ) {
      this.physics.world.step();
      this.physicsAccumulator -= PHYSICS.fixedStep;
      subSteps += 1;
    }

    if (subSteps === PHYSICS.maxSubSteps) {
      this.physicsAccumulator = 0;
    }
  }

  private readonly handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.applySettings();
    this.updateTouchControlsVisibility();
  };
}
