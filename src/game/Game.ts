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
import { createInitialGameState, type UserTactics } from './GameState';
import type { TournamentPlayerProfile } from '../tournament/teams';
import { addLighting } from './lighting';
import { createPitch, createScene } from './scene';
import { soundHooks } from './soundHooks';
import { createStadiumEnvironment } from './stadium';

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
  private physicsAccumulator = 0;
  private animationFrame = 0;
  private lastTimestamp = 0;
  private fps = 0;
  private debugVisible = false;
  // Pending tactics/lineup captured from the pre-match tactics screen and consumed
  // once by startPlayableFixture → rebuildMatchTeams.
  private pendingUserTactics?: UserTactics;
  private pendingUserLineupIds?: string[];

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
    });
    this.applySettings();
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderHome(hasTournamentSave());

    window.addEventListener('resize', this.handleResize);
  }

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

    if (this.input.wasRestartPressed()) {
      this.debugVisible = false;
      this.teamAI.setDebugVisible(false);
      this.matchSystem.restart();
    }

    this.possessionSystem.update([this.blueTeam, this.redTeam], delta);

    if (!this.matchSystem.isResetting) {
      this.playerSelection.update();
      this.playerControl.update(delta);
      this.teamAI.update(delta);
      this.tackleSystem?.update([this.blueTeam, this.redTeam], delta);
      this.possessionSystem.update([this.blueTeam, this.redTeam], delta);
    }

    this.matchSystem.update(delta);
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
    this.tournamentUi.hide();
    this.hud.show();
    this.minimap.show();
    this.state.screen = 'matchPlaying';
    this.updateTouchControlsVisibility();
    this.updateHud();
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
    });
    this.redTeam = createTeam('red', opponentTeam, { formation: opponentFormation });

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
    this.clearLiveMatch();
    this.tournament = undefined;
    this.state.lastMatchResult = undefined;
    this.state.screen = 'countrySelection';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderCountrySelection();
  };

  private readonly handleContinueTournament = (): void => {
    const tournament = loadTournament();
    if (!tournament) {
      this.tournamentUi.renderHome(false);
      return;
    }

    this.clearLiveMatch();
    this.tournament = tournament;
    this.state.screen = tournament.championTeamId ? 'champion' : 'groupStage';
    this.updateTouchControlsVisibility();
    this.renderCurrentTournamentScreen();
  };

  private readonly handleTeamSelected = (teamId: string): void => {
    this.tournament = new TournamentState(teamId);
    this.tournament.simulateUntilUserMatchOrComplete();
    saveTournament(this.tournament);
    this.state.screen = 'groupStage';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderGroupStage(this.tournament.getSnapshot());
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
    this.tournament.simulateUntilUserMatchOrComplete();
    saveTournament(this.tournament);

    this.state.lastMatchResult = {
      userTeamName: this.blueTeam?.name ?? 'User',
      opponentTeamName: this.redTeam?.name ?? 'Opponent',
      userScore: result.blueScore,
      opponentScore: result.redScore,
      stage: fixture.stage,
    };
    this.clearLiveMatch();
    this.tournamentUi.show();
    this.state.screen = 'matchComplete';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderMatchComplete(this.state.lastMatchResult);
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
    this.tournamentUi.renderHome(hasTournamentSave());
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
    this.state.screen = 'groupStage';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderGroupStage(this.tournament.getSnapshot());
  };

  private readonly handleOpenMatchPreview = (): void => {
    if (!this.tournament) {
      this.handleOpenHome();
      return;
    }
    this.state.screen = 'matchPreview';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderMatchPreview(this.tournament.getSnapshot());
  };

  private readonly handleOpenBracket = (): void => {
    if (!this.tournament) {
      this.handleOpenHome();
      return;
    }
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
    this.tournamentUi.renderHome(false);
  };

  private readonly handleResetSettings = (): void => {
    this.settings = resetSettings();
    this.applySettings();
    this.handleOpenSettings();
  };

  private readonly handleOpenSquad = (): void => {
    if (!this.tournament) {
      this.handleOpenHome();
      return;
    }
    this.state.screen = 'squad';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderSquad(this.tournament.selectedTeam, this.tournament.getSnapshot());
  };

  private readonly handleOpenTactics = (): void => {
    if (!this.tournament) {
      this.handleOpenHome();
      return;
    }
    this.state.screen = 'pickTactics';
    this.updateTouchControlsVisibility();
    this.tournamentUi.renderTactics(
      this.tournament.selectedTeam,
      this.tournament.getSnapshot(),
      this.state.liveMatch?.userTactics,
    );
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
      this.tournamentUi.renderHome(hasTournamentSave());
      return;
    }

    const snapshot = this.tournament.getSnapshot();
    if (snapshot.championTeamId || this.state.screen === 'champion') {
      this.state.screen = 'champion';
      this.updateTouchControlsVisibility();
      this.tournamentUi.renderChampion(snapshot);
    } else if (this.state.screen === 'bracket') {
      this.updateTouchControlsVisibility();
      this.tournamentUi.renderBracket(snapshot);
    } else if (this.state.screen === 'matchPreview') {
      this.updateTouchControlsVisibility();
      this.tournamentUi.renderMatchPreview(snapshot);
    } else if (this.state.screen === 'squad') {
      this.updateTouchControlsVisibility();
      this.tournamentUi.renderSquad(this.tournament.selectedTeam, snapshot);
    } else if (this.state.screen === 'pickTactics') {
      this.updateTouchControlsVisibility();
      this.tournamentUi.renderTactics(
        this.tournament.selectedTeam,
        snapshot,
        this.state.liveMatch?.userTactics,
      );
    } else {
      this.updateTouchControlsVisibility();
      this.tournamentUi.renderGroupStage(snapshot);
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
