import type { MatchEvent } from '../manager/types';

export type MatchEventListener = (event: MatchEvent) => void;

/**
 * Per-match event bus. Created at the start of each playable fixture and torn down
 * with the match. Decouples emitters (MatchSystem, TackleSystem, SubstitutionSystem)
 * from consumers (MatchStatsSystem, CommentarySystem, in-match panel).
 */
export class MatchEventBus {
  private listeners: MatchEventListener[] = [];

  on(listener: MatchEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(event: MatchEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  clear(): void {
    this.listeners = [];
  }
}
