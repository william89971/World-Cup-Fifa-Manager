# World 5s Cup Format

World 5s Cup is an original 48-team international-style tournament format for Codex Futbol. It does not use official tournament names, logos, badges, kits, federation marks, player names, or real kit designs.

## Teams

Each team has:

- Country name
- Short code
- Original primary and secondary colors
- Inline SVG national flag layout
- Eleven fictional, nation-flavored player profiles with role, number, personality archetype, traits, top traits, and procedural style seeds
- Attack, defense, speed, stamina, and overall ratings
- Team tactical style: possession, counterAttack, highPress, defensive, balanced, or directAttack
- Formation preferences: 4-3-3, 4-4-2, and 3-5-2 in style-dependent order

Real country names and national flag layouts are used as labels and simple inline SVG visuals. There are no official federation badges, official kits, player likenesses, tournament marks, or copyrighted logos.

## Group Stage

- 12 groups of 4 teams.
- Each team plays 3 matches.
- Standings track points, wins, draws, losses, goals for, goals against, and goal difference.
- Ranking rules are points, goal difference, goals for, then deterministic tie seed.
- The UI highlights the selected user team and shows a best-third-place table.

## Qualification

- Top 2 teams from each group qualify automatically.
- The 8 best third-place teams also qualify.
- 32 teams enter the knockout bracket.

## Knockout

- Round of 32
- Round of 16
- Quarter-finals
- Semi-finals
- Final

Knockout matches cannot end in draws. CPU knockout draws get a simple penalty-style text result. User knockout draws are resolved by the current match result mapping until a fuller extra-time/penalties mode is added.

## Save Structure

Tournament and settings data are stored in localStorage:

- `codex-futbol.world-5s-cup.save`: selected team, groups, standings, fixtures, bracket, champion, user elimination state, and generated 11-player team profiles.
- `codex-futbol.world-5s-cup.settings`: match length, crowd placeholder visibility, graphics quality, camera sensitivity, sound placeholder state, and mobile controls opacity.

Auto-save runs after country selection, CPU simulation, and completed user matches. New Tournament clears the saved tournament.

Old saves that do not contain player profile data are migrated by regenerating deterministic team profiles from the current country data.

## Reliability Checks

Run:

```bash
npm run validate:tournament
```

The validation script checks:

- 48 unique teams and team codes.
- Each team has 11 generated players with valid roles, personality archetype, top traits, team style, and formation preferences.
- 12 groups of 4 teams.
- 72 group fixtures with each team playing 3 group matches.
- Top 2 plus 8 best third-place teams producing 32 qualifiers.
- Knockout round fixture counts from Round of 32 through Final.
- Knockout fixtures never completing as draws.
- Champion matching the completed Final winner.
- Save data preserving the tournament shape.
