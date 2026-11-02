# Agent notes

- Spec: `docs/DESIGN.md` (approved). Quest authoring: `docs/QUESTS.md`.
- Verify: `npm run typecheck && npm test && npm run build`. Quest-only check: `npm run validate-quests`.
- `src/engine/` must stay pure (no DOM, Date, Math.random); all randomness via the seeded RNG in `GameState`.
- Enemy tuning: `tests/balance.test.ts` enforces per-class win-rate bands and enemy stat floors; tune enemy JSON, not class rules.
- Runtime deps: `preact`, `three` (lazy fx chunk only). Ask before adding more; pin exact versions ≥7 days old.
- Do not commit; stage only (owner signs commits).
