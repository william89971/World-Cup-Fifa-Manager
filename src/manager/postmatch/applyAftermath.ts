import type { TournamentState } from '../../tournament/TournamentState';
import type { MatchReport, NewsItem, PlayerMatchRating } from '../types';
import { findPlayerByKey } from '../../tournament/TournamentState';
import { generateMatchNews } from '../inbox/generators';

/**
 * Apply the consequences of a finished match to the persistent state.
 * - decrement condition for starters by minutes played × intensity
 * - shift morale based on result
 * - shift form using rolling rating average
 * - push the report into matchHistory
 * - push 1-2 news items into the inbox
 *
 * Pure-ish: mutates `state` in place but otherwise side-effect free.
 */
export function applyMatchAftermath(state: TournamentState, report: MatchReport): void {
  const userTeamId = state.selectedTeamId;
  const userIsHome = report.homeTeamId === userTeamId;
  const userScore = userIsHome ? report.homeScore : report.awayScore;
  const oppScore = userIsHome ? report.awayScore : report.homeScore;
  const result: 'W' | 'D' | 'L' = userScore > oppScore ? 'W' : userScore < oppScore ? 'L' : 'D';

  const team = state.getTeam(userTeamId);
  const ratings = userIsHome ? report.homeRatings : report.awayRatings;
  const ratingById = new Map(ratings.map((r) => [r.playerId, r] as const));

  // Starters: full intensity. Bench: untouched (those who came on during the
  // match are still in the lineup; we don't track minutes-per-player here yet,
  // so use a uniform decrement.)
  for (const profile of team.players) {
    profile.condition = Math.max(0, (profile.condition ?? 100) - 8 - Math.random() * 4);
    const baseMoraleDelta = result === 'W' ? 6 : result === 'L' ? -5 : 1;
    const playerRating = ratingById.get(`${userTeamId}:${profile.role}:${profile.number}`);
    const ratingMoraleDelta = playerRating ? (playerRating.rating - 6.5) * 2 : 0;
    profile.morale = Math.max(0, Math.min(100, (profile.morale ?? 70) + baseMoraleDelta + ratingMoraleDelta));
    // Form: rolling average of last 5 ratings (default 6.5 if missing).
    const newRatings = [...(profile.recentRatings ?? []), playerRating?.rating ?? 6.5].slice(-5);
    profile.recentRatings = newRatings;
    const avg = newRatings.reduce((s, v) => s + v, 0) / newRatings.length;
    profile.form = Math.max(-5, Math.min(5, avg - 6.5));
  }

  state.pushMatchReport(report);

  // Generate news items.
  const news = generateMatchNews(state, report, result);
  for (const item of news) state.pushNews(item);

  void findPlayerByKey;
}

/**
 * Build a synthetic MatchReport from the engine's MatchSystem result + stats system.
 * Player ratings are derived from a simple heuristic: starters get 6.5 ± rating delta
 * based on the team's possession / shot share. The actual goal scorers are
 * unattributed by the engine right now, so we synthesise the player of the match
 * as the highest-rated outfield player on the winning side (or top OVR on draw).
 */
export function buildMatchReportFromEngine(
  state: TournamentState,
  args: {
    fixtureId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    stage: string;
    stats: MatchReport['stats'];
    events: MatchReport['events'];
  },
): MatchReport {
  const homeTeam = state.getTeam(args.homeTeamId);
  const awayTeam = state.getTeam(args.awayTeamId);

  const homeRatings = ratePlayers(homeTeam.players, args.homeTeamId, args.homeScore, args.awayScore, args.stats.possessionPct);
  const awayRatings = ratePlayers(awayTeam.players, args.awayTeamId, args.awayScore, args.homeScore, 100 - args.stats.possessionPct);

  // Distribute goals to ratings: assign goal events to the team's likely scorers
  // (top 3 of striker/winger/attacking mid) round-robin so the post-match list
  // shows real names.
  const goalEvents = args.events.filter((e) => e.type === 'goal');
  for (const event of goalEvents) {
    const team = event.team === 'blue' ? homeTeam : awayTeam;
    const ratings = event.team === 'blue' ? homeRatings : awayRatings;
    const candidates = team.players.filter((p) => ['striker', 'attackingMid', 'leftWing', 'rightWing'].includes(p.role));
    if (candidates.length > 0) {
      const idx = goalEvents.indexOf(event) % candidates.length;
      const scorer = candidates[idx];
      const rating = ratings.find((r) => r.playerId.endsWith(`${scorer.role}:${scorer.number}`));
      if (rating) {
        rating.goals += 1;
        rating.rating = Math.min(10, rating.rating + 0.8);
      }
    }
  }

  const allRatings = [...homeRatings, ...awayRatings];
  const winningSide = args.homeScore > args.awayScore ? homeRatings : args.awayScore > args.homeScore ? awayRatings : allRatings;
  const motm = [...winningSide].sort((a, b) => b.rating - a.rating)[0];
  if (motm) motm.isMotm = true;

  return {
    fixtureId: args.fixtureId,
    dateMs: Date.now(),
    homeTeamId: args.homeTeamId,
    awayTeamId: args.awayTeamId,
    homeScore: args.homeScore,
    awayScore: args.awayScore,
    stage: args.stage,
    stats: args.stats,
    events: args.events,
    homeRatings,
    awayRatings,
    motmPlayerId: motm?.playerId,
    motmTeamId: motm ? (homeRatings.includes(motm) ? args.homeTeamId : args.awayTeamId) : undefined,
  };
}

function ratePlayers(
  players: Array<{ name: string; number: number; role: string; traits: Record<string, number> }>,
  teamId: string,
  scored: number,
  conceded: number,
  possessionPct: number,
): PlayerMatchRating[] {
  const goalDelta = scored - conceded;
  const base = 6.4 + goalDelta * 0.35 + (possessionPct - 50) / 60;
  return players.map((p) => {
    const overall =
      Object.values(p.traits).reduce((s, v) => s + v, 0) / Object.values(p.traits).length;
    const personalDelta = (overall - 0.6) * 2;
    const noise = (Math.random() - 0.5) * 1.2;
    const rating = Math.max(3, Math.min(10, base + personalDelta + noise));
    return {
      playerId: `${teamId}:${p.role}:${p.number}`,
      playerName: p.name,
      rating: Math.round(rating * 10) / 10,
      goals: 0,
      assists: 0,
      tackles: 0,
      passes: 0,
      isMotm: false,
    };
  });
}
