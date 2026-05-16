import type { MatchStats, MatchEvent } from '../manager/types';
import type { PossessionSystem } from './PossessionSystem';
import type { Team } from '../entities/Team';

function emptyStats(): MatchStats {
  return {
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
}

/**
 * Tracks running match statistics by sampling the possession system each tick
 * and consuming MatchEvent emissions. The "home" side is whichever team is
 * the blue team (user) and "away" is red, since the engine doesn't track home
 * vs away semantics beyond fixture data.
 */
export class MatchStatsSystem {
  private stats = emptyStats();
  private bluePossessionSeconds = 0;
  private redPossessionSeconds = 0;
  private events: MatchEvent[] = [];
  // Synthetic pass counter: count "passable" moments per side based on possession ticks.
  private passTick = { blue: 0, red: 0 };

  constructor(
    private readonly possession: PossessionSystem,
    private readonly blueTeam: Team,
    private readonly redTeam: Team,
  ) {}

  reset(): void {
    this.stats = emptyStats();
    this.bluePossessionSeconds = 0;
    this.redPossessionSeconds = 0;
    this.events = [];
    this.passTick = { blue: 0, red: 0 };
  }

  update(delta: number): void {
    const state = this.possession.getState();
    if (state.team === this.blueTeam) {
      this.bluePossessionSeconds += delta;
      this.passTick.blue += delta;
      while (this.passTick.blue > 1.5) {
        this.passTick.blue -= 1.5;
        this.stats.passes.home += 1;
      }
    } else if (state.team === this.redTeam) {
      this.redPossessionSeconds += delta;
      this.passTick.red += delta;
      while (this.passTick.red > 1.5) {
        this.passTick.red -= 1.5;
        this.stats.passes.away += 1;
      }
    }
    const total = this.bluePossessionSeconds + this.redPossessionSeconds || 1;
    this.stats.possessionPct = Math.round((this.bluePossessionSeconds / total) * 100);
  }

  onEvent(event: MatchEvent): void {
    this.events.unshift(event);
    if (this.events.length > 200) this.events.length = 200;
    const homeSide = event.team === 'blue' ? 'home' : 'away';
    switch (event.type) {
      case 'shot':
        this.stats.shots[homeSide] += 1;
        if (event.detail === 'on-target' || event.detail === 'goal' || event.detail === 'save') {
          this.stats.shotsOnTarget[homeSide] += 1;
        }
        break;
      case 'goal':
        this.stats.shots[homeSide] += 1;
        this.stats.shotsOnTarget[homeSide] += 1;
        break;
      case 'save':
        this.stats.shotsOnTarget[event.team === 'blue' ? 'away' : 'home'] += 1;
        this.stats.shots[event.team === 'blue' ? 'away' : 'home'] += 1;
        break;
      case 'foul':
        this.stats.fouls[homeSide] += 1;
        this.stats.tackles[homeSide] += 1;
        break;
      case 'card':
        if (event.cardType === 'yellow') this.stats.yellows[homeSide] += 1;
        else if (event.cardType === 'red') this.stats.reds[homeSide] += 1;
        break;
      case 'corner':
        this.stats.corners[homeSide] += 1;
        break;
      case 'offside':
        this.stats.offsides[homeSide] += 1;
        break;
      default:
        break;
    }
    // Estimate pass accuracy from time-in-possession (placeholder; real engine doesn't track pass attempts yet).
    this.stats.passAccuracy.home = Math.max(55, Math.min(95, 78 + Math.round((this.stats.possessionPct - 50) * 0.25)));
    this.stats.passAccuracy.away = Math.max(55, Math.min(95, 78 + Math.round((50 - this.stats.possessionPct) * 0.25)));
  }

  getStats(): MatchStats {
    return this.stats;
  }

  getEvents(limit = 200): MatchEvent[] {
    return this.events.slice(0, limit);
  }
}
