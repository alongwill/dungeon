# Dungeon

A single-player, turn-based fantasy RPG in the browser. Build a hero from eight classic
classes and take them through hand-written quests with visible dice, branching scenes and
tactical combat. Design spec: [docs/DESIGN.md](docs/DESIGN.md).

## Dependencies

Runtime: `preact` (UI), `three` (3D battle effects — lazy-loaded chunk, nice-to-have,
and the game fully works without it: it never mounts if WebGL, the user's reduced-motion
preference, or the Settings toggle says no). Dev: `vite`, `@preact/preset-vite`,
`typescript`, `vitest`, `@types/three`.

The **3D battle effects** toggle lives in Settings; it's off-greyed ("unavailable on
this device") when WebGL is missing. The Three.js bundle only downloads when a combat
actually mounts effects.

## Run locally

```sh
npm ci
npm run dev        # vite dev server
npm test           # vitest suite
npm run validate-quests  # validate every quests/*/quest.json
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build
```

## Deploy

`.github/workflows/deploy.yml` builds on every push/PR and deploys to GitHub Pages on
`main` via `actions/upload-pages-artifact` + `actions/deploy-pages`.

**One-time step:** Settings → Pages → Source = *GitHub Actions*.
The build uses `base: './'`, so relative asset URLs work under `/<repo>/` or any path.

## Adding a quest

Drop a folder `quests/<quest-id>/` containing a `quest.json` (plus optional `assets/`).
Folder name = quest id. Rebuild — no registry to edit, validation runs in CI.
Authoring guide: [docs/QUESTS.md](docs/QUESTS.md).

## Adding a class

Touch these data files:

- `src/content/classes.ts` — hit die, saves, skills, ability priority, resources, kit, ability ids.
- `src/content/abilities.ts` — an `AbilityDef` per ability (kind, cost, dice, save, conditions).
- `src/content/names.ts` — a name table.
- `src/avatar/parts.ts` — a frame colour in `FRAME_COLOURS`.
- Add the class id to `ClassId` in `src/engine/quest/types.ts`, and a creation test in `tests/rules.test.ts`.

Engine code is needed only for a genuinely new effect — add a `special` tag to the ability
and handle it in `src/engine/combat/index.ts#resolveAbility`.

## Project structure

```
src/engine/    pure game engine (no DOM, no Date, no Math.random — all RNG seeded)
src/content/   classes, abilities, items, name tables (data only)
src/avatar/    deterministic SVG avatar generator
src/persistence/  save slots, envelope, migrations
src/quests/    build-time quest discovery (import.meta.glob)
src/ui/        Preact screens, store, styles
quests/        quest JSON + assets
tests/         vitest specs + fixtures
```

## Known limitations

- Single hero, no party; theatre-of-mind combat (no grid, no reactions).
- Levels 1–5 only; fixed class skills/spells (no picking).
- Three save slots in localStorage; no export/import UI yet.
