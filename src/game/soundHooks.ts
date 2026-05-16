let enabled = true;

export const soundHooks = {
  setEnabled(nextEnabled: boolean): void {
    enabled = nextEnabled;
  },
  kickoff(): void {
    this.onWhistle();
  },
  goal(): void {
    this.onGoal();
  },
  fullTime(): void {
    this.onWhistle();
  },
  kick(): void {
    this.onKick();
  },
  onKick(): void {
    if (!enabled) return;
    // Placeholder for future ball contact audio.
  },
  onPass(): void {
    if (!enabled) return;
    // Placeholder for future pass audio.
  },
  onGoal(): void {
    if (!enabled) return;
    // Placeholder for a future goal sound.
  },
  onWhistle(): void {
    if (!enabled) return;
    // Placeholder for a future whistle sound.
  },
  onTackle(): void {
    if (!enabled) return;
    // Placeholder for future tackle audio.
  },
};
