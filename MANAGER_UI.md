# Manager UI — Architecture

Manager screens are pure-functional renderers that take a `host: HTMLElement` and `props` object, write HTML into the host, and bind event listeners. Each module exports a factory `createXxxScreen(handlers): ScreenModule<Props>` that the `ScreenRouter` registers.

## Files

```
src/
  app/
    ScreenRouter.ts        # screen lifecycle (register/show/hide/dispose)
  components/              # reusable primitives (see UI_STYLE_GUIDE.md)
  screens/
    HomeScreen.ts          # 4-button main menu
    manager/
      ManagerHub.ts        # dashboard
      SquadScreen.ts       # squad list w/ tabs+sort+filter
      PlayerProfile.ts     # player deep-dive (radar+bars+sparkline)
      TacticsScreen.ts     # formation/style/mentality/8 sliders
      FormationPitchScreen.ts  # SVG pitch swap UI
      LineupScreen.ts      # XI+bench+captain confirmation
      MatchPreviewScreen.ts    # comparison bars + recommendation
      InMatchPanel.ts      # slide-in tactics/subs/stats panel
      PostMatchScreen.ts   # ratings + MotM + stats + scorers
      TrainingScreen.ts    # focus + intensity + history
      ScoutingScreen.ts    # opponent report + suggested tactics
      InboxScreen.ts       # news list + detail
      FixturesScreen.ts    # filterable fixtures table
      StandingsScreen.ts   # 12-group standings + best third
      BracketScreen.ts     # 5-round knockout columns
  manager/
    types.ts                              # ManagerTactics, MatchEvent, MatchReport, NewsItem, TrainingSession, ...
    postmatch/applyAftermath.ts           # decrement condition / shift morale / push report+news
    training/runTraining.ts               # trait deltas per focus × intensity
    scouting/recommend.ts                 # rule-based opponent counter
    inbox/generators.ts                   # NewsItem factories
  save/
    AutosaveBadge.ts                      # toast on AUTOSAVE_EVENT
```

## Screen module shape

```ts
export interface ScreenModule<P> {
  render(host: HTMLElement, props: P): void;
  dispose?(): void;
}
```

## State management

- `Game` holds the singleton `TournamentState`, the persisted save, settings, the live match systems, and a `ScreenRouter`.
- Each screen takes `tournament` (live reference) plus screen-specific data via `props`.
- Mutations route through `Game` handlers passed into screen factories — screens never mutate state directly.
- `Game.routerShow(screen, props)` hides the legacy `tournamentUi` and shows a `ScreenRouter`-managed screen.
- Legacy `TournamentUi` is kept alive as an adapter for the original country-selection / group-stage flow used during the initial render after `handleTeamSelected`. Once user is in the new flow, all routing goes through `ScreenRouter`.

## Event handling

DOM is rebuilt on every render. Each render call binds listeners by querying for `[data-action]` elements and matching against the action string. Per-screen modules wire their own handlers (sub-actions get `data-attrs`).

## Adding a new screen

1. Add the `GameScreen` literal to `src/game/GameState.ts`.
2. Create `src/screens/manager/MyScreen.ts` exporting `createMyScreen(handlers)`.
3. In `Game.registerScreens()`, call `this.router.register('myScreen', createMyScreen(...))`.
4. Trigger via `this.routerShow('myScreen', { tournament: this.tournament })`.
5. Wire it into `ManagerHub` (the `Quick actions` grid) by extending `handleManagerNavigate`.

## Console.log conventions

`[menu]`, `[hub]`, `[training]`, `[sub]` log major actions for Phase 25 button-QA. Remove only when adding richer telemetry.
