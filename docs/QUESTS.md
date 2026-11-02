# Quest authoring guide

A quest is a folder under `quests/` — the folder name **is** the quest id (kebab-case,
must equal the `id` field):

```
quests/my-quest/
  quest.json      required
  assets/         optional SVG/PNG/WebP art, referenced as "assets/x.svg" in scenes
```

Discovery is automatic via `import.meta.glob` — drop the folder and rebuild.

## Your first quest, step by step

1. `cp -r quests/template-cellar-rats quests/my-quest`
2. Open `quests/my-quest/quest.json`. Change `"id"` to `"my-quest"` and `"title"`,
   `"summary"` and `"version"` (`"1.0.0"`).
3. Edit the scenes. Rename scene keys freely — `start` must point at a real scene id
   and every `goto`/`next` must resolve.
4. `npm run validate-quests` — fixes are reported as errors per check (bad refs, bad
   dice, no reachable ending, flee-less encounters that allow fleeing).
5. `npm run dev`, create a hero, and pick your quest from the quest list. Play it
   end to end — the validator can't judge pacing.
6. Consider a balance run: add your encounter to `tests/balance.test.ts` (see below).

## Top-level fields

```jsonc
{
  "schemaVersion": 1,            // required, always 1
  "id": "my-quest",              // kebab-case, == folder name
  "version": "1.0.0",            // your content version (stored in saves)
  "title": "…", "summary": "…",
  "author": "…",                 // optional
  "recommendedLevel": 1,         // optional
  "estimatedMinutes": 30,        // optional
  "start": "scene-id",           // first scene
  "flags": { "k": 0 },           // initial quest-local flags (number|boolean|string)
  "npcs":    { "id": { "name": "…", "title"?, "avatar"? } },
  "enemies": { "id": EnemyDef },
  "items":   { "id": ItemDef },  // quest-local items; global items live in src/content/items.ts
  "scenes":  { "id": Scene }
}
```

## Scenes

Shared fields: `type`, `title`, `text` (paragraphs separated by `\n\n`; supports
`{{hero.name}}`, `{{hero.class}}`, `{{flag.x}}`), `image?`, `onEnter?: Effect[]`,
`rest?: "short" | "long"` (`"long"` enables the Long Rest button there — e.g. inns).

| type | fields | behaviour |
|---|---|---|
| `narration` | `choices` | text + numbered choices |
| `dialogue` | `speaker` (npc id), `choices` | like narration, with NPC avatar/name |
| `check` | `check`, `success`, `failure` | forced roll on entry, then pending card → outcome |
| `encounter` | `enemies [{enemy, count?}]`, `surprise?`, `canFlee?`, `fleeDC?`, `victory`, `flee?`, `defeat?` | combat. `flee` is required unless `canFlee:false`. No `defeat` means death. |
| `loot` | `gold?` (number or dice), `items? [{item, qty?}]`, `next` | grants gold/items, pending card → `next` |
| `ending` | `outcome: victory|neutral|defeat`, `xp?`, `epilogue?`, `onEnter?` | completes the quest |

```jsonc
// Choice — either a plain goto, or a check with two outcomes
{ "text": "…", "requires"?: Condition, "hideIfUnmet"?: false,
  "check"?: { "skill" | "ability", "dc", "advantageIf"?, "disadvantageIf"? },
  "success"?: Outcome, "failure"?: Outcome,
  "goto"?: "scene", "effects"?: Effect[] }
// Outcome: { "goto": "scene", "effects"?, "text"? }   // text shown before moving on
```

## Effects — one line each

```jsonc
{"setFlag": "met-king", "value": true}          // sets a flag to any JSON value
{"addFlag": "suspicion", "by": 1}               // += to a numeric flag
{"gold": 50}                                    // grant gold (negative = spend)
{"gold": "2d6+10"}                              // gold via dice
{"addItem": "potion-healing"}                   // grant item (qty optional, default 1)
{"removeItem": "dried-meat", "qty": 1}          // take item
{"xp": 75}                                      // grant XP (may trigger level-up)
{"heal": "2d4+2"}                               // heal the hero
{"damage": "1d6", "type": "fire", "save": {"ability": "DEX", "dc": 12, "half": true}}
{"condition": "poisoned", "rounds": 3}          // apply a named condition
{"restoreSlots": true}                          // restore all spell slots
```

## Conditions — one line each (requires / advantageIf / disadvantageIf)

```jsonc
{"flag": "met-king", "eq": true}
{"flag": "suspicion", "gte": 3}
{"hasItem": "bell-clapper"}
{"class": ["rogue", "bard"]}
{"ability": "STR", "gte": 15}
{"gold": {"gte": 50}}
{"level": {"gte": 3}}
{"all": [{"hasItem": "key"}, {"level": {"gte": 2}}]}   // AND
{"any": [{"class": ["druid"]}, {"hasItem": "meat"}]}  // OR
{"not": {"flag": "coward"}}                            // NOT
```

## Flags

Flags are per-quest storage (numbers, booleans, strings) that persist across scenes
within one playthrough. Set them in `flags` at the top of the quest, write them with
`setFlag`/`addFlag` effects, read them with `flag` conditions or `{{flag.name}}`
interpolation in text. They're saved with the game — a hero who returns after a long
rest finds the marsh exactly as they left it.

## EnemyDef

```jsonc
{ "name", "avatar"?, "ac", "hp": "dice", "dex", "saves"?: {"DEX": 4},
  "passivePerception", "xp", "resist"|"vulnerable"|"immune"?: [damageTypes],
  "undead"?: true,
  "actions": [{ "name", "attack"?: toHit, "damage"?: dice, "type"?,
                "save"?: {ability, dc, half}, "weight"?, "recharge"?: rounds }],
  "phases"?: [{ "belowHpPct", "text", "addActions"?: [...] }],
  "morale"?: { "fleeBelowHpPct" } }
```

An action needs `attack` (roll vs AC) or `save` (hero saves). `recharge` = usable every N
rounds, preferred when ready; otherwise weighted-random via `weight` (default 1).

## ItemDef

`{name, kind, value?}` — kind `weapon` (`damage`, `damageType`, `ability: STR|DEX|finesse`),
`armour` (`armour: light|medium|heavy`), `shield`, `consumable` (`use: Effect[]`),
`treasure`, `key`.

## AvatarSpec

`{seed, skin, hair, hairColour, eyes, mouth, accessory, frame, creature?}`.
Allowed values (from `src/avatar/parts.ts`):

- `skin`: `peach | tan | brown | umber | rose`
- `hair`: `crop | bob | long | mohawk | bald`
- `hairColour`: `black | brown | auburn | gold | white`
- `eyes`: `round | narrow | bright | sleepy | wide`
- `mouth`: `smile | grin | flat | open | smirk`
- `accessory`: `none | scar | freckles | eyepatch | circlet`
- `frame`: any class id, or `"npc"`, or `"enemy"`
- `creature`: `goblin | wolf | rat | skeleton | troll | beast` — unknown values fall back to the generic `beast` paw mark. If an enemy def has no `avatar`, the UI fabricates `{seed: hash(id), frame: "enemy", creature: "beast"}` so every enemy card is never bare.

## Item lookup rule

When resolving an item id (in `addItem`, `removeItem`, `requires.hasItem`, loot, or the
shop), quest-local items are checked **first**, then the global catalogue in
`src/content/items.ts`. If a local item shares a global id, the local one wins.

## Balance tips

- `tests/balance.test.ts` simulates every class against every encounter with a greedy
  policy (heal under 35%, spend slots, best damage option) over 200 runs per class.
- To add your encounter: append a `CASES` entry with the quest object, scene id,
  expected hero level, and minimum win-rate (0.70 normal, 0.45 boss).
- Rules of thumb: one enemy per hero level is easy; three weak enemies at L1 is a real
  fight; save-vs-DC 10–12 at low levels hits often; a `morale.fleeBelowHpPct` of 30–50
  makes packs survivable because wounded enemies run.
- Tune ENEMY stats, not class rules. Re-run `npm test` — it takes ~2s.

## Common mistakes

- A `goto` pointing at a scene that doesn't exist (validator error).
- A `canFlee` encounter without a `flee` outcome (validator error).
- A check with neither `skill` nor `ability`.
- `gold` values that aren't numbers or valid dice (`"gold": "2d6"` is fine; `"gold": "some"` is not).
- Misspelled skill names — use the camelCase ids: `sleightOfHand`, `animalHandling`, etc.
- Scenes nothing reaches — the validator warns, but a dead-end quest is worse.

## Template walkthrough

`quests/template-cellar-rats/` shows the whole flow in six scenes:
`inn` (dialogue with an optional Persuasion choice-check that pays out via `effects`) →
`cellar-stairs` (forced `check` scene, failure does damage) → `cellar` (encounter with
morale-fleeing rats and a phased Rat King boss) → `spoils` (loot) → three `ending` scenes
(victory / neutral / defeat). `quests/hollowmere-bell/` is the fuller reference: class-gated
choices, a riddle side-objective, a parley path, and four endings.
