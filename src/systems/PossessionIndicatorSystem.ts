import {
  ConeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Scene,
} from 'three';
import type { Ball } from '../entities/Ball';
import type { Player } from '../entities/Player';
import type { Team } from '../entities/Team';
import { READABILITY } from '../game/constants';
import type { PossessionSystem } from './PossessionSystem';

const NEUTRAL_BALL_GLOW = 0xbfd4cc;

export class PossessionIndicatorSystem {
  private readonly possessorMarker: Mesh;
  private readonly controlledMarker: Mesh;

  constructor(
    scene: Scene,
    private readonly ball: Ball,
  ) {
    this.possessorMarker = new Mesh(
      new ConeGeometry(0.25, 0.34, 3),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 }),
    );
    this.possessorMarker.rotation.x = Math.PI;
    this.possessorMarker.visible = false;

    this.controlledMarker = new Mesh(
      new OctahedronGeometry(0.18, 0),
      new MeshStandardMaterial({
        color: 0xf6d66f,
        emissive: 0x4a3905,
        emissiveIntensity: 0.45,
        roughness: 0.4,
      }),
    );
    this.controlledMarker.visible = false;

    scene.add(this.possessorMarker, this.controlledMarker);
  }

  update(
    possession: PossessionSystem,
    controlledPlayer: Player | null,
    blueTeam: Team,
    redTeam: Team,
  ): void {
    // Manager mode: no on-pitch markers above players. Keep a very subtle ball glow
    // tinted to the team in possession so you can read who has the ball at distance.
    const state = possession.getState();
    const owner = state.owner;
    this.possessorMarker.visible = false;
    this.controlledMarker.visible = false;

    if (owner && state.team) {
      const color = this.getTeamColor(state.team, blueTeam, redTeam);
      this.ball.setGlow(color, 0.18);
    } else {
      this.ball.setGlow(NEUTRAL_BALL_GLOW, 0.12);
    }

    // Silence unused-parameter warnings for blueTeam/redTeam/controlledPlayer when strict.
    void blueTeam;
    void redTeam;
    void controlledPlayer;
  }

  hide(): void {
    this.possessorMarker.visible = false;
    this.controlledMarker.visible = false;
    this.ball.setGlow(NEUTRAL_BALL_GLOW, 0.12);
  }

  private getTeamColor(team: Team, blueTeam: Team, redTeam: Team): number {
    if (team === blueTeam) {
      return blueTeam.tournamentTeam?.colors.primary ?? 0x2587ff;
    }
    if (team === redTeam) {
      return redTeam.tournamentTeam?.colors.primary ?? 0xf04b55;
    }
    return NEUTRAL_BALL_GLOW;
  }
}
