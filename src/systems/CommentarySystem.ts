import type { MatchEvent } from '../manager/types';
import type { Team } from '../entities/Team';

const KICKOFF = [
  'And the whistle blows — kick-off!',
  'We are under way.',
  'The match is on.',
];
const GOAL = [
  '{team} score! {detail}',
  'It is in the net! {team} make it count.',
  'The crowd erupts as {team} find the back of the net.',
  'Brilliant finish by {team}!',
];
const SHOT_ON = [
  '{team} test the keeper.',
  'A shot from {team} — saved!',
  '{team} go close.',
];
const SHOT_OFF = [
  '{team} drag it wide.',
  'A speculative effort from {team}.',
  'Off target from {team}.',
];
const SAVE = [
  'Great save by the {team} keeper.',
  'The {team} stopper claims it.',
];
const FOUL = [
  'Whistle — foul on {team}.',
  'Free kick to the other side; {team} were too eager.',
];
const YELLOW = [
  '{team} pick up a yellow card.',
  'A booking for {team}.',
];
const RED = [
  '{team} are down to ten — a straight red!',
  'Red card! {team} will finish a man short.',
];
const CORNER = [
  '{team} swing in a corner.',
  'Corner for {team}.',
];
const OFFSIDE = [
  'Offside — caught by the {team} defence.',
  'The flag is up; {team} were a step early.',
];
const SUB = [
  '{team} make a change. {detail}',
  'Substitution for {team}.',
];
const TACTIC = [
  '{team} switch their shape.',
  '{team} tweak their approach from the touchline.',
];
const HALF = [
  'Half time — a chance to reset.',
  "We're done for the first half.",
];
const FULL = [
  'Full time. {detail}',
  "That's all from this one.",
];

const PRESS_FILLERS = [
  '{team} press higher up the pitch.',
  '{team} pin the opposition back.',
  '{team} look to control midfield.',
  "The tempo lifts as {team} push forward.",
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

export class CommentarySystem {
  private lines: string[] = [];
  private secondsSinceLastFiller = 0;

  constructor(
    private readonly blueTeam: Team,
    private readonly redTeam: Team,
  ) {}

  reset(): void {
    this.lines = [];
    this.secondsSinceLastFiller = 0;
  }

  onEvent(event: MatchEvent): void {
    const teamName = event.team === 'blue' ? this.blueTeam.name : event.team === 'red' ? this.redTeam.name : '';
    const vars = { team: teamName, detail: event.detail ?? '' };
    let line: string | null = null;
    switch (event.type) {
      case 'kickoff': line = pick(KICKOFF); break;
      case 'goal': line = fill(pick(GOAL), vars); break;
      case 'shot':
        line = fill(pick(event.detail === 'on-target' ? SHOT_ON : SHOT_OFF), vars);
        break;
      case 'save': line = fill(pick(SAVE), vars); break;
      case 'foul': line = fill(pick(FOUL), vars); break;
      case 'card':
        if (event.cardType === 'red') line = fill(pick(RED), vars);
        else line = fill(pick(YELLOW), vars);
        break;
      case 'corner': line = fill(pick(CORNER), vars); break;
      case 'offside': line = fill(pick(OFFSIDE), vars); break;
      case 'sub': line = fill(pick(SUB), vars); break;
      case 'tactic': line = fill(pick(TACTIC), vars); break;
      case 'half': line = pick(HALF); break;
      case 'full': line = fill(pick(FULL), vars); break;
    }
    if (line) {
      this.push(event.minute, line);
    }
  }

  /** Tick filler commentary when nothing happens (every ~12s). */
  update(delta: number, currentMinute: number, possessionTeam: 'blue' | 'red' | undefined): void {
    this.secondsSinceLastFiller += delta;
    if (this.secondsSinceLastFiller < 12) return;
    if (!possessionTeam) return;
    this.secondsSinceLastFiller = 0;
    const teamName = possessionTeam === 'blue' ? this.blueTeam.name : this.redTeam.name;
    this.push(currentMinute, fill(pick(PRESS_FILLERS), { team: teamName }));
  }

  private push(minute: number, text: string): void {
    this.lines.unshift(`${minute}' ${text}`);
    if (this.lines.length > 60) this.lines.length = 60;
  }

  getLines(limit = 8): string[] {
    return this.lines.slice(0, limit);
  }
}
