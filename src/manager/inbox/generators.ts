import type { TournamentState } from '../../tournament/TournamentState';
import type { MatchReport, NewsItem, TrainingSession } from '../types';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateMatchNews(state: TournamentState, report: MatchReport, result: 'W' | 'D' | 'L'): NewsItem[] {
  const userTeamId = state.selectedTeamId;
  const userTeam = state.getTeam(userTeamId);
  const oppTeam = state.getTeam(report.homeTeamId === userTeamId ? report.awayTeamId : report.homeTeamId);
  const userScore = report.homeTeamId === userTeamId ? report.homeScore : report.awayScore;
  const oppScore = report.homeTeamId === userTeamId ? report.awayScore : report.homeScore;
  const ratings = report.homeTeamId === userTeamId ? report.homeRatings : report.awayRatings;
  const items: NewsItem[] = [];

  const verb = result === 'W' ? 'beat' : result === 'L' ? 'lost to' : 'drew with';
  items.push({
    id: uid('match'),
    dateMs: report.dateMs,
    kind: 'match',
    title: `${userTeam.name} ${userScore}-${oppScore} ${oppTeam.name}`,
    body: `${userTeam.name} ${verb} ${oppTeam.name} in the ${report.stage}. ${result === 'W' ? 'A confident performance.' : result === 'L' ? 'A tough afternoon at the office.' : 'Honours even.'}`,
    read: false,
    relatedFixtureId: report.fixtureId,
  });

  const motm = ratings.find((r) => r.isMotm);
  if (motm) {
    items.push({
      id: uid('motm'),
      dateMs: report.dateMs,
      kind: 'match',
      title: `Player of the match: ${motm.playerName}`,
      body: `${motm.playerName} earned ${motm.rating.toFixed(1)} as ${userTeam.name}'s standout performer.`,
      read: false,
      relatedPlayerId: motm.playerId,
    });
  }

  const lowest = [...ratings].sort((a, b) => a.rating - b.rating)[0];
  if (lowest && lowest.rating <= 5) {
    items.push({
      id: uid('flop'),
      dateMs: report.dateMs,
      kind: 'form',
      title: `${lowest.playerName} struggled`,
      body: `${lowest.playerName} put in a difficult shift (${lowest.rating.toFixed(1)}). Worth a chat at training.`,
      read: false,
      relatedPlayerId: lowest.playerId,
    });
  }

  return items;
}

export function generateTrainingNews(session: TrainingSession, state: TournamentState): NewsItem[] {
  const userTeam = state.getTeam(state.selectedTeamId);
  if (session.deltas.length === 0) return [];
  const topGain = [...session.deltas]
    .filter((d) => typeof d.traitDelta === 'number')
    .sort((a, b) => (b.traitDelta ?? 0) - (a.traitDelta ?? 0))[0];
  if (!topGain) return [];
  return [
    {
      id: uid('train'),
      dateMs: session.dateMs,
      kind: 'training',
      title: `Training: ${session.focus} session`,
      body: `${userTeam.name} ran a ${session.intensity}-intensity ${session.focus} session. ${session.note}`,
      read: false,
    },
  ];
}

export function generateScoutNews(state: TournamentState, opponentName: string, recommendation: string): NewsItem[] {
  return [
    {
      id: uid('scout'),
      dateMs: Date.now(),
      kind: 'scout',
      title: `Scouting report: ${opponentName}`,
      body: recommendation,
      read: false,
    },
  ];
}

export function generateTournamentNews(state: TournamentState, title: string, body: string): NewsItem[] {
  return [
    {
      id: uid('trn'),
      dateMs: Date.now(),
      kind: 'tournament',
      title,
      body,
      read: false,
    },
  ];
}
