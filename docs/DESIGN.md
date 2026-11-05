# Dungeon — Design Document (Phase 1)

Status: **approved**. Spell slots for magic, Preact + Vite, GitHub Actions → Pages artifact
deploy, levels 1–5 for the MVP. Items marked **[FLAG]** go beyond or interpret the brief; their
resolution is listed under "Decisions" at the end.

---

## 1. Concept and tone

*Dungeon* is a single-player, turn-based fantasy RPG in the browser. The game is your Dungeon
Master. It narrates scenes, offers choices, calls for skill checks and runs combat with visible
dice. You build one hero from twelve classic classes, then take that hero through hand-written
quests. Each quest is a short, branching adventure lasting 20–40 minutes. A character survives
between quests, so a level-2 Ranger who finishes one quest can carry their gold, gear and XP into
the next.

The tone is classic heroic fantasy, much like an old boxed-set module read aloud at a kitchen
table: brave, a little wry, and never grim for its own sake. Content suits a general audience.
Combat is described in terms of hits, bruises and foes who are "defeated", "driven off" or
"collapse". There is no gore. Choices matter: clever talk, sneaking or a well-timed check can
skip a fight entirely, and quests have more than one ending.

---

## 2. Core rules (simplified d20)

### 2.1 Dice notation

The grammar covers every roll in the game, from player abilities to quest JSON. The game always
chooses which dice to roll. The player never types notation.

```
expr    := term (('+' | '-') term)*
term    := dice | integer
dice    := [count] 'd' sides [keep]
sides   := integer | '%'                 (d% = d100)
keep    := ('kh' | 'kl' | 'dh' | 'dl') integer
```

Examples: `d20`, `1d20+3`, `2d6+1d4-1`, `4d6dl1` (drop the lowest), `2d20kh1` (advantage),
`2d20kl1` (disadvantage), `d%`.

Advantage and disadvantage can also be passed as a roll option. The engine then rewrites the
first d20 term as `2d20kh1` or `2d20kl1`. If a roll has both, they cancel out, as in 5e.

Every roll returns a `RollResult` with the expression, each die's value (kept and dropped
marked), the modifiers and the total. Natural 1 and natural 20 are flagged on d20 rolls. The UI
always shows the breakdown, e.g. `2d20kh1+5 → [17, ~~4~~] + 5 = 22`.

Randomness comes from a **seeded PRNG** (mulberry32). Its state is stored in the game state, so
any game is reproducible from a seed and a list of actions. Tests use fixed seeds or scripted
dice.

### 2.2 Ability scores

- There are six scores: STR, DEX, CON, INT, WIS and CHA, ranging from 3 to 20.
- The modifier is `floor((score − 10) / 2)`.
- There are two generation methods:
  - **4d6 drop lowest**, rolled six times, with each roll's dice shown. Re-rolls are unlimited.
  - **Standard array**: 15, 14, 13, 12, 10, 8.
- Scores are auto-assigned by the class's priority order, and the player can swap any two.
- Point-buy is left out (see §8).

### 2.3 Proficiency, skills and checks

- The proficiency bonus is +2 at levels 1–4 and +3 at level 5.
- A **skill check** is `d20 + ability mod (+ proficiency if proficient)` against a DC. The DC
  tiers are Easy 10, Medium 13, Hard 16 and Very Hard 19.
- There are 15 skills:
  - **STR:** Athletics
  - **DEX:** Acrobatics, Stealth, Sleight of Hand
  - **INT:** Arcana, History, Investigation
  - **WIS:** Insight, Medicine, Perception, Survival
  - **CHA:** Deception, Intimidation, Performance, Persuasion
- Each class is proficient in a fixed set of skills. There is no skill picking in the MVP.
- A quest may also ask for a raw ability check, such as a plain STR check.
- Natural 20s and natural 1s have no automatic effect on skill checks, as in 5e. They are only
  highlighted in the UI.

### 2.4 Armour Class

- **No armour:** AC = 10 + DEX mod.
- **Light armour** (leather): 11 + DEX.
- **Medium armour** (scale): 14 + DEX (max +2).
- **Heavy armour** (chain mail): 16, with no DEX bonus.
- A shield adds +2.
- Conditions or spells can add temporary AC.

### 2.5 Initiative and turns

- Initiative is `d20 + DEX mod`. Ties go to the higher DEX, then to the player.
- On each turn the player gets **one Action** and **one Bonus Action**:
  - Actions: Attack, Cast, Use Item, Dodge, Flee, or a class ability marked as an action.
  - Bonus Actions: only for abilities marked `bonus`.
- **Reactions are left out** (see §8).
- There is no grid. Positioning is theatre-of-mind, and every combatant can target every other.
  Ranged attacks have no special rules in the MVP.

### 2.6 Attacks and damage

- An **attack roll** is `d20 + ability mod + proficiency` against the target's AC.
  - Melee uses STR. Finesse and ranged weapons use DEX. Spell attacks use the casting ability.
  - A natural 20 always hits and is a **critical**: double the number of damage dice, but not
    the modifiers.
  - A natural 1 always misses.
- **Damage** is the weapon or spell dice + ability mod for weapons, or the stated value for
  spells.
- Damage types (slashing, fire, radiant, etc.) are tracked. Enemies may list `resist` (half
  damage), `vulnerable` (double) or `immune`.
- **Saving throws** are `d20 + ability mod (+ proficiency if the class or monster is proficient)`
  against a DC.
  - A spell's save DC is `8 + proficiency + casting mod`.
  - Many effects deal half damage on a successful save.

### 2.7 Conditions (small fixed set)

| Condition | Effect |
|---|---|
| `hidden` | The bearer's next attack has advantage. Ends when they attack. |
| `restrained` | The bearer's attacks have disadvantage. Attacks against them have advantage. |
| `frightened` | Disadvantage on attacks. |
| `poisoned` | Disadvantage on attacks and ability checks. |
| `blessed` | +1d4 to attack rolls and saves. |
| `marked` | The marker deals +Xd6 to this target (Hunter's Mark). |
| `dodging` | Attacks against the bearer have disadvantage until their next turn. |
| `stunned` | The bearer loses their turn. |
| `wildshape` | The druid's beast form (§3). |
| `raging` | The barbarian's Rage: +2 damage on STR weapon hits, half damage from slashing, piercing and bludgeoning. |
| `reckless` | Advantage on the bearer's attacks, and attacks against the bearer have advantage, until their next turn. |
| `hexed` | The warlock deals +1d6 necrotic to this target on each hit (Hex). |

Every condition has a duration in rounds or `combat`, and is cleared when combat ends.
Concentration is left out (see §8). Instead, sustained spells end with the combat.

### 2.8 Spell slots and resources

- **Full casters** (Wizard, Cleric, Druid, Bard, Sorcerer) get **cantrips**, which can be cast at will,
  plus spell slots:

  | Level | 1st | 2nd | 3rd |
  |---|---|---|---|
  | 1 | 2 | – | – |
  | 2 | 3 | – | – |
  | 3 | 4 | 2 | – |
  | 4 | 4 | 3 | – |
  | 5 | 4 | 3 | 2 |

- **Half casters** (Paladin, Ranger) get slots at **level 1**, not level 2 as in 5e, so that
  they have something to spend straight away. **[FLAG]**

  | Level | 1st | 2nd |
  |---|---|---|
  | 1 | 1 | – |
  | 2 | 2 | – |
  | 3 | 3 | – |
  | 4 | 3 | – |
  | 5 | 4 | 2 |

- **Pact casters** (Warlock) get few slots, all of the highest slot level they can cast, and they
  return on a **short rest**: 1× 1st at L1, 2× 1st at L2, 2× 2nd at L3 and L4, 2× 3rd at L5.
  A spell cast from a pact slot is upcast to that slot's level.

- **Martial classes** (Fighter, Rogue, Barbarian, Monk) have no slots. They use **per-rest ability uses**
  instead, shown in the same "Magic" area of the UI as "Resources".
- A spell is cast from a slot of its level or higher. Upcasting does add the spell's
  `upcast` dice when a higher slot is used. This is cheap to implement because it is data-driven.
- Spells are a fixed list per class and level. There is no preparation or spellbook management.

### 2.9 Resting

- **Short rest**: allowed anywhere outside combat, **at most two between long rests**.
  - The player may spend Hit Dice: roll `1d<hitdie> + CON mod` for each die spent.
  - Restores short-rest abilities.
  - The Wizard's *Arcane Recovery* restores one 1st-level slot once per long rest.
  - The Warlock's pact slots all return.
- **Long rest**: only in scenes that the quest marks `rest: "long"`, such as an inn or a safe
  camp. Restores full HP, all slots and all abilities, plus half of your maximum Hit Dice.

### 2.10 Levelling (1–5)

| Level | XP needed |
|---|---|
| 2 | 300 |
| 3 | 900 |
| 4 | 2,700 |
| 5 | 6,500 |

- These are the 5e thresholds. One full quest is worth about 900–1,100 XP, which takes a new
  character to level 3.
- **Solo-hero rule** (added during Phase 2 balancing): level-1 max HP is `2 × hit-die max + CON mod`.
  A lone level-1 d20 hero is too fragile against groups. Balance simulations showed that the
  alternative, weakening every enemy, made fights trivial.
- **HP gain** per level is fixed, not rolled: `hitdie/2 + 1 + CON mod`, minimum 1.
- New slots and abilities follow the class tables.
- At level 4 the character gets an **Ability Score Improvement**: +2 to one score or +1 to two,
  with a maximum of 20.
- Proficiency rises to +3 at level 5.
- Levelling up opens a modal after the triggering action resolves. It is never shown mid-combat.

### 2.11 Death and defeat

- Combat is single-hero, so there are no death saves. **When HP drops to 0, the hero is defeated.**
- If the encounter defines `onDefeat`, the hero wakes in that scene with 1 HP. For example, they
  might be "captured by the goblins".
- Otherwise the hero **dies**. The death screen offers:
  - **Retry from checkpoint**: restore the snapshot taken when the current scene was entered.
  - **Return to title**: the slot keeps the fallen hero, marked as dead.
- **[FLAG]** Checkpoint retry is my choice, to keep a 30-minute quest from feeling punishing.
  The alternative is permadeath.

---

## 3. Classes

Each class section below lists its level-1 slots, or resources for martial classes. HP at level 1
is **2 × the hit die's maximum + CON mod** (the solo-hero rule, see §2.10). AC is calculated from the
starting gear.

| Class | Role | Primary | Hit die | Saves | Skills (proficient) |
|---|---|---|---|---|---|
| Fighter | Tough front-liner, steady damage | STR, CON | d10 | STR, CON | Athletics, Intimidation, Perception |
| Rogue | Burst damage, stealth, skills | DEX, INT | d8 | DEX, INT | Stealth*, Sleight of Hand*, Acrobatics, Investigation, Deception |
| Paladin | Holy knight, smites and heals | STR, CHA | d10 | WIS, CHA | Athletics, Persuasion, Insight |
| Bard | Talker, debuffs, healing | CHA, DEX | d8 | DEX, CHA | Performance, Persuasion, Deception, Insight, History |
| Druid | Nature caster, control, shapeshift | WIS, CON | d8 | INT, WIS | Survival, Medicine, Perception, Arcana |
| Wizard | Glass cannon, area damage | INT, DEX | d6 | INT, WIS | Arcana, History, Investigation |
| Cleric | Healer, radiant damage, undead-breaker | WIS, STR | d8 | WIS, CHA | Medicine, Insight, Persuasion, History |
| Ranger | Archer, tracker | DEX, WIS | d10 | STR, DEX | Survival, Perception, Stealth, Athletics |
| Barbarian | Raging brute, shrugs off blows | STR, CON | d12 | STR, CON | Athletics, Intimidation, Survival, Perception |
| Monk | Martial artist, flurries of blows | DEX, WIS | d8 | STR, DEX | Acrobatics, Stealth, Insight, Athletics |
| Sorcerer | Wild innate magic, raw power | CHA, DEX | d6 | CON, CHA | Arcana, Deception, Intimidation, Persuasion |
| Warlock | Pact caster, eldritch blasts and curses | CHA, DEX | d8 | WIS, CHA | Arcana, Deception, Intimidation, Investigation |

\* Expertise: double proficiency.

### Fighter

- **Level-1 resources:** Second Wind ×1 and Action Surge ×1, both per short rest.
- **Starting kit:** chain mail, shield (AC 18), longsword, 2× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Longsword | Action | `1d20+STR+prof` to hit, `1d8+STR` slashing |
| Second Wind | Bonus, 1/short rest | Heal `1d10+level` |
| Action Surge | Free, 1/short rest | Take one extra Action this turn |
| Extra Attack (L5) | Passive | The Attack action makes two attacks |

### Rogue

- **Level-1 resources:** Cunning Action (at will). Sneak Attack is a passive.
- **Starting kit:** leather armour (AC 11+DEX), shortsword, shortbow, thieves' tools,
  1× Potion of Healing, 15 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Shortsword / Shortbow | Action | `1d20+DEX+prof` to hit, `1d6+DEX` |
| Sneak Attack | Passive, once per turn | +`Nd6` (N = ceil(level/2)) when attacking with advantage, or in round 1 if you act before the target |
| Cunning Action: Hide | Bonus | Stealth check `1d20+DEX+2×prof` against the highest enemy passive Perception. On success, gain `hidden` |
| Uncanny Dodge (L5) | Passive, 1/round | Halve the first hit you take each round (automatic, because there are no reactions) |

### Paladin

- **Level-1 slots:** 1× 1st. **Resources:** Lay on Hands pool (5 × level HP, per long rest).
- **Starting kit:** chain mail, shield (AC 18), longsword, holy symbol, 1× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Longsword | Action | `1d20+STR+prof` to hit, `1d8+STR` |
| Divine Smite | On hit, uses a slot | +`2d8` radiant, +`1d8` per slot level above 1st, +`1d8` against undead or fiends |
| Lay on Hands | Action | Spend any number of HP from the pool to heal |
| Bless (1st) | Action, uses a slot | Gain `blessed` (+`1d4` to attacks and saves) for the combat |

### Bard

- **Level-1 slots:** 2× 1st. **Resources:** Bardic Inspiration ×(CHA mod, minimum 1) per long rest.
- **Starting kit:** leather armour (AC 11+DEX), rapier, lute, 1× Potion of Healing, 15 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Vicious Mockery (cantrip) | Action | WIS save. On failure, `1d4` psychic and disadvantage on the target's next attack. The damage scales to `2d4` at L5 |
| Healing Word (1st) | Bonus, uses a slot | Heal `1d4+CHA` (+`1d4` per upcast level) |
| Dissonant Whispers (1st) | Action, uses a slot | WIS save. `3d6` psychic, or half on success. On failure, the target is also `frightened` for 1 round |
| Bardic Inspiration | Free, after seeing a d20 roll | Add `1d6` to one of your own d20 rolls. **[FLAG]** In 5e it can't target yourself; in a solo game it has to |

### Druid

- **Level-1 slots:** 2× 1st. **Resources:** Wild Shape ×1 per short rest, from L2.
- **Starting kit:** leather armour and wooden shield (AC 13+DEX), quarterstaff, herbalism kit,
  1× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Produce Flame (cantrip) | Action | Spell attack `1d20+WIS+prof`, `1d8` fire (`2d8` at L5) |
| Cure Wounds (1st) | Action, uses a slot | Heal `1d8+WIS` (+`1d8` per upcast level) |
| Entangle (1st) | Action, uses a slot | Every enemy makes a STR save. On failure, `restrained` for 2 rounds |
| Wild Shape: Wolf (L2) | Action, 1/short rest | Gain 11 temporary "beast HP". Bite: `1d20+4` to hit, `2d4+2` piercing. Ends when the beast HP runs out or combat ends |

### Wizard

- **Level-1 slots:** 2× 1st. **Resources:** Arcane Recovery ×1 per long rest.
- **Starting kit:** robes (AC 10+DEX), quarterstaff, spellbook, arcane focus,
  2× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Fire Bolt (cantrip) | Action | Spell attack `1d20+INT+prof`, `1d10` fire (`2d10` at L5) |
| Magic Missile (1st) | Action, uses a slot | Three darts that always hit, each `1d4+1` force. One extra dart per upcast level |
| Burning Hands (1st) | Action, uses a slot | Every enemy makes a DEX save. `3d6` fire, or half on success |
| Fireball (3rd, L5) | Action, uses a slot | Every enemy makes a DEX save. `8d6` fire, or half on success |

### Cleric

- **Level-1 slots:** 2× 1st. **Resources:** Channel Divinity ×1 per short rest, from L2.
- **Starting kit:** scale mail and shield (AC 16 with up to +2 DEX), mace, holy symbol,
  1× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Sacred Flame (cantrip) | Action | DEX save. On failure, `1d8` radiant (`2d8` at L5) |
| Cure Wounds (1st) | Action, uses a slot | Heal `1d8+WIS` (+`1d8` per upcast level) |
| Guiding Bolt (1st) | Action, uses a slot | Spell attack, `4d6` radiant. Your next attack against the target has advantage |
| Turn Undead (L2) | Action, Channel Divinity | Every undead makes a WIS save. On failure, `frightened` and `stunned` for 2 rounds |

### Ranger

- **Level-1 slots:** 1× 1st.
- **Starting kit:** leather armour (AC 11+DEX), longbow, 2× shortsword, explorer's pack,
  1× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Longbow | Action | `1d20+DEX+prof` to hit, `1d8+DEX` piercing |
| Hunter's Mark (1st) | Bonus, uses a slot | `marked`: +`1d6` damage on each of your hits against that target for the combat. Can be moved as a bonus action when the target falls |
| Cure Wounds (1st) | Action, uses a slot | Heal `1d8+WIS` |
| Natural Explorer | Passive | Advantage on Survival checks. Extra Attack at L5 |

### Barbarian

- **Level-1 resources:** Rage ×2 per long rest. **Unarmoured Defence:** AC 10 + DEX + CON with no armour.
- **Starting kit:** greataxe, explorer's pack, 1× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Greataxe | Action | `1d20+STR+prof` to hit, `1d12+STR` slashing |
| Rage | Bonus, uses Rage | Gain `raging` for the combat: +2 damage on STR weapon hits, half damage from slashing, piercing and bludgeoning |
| Reckless Attack | Free | Gain `reckless`: advantage on your attacks, and enemies have advantage against you, until your next turn |
| Extra Attack (L5) | Passive | The Attack action makes two attacks |

### Monk

- **Resources:** Ki points = level per short rest, from L2. **Unarmoured Defence:** AC 10 + DEX + WIS with no armour.
- **Starting kit:** shortsword, explorer's pack, 2× Potion of Healing, 5 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Shortsword | Action | `1d20+DEX+prof` to hit, `1d6+DEX` piercing |
| Martial Arts | Bonus, after the Attack action | One unarmed strike: `1d20+DEX+prof` to hit, `1d4+DEX` bludgeoning (`1d6` at L5) |
| Flurry of Blows (L2) | Bonus, 1 ki, after the Attack action | Two unarmed strikes |
| Patient Defense (L2) | Bonus, 1 ki | Gain `dodging` until your next turn |
| Extra Attack (L5) | Passive | The Attack action makes two attacks |

### Sorcerer

- **Level-1 slots:** 2× 1st. **Resources:** Sorcery Points = level per long rest, from L2.
- **Starting kit:** robes (AC 10+DEX), dagger, arcane focus, 2× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Shocking Grasp (cantrip) | Action | Spell attack `1d20+CHA+prof`, `1d8` lightning (`2d8` at L5) |
| Chaos Bolt (1st) | Action, uses a slot | Spell attack, `2d8+1d6` (+`1d6` per upcast level). The first d8 picks the damage type. If both d8s match, the bolt leaps to an enemy it has not hit yet |
| Thunderwave (1st) | Action, uses a slot | Every enemy makes a CON save. `2d8` thunder, or half on success |
| Font of Magic (L2) | Bonus, 2 sorcery points | Regain one spent 1st-level slot |
| Scorching Ray (2nd, L3) | Action, uses a slot | Three rays, each a spell attack for `2d6` fire. One extra ray per upcast level |

### Warlock

- **Level-1 slots:** 1× pact slot (see §2.8), back on a short rest.
- **Starting kit:** leather armour (AC 11+DEX), dagger, pact token, 2× Potion of Healing, 10 gp.

| Ability | Type | Dice / effect |
|---|---|---|
| Eldritch Blast (cantrip) | Action | Spell attack `1d20+CHA+prof`, `1d10` force. Two beams at L5 |
| Hex (1st) | Bonus, uses a slot | `hexed`: +`1d6` necrotic on each of your hits against that target for the combat |
| Arms of Hadar (1st) | Action, uses a slot | Every enemy makes a STR save. `2d6` necrotic (+`1d6` per upcast level), or half on success |
| Dark One's Blessing | Passive | When you drop an enemy to 0 HP, regain CHA mod + level HP |
| Agonizing Blast (L2) | Passive | Add CHA mod to Eldritch Blast damage |

**Class data** lives in `src/content/classes.ts`. It is plain typed data: stats, kit, a
level-progression table and ability IDs. Each ability is an `AbilityDef` record: targeting,
cost, roll expressions and an effect list. These are interpreted by the rules engine (§6), so
adding a class means adding data, and code is only needed for a genuinely new effect type.

---

## 4. Quest content model

### 4.1 Layout and discovery

```
quests/
  hollowmere-bell/
    quest.json
    assets/  (SVG/PNG/WebP scene art, optional)
  template-cellar-rats/
    quest.json
```

- The engine discovers quests at build time with Vite's `import.meta.glob('/quests/*/quest.json')`.
- Asset files are picked up with `import.meta.glob('/quests/*/assets/*', { query: '?url' })`.
- **To add a quest, drop in a folder and rebuild.** There is no manifest or registry to edit, and
  no engine change.
- Quests are code-split, so each `quest.json` loads only when the player picks it.
- **Static hosting can't list directories at runtime**, which is why discovery happens at build
  time. The trade-off is that a new quest needs a rebuild, and CI does that on push.

### 4.2 Top-level schema

```jsonc
{
  "schemaVersion": 1,
  "id": "hollowmere-bell",              // unique, kebab-case, equals folder name
  "version": "1.0.0",                   // quest content version (stored in saves)
  "title": "The Bell Beneath Hollowmere",
  "summary": "The village bell is gone, and the mist has come...",
  "author": "Dungeon",
  "recommendedLevel": 1,
  "estimatedMinutes": 30,
  "start": "village-green",             // scene id
  "flags": { "elderTrust": 0 },         // initial quest-local flags (number | boolean | string)
  "npcs":    { "<id>": NpcDef },
  "enemies": { "<id>": EnemyDef },
  "items":   { "<id>": ItemDef },       // quest-local items; global items are in src/content/items.ts
  "scenes":  { "<id>": Scene }
}
```

### 4.3 Scenes

Every scene shares these fields: `type`, `title`, `text` (Markdown-lite paragraphs with
`{{hero.name}}`, `{{hero.class}}` and `{{flag.x}}` interpolation), and optional `image`
(a path relative to the quest folder), `onEnter: Effect[]` and `rest: "short" | "long"`.

| `type` | Extra fields | Behaviour |
|---|---|---|
| `narration` | `choices: Choice[]` | Exploration: text plus choices |
| `dialogue` | `speaker: npcId`, `choices` | Shows the NPC's avatar and name. Choices often carry checks or requirements |
| `check` | `check: CheckDef`, `success: Outcome`, `failure: Outcome` | A forced check, such as a trap or a climb |
| `encounter` | `enemies: [{ "enemy": id, "count"?: n }]`, `boss?`, `surprise?: "hero"\|"enemies"`, `canFlee?` (default true), `fleeDC?` (default 12), `victory: Outcome`, `flee?: Outcome`, `defeat?: Outcome` | Combat. A missing `defeat` means death (§2.11) |
| `loot` | `gold?: dice`, `items?: [{ "item": id, "qty"?: n }]`, `next: Outcome` | Shows the loot card, then continues |
| `ending` | `outcome: "victory" \| "neutral" \| "defeat"`, `xp?: n`, `epilogue?` | Completes the quest and records it on the character |

```jsonc
// Choice
{ "text": "Persuade the goblin chief", "requires"?: Condition, "hideIfUnmet"?: false,
  "check"?: CheckDef, "success"?: Outcome, "failure"?: Outcome,   // when check present
  "goto"?: "scene-id", "effects"?: Effect[] }                     // when no check

// CheckDef
{ "skill": "persuasion" | "ability": "STR", "dc": 13,
  "advantageIf"?: Condition, "disadvantageIf"?: Condition }

// Outcome
{ "goto": "scene-id", "effects"?: Effect[], "text"?: "Shown before moving on." }
```

**Effects** (applied in order):

- `{ "setFlag": "k", "value": v }`
- `{ "addFlag": "k", "by": n }`
- `{ "gold": "2d6" | 10 }` (negative numbers spend gold)
- `{ "addItem": id, "qty"? }`, `{ "removeItem": id, "qty"? }`
- `{ "xp": n }`
- `{ "heal": dice }`
- `{ "damage": dice, "type"?, "save"?: { "ability": "DEX", "dc": 13, "half": true } }`
- `{ "condition": name, "rounds"? }`
- `{ "restoreSlots": true }`

**Conditions** (for `requires`, `advantageIf` and `disadvantageIf`):

- `{ "flag": "k", "eq"|"gte"|"lte": v }`
- `{ "hasItem": id }`
- `{ "class": ["rogue", "bard"] }`
- `{ "ability": "STR", "gte": 13 }`
- `{ "gold": { "gte": 10 } }`
- `{ "level": { "gte": 2 } }`
- Combinators: `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": {...} }`

A shop is just a dialogue: a choice that `requires: { gold: { gte: 25 } }` with effects
`[{gold:-25},{addItem:"potion-healing"}]`. **No shop engine in the MVP.**

**`EnemyDef`** example:

```jsonc
{ "name": "Goblin Sneak", "avatar": AvatarSpec?, "ac": 13, "hp": "2d6", "dex": 14,
  "saves": { "DEX": 4 }, "passivePerception": 9, "xp": 50,
  "resist"?: ["poison"], "vulnerable"?: [], "immune"?: [], "undead"?: false,
  "actions": [
    { "name": "Scimitar", "attack": 4, "damage": "1d6+2", "type": "slashing", "weight": 3 },
    { "name": "Hurl Pot", "save": { "ability": "DEX", "dc": 11, "half": true },
      "damage": "2d4", "type": "fire", "recharge": 3 }          // usable every 3 rounds
  ],
  "phases"?: [ { "belowHpPct": 50, "text": "The chief bellows!", "addActions": [...] } ],
  "morale"?: { "fleeBelowHpPct": 25 } }
```

- **`NpcDef`:** `{ "name", "avatar"?: AvatarSpec, "title"? }`.
- **`ItemDef`:** `{ "name", "kind": "weapon"|"armour"|"shield"|"consumable"|"treasure"|"key", "value"?: gp, ... }`.
  The fields after `kind` depend on the kind, e.g. `damage`, `ac`, `use: Effect[]`.

### 4.4 Validation

- `validateQuest(json)` in `src/engine/quest/validate.ts` is a hand-rolled, dependency-free
  structural validator. It returns `{ ok, quest, errors[], warnings[] }`.
- It checks:
  - Field types.
  - That every `goto`, `start`, `speaker`, enemy, item and `next` reference resolves.
  - That every dice expression parses.
  - That at least one `ending` exists and is reachable.
  - That every class and skill name is valid.
- It warns about scenes that can't be reached.
- It runs in three places:
  1. A unit test that loads **every** shipped quest, so CI fails on a broken quest.
  2. `npm run validate-quests` for authors. **[FLAG]** This is a small extra CLI.
  3. At runtime before a quest starts. Invalid quests appear greyed out in the list, with the
     errors in a details panel.

---

## 5. Save / load model

- **Where:** `localStorage`. A save is roughly 20–60 KB of JSON, which fits well within quota.
  Writes are synchronous, so they're simple and survive tab closes. Access goes through a
  `StorageAdapter` interface (`get`, `set`, `remove`, `keys`), with localStorage and in-memory
  implementations. IndexedDB can replace it later without touching callers.
- **Keys:** `dungeon:slot:<1..3>` holds one save per slot, and `dungeon:settings` holds settings.
  **3 slots.** **[FLAG]** on the number.
- **Envelope:**

  ```jsonc
  { "schemaVersion": 1, "appVersion": "0.1.0", "savedAt": "ISO-8601",
    "summary": { "name", "classId", "level", "questTitle", "sceneTitle", "status": "active"|"dead"|"idle" },
    "state": GameState,            // full engine state incl. RNG state, active quest, combat (if any)
    "checkpoint": GameState | null // snapshot at last scene entry (for retry-on-death)
  }
  ```

- **What is persisted:**
  - The character: abilities, HP, slots, resources, XP, level, gold, inventory, equipment,
    avatar and completed quests.
  - Quest progress: quest ID and version, current scene, flags and visited scenes.
  - Combat state, if the player saved mid-combat.
  - The RNG state.
  - The last 200 dice-log entries.
  - Static data is not persisted. Class data and quest JSON are referenced by ID.
- **When:** the store autosaves after every committed engine action (a choice, combat action,
  rest, equip or level-up). The write is skipped if the state hasn't changed. The checkpoint
  updates on each scene entry.
- **Versioning and migration:**
  - `migrations: Record<number, (old) => new>`, where each function upgrades version *n* to *n+1*.
  - Migrations run in sequence on load, and the save is rewritten after a successful migration.
  - A save from a newer version is refused, with the message "made by a newer version".
  - An unparseable save is moved to `dungeon:corrupt:<slot>:<ts>` and the slot is shown as empty
    with a warning, so data is never silently destroyed.
  - Each migration has unit tests with v*n* fixture files.
- **Quest drift:** a save records `questVersion`. If the saved scene no longer exists, the player
  is told and returned to the quest's `start` with the character kept.
- **Future export/import:** the envelope is already self-contained JSON. Export is a `Blob`
  download, and import is file input → the same `migrate` + `validateSave` pipeline. No model
  changes are needed.

---

## 6. Technical architecture

### 6.1 Stack and dependencies

| Dependency | Kind | Why |
|---|---|---|
| `preact` | runtime | About 4 KB gzipped. Components and JSX make the accessible, reactive screens far less code than hand-rolled DOM. |
| `vite`, `@preact/preset-vite` | dev | Fast dev server, TS/JSX transform, `import.meta.glob` for quest discovery, relative `base` for Pages. |
| `typescript` | dev | `strict: true`, `noUncheckedIndexedAccess`. |
| `vitest` | dev | Shares Vite's config and transforms, so there's no separate Jest/Babel setup. |
| `three` | runtime, lazy | Nice-to-have battle animations only. Loaded on demand (§8). |

That's the whole list. There is no router, because screens are state-driven and that avoids 404s
on Pages. There is no state library either, since a ~40-line store is enough (below). Linting
uses `tsc --noEmit` only; ESLint is optional and left out (see §8). There are no CSS frameworks:
plain CSS with custom properties, and no web fonts, since the system font stack keeps things
offline-safe.

### 6.2 Module boundaries

```
src/
  engine/          PURE. No DOM, no storage, no Date.now(), no Math.random().
    dice/          parser, roller, RollResult, seeded RNG
    rules/         modifiers, checks, saves, AC, levelling, rests
    character/     creation (roll/standard array, derive HP/AC/slots), name suggestions
    combat/        initiative, turn loop, action resolution, effects, enemy AI
    quest/         types, validate, condition eval, effect apply, scene runner
    state.ts       GameState type + step(state, action) → { state, events }
  content/         classes, abilities/spells, items, enemy archetypes, name tables (data only)
  avatar/          deterministic procedural SVG avatar generator (seed + options → SVG string)
  persistence/     StorageAdapter, save slots, envelope, migrations
  ui/              Preact: App, screens/*, components/*, store, hooks, styles
  fx/              (nice-to-have) animation layer subscribing to engine events
quests/            content (§4)
tests/             vitest specs + fixtures
```

- **Core rule:** `ui/` and `persistence/` depend on `engine/`, and `engine/` depends on nothing
  but `content/` types.
- The engine is a **pure reducer**: `step(state, action) → { state, events }`.
  - Actions are serializable, e.g. `{ type: "choose", index }`, `{ type: "attack", targetId }`,
    `{ type: "cast", abilityId, slotLevel, targetId }`, `{ type: "rest", kind }`.
  - All randomness comes from `state.rng`.
  - Events describe what happened for presentation: `roll`, `damage`, `narrate`, `levelUp`,
    `sceneEnter`, `combatEnd`.
- This makes the engine deterministic and replayable, and lets it run headless in Node. A future
  authoritative multiplayer server can import `engine/` unchanged and validate client actions
  against it. Enemy turns are resolved inside `step` when the player's turn ends, so a single
  action can produce a batch of events, which the UI then plays back in order.

### 6.3 State management

- `ui/store.ts` holds `{ game: GameState, ui: UiState }`.
  - `dispatch(action)` calls `step`, then appends events to a playback queue and notifies
    subscribers.
  - A persistence subscriber autosaves.
- Preact components read state through a `useStore(selector)` hook.
- `UiState` covers the current screen, open drawers, settings and the event playback cursor. It
  is ephemeral and never saved, apart from the settings.
- **Future audio and FX** subscribe to the same event stream: `roll` triggers a dice sound and
  `damage` triggers a hit sound. Nothing in the engine changes, and the mute toggle is just a
  setting.

### 6.4 Build and deploy

- `vite.config.ts` sets `base: './'` so every asset URL is relative. That works under
  `https://<user>.github.io/<repo>/` and at any other path.
- Scripts:
  - `npm run dev`
  - `npm run build` (`tsc --noEmit && vite build` → `dist/`)
  - `npm test` (vitest)
  - `npm run validate-quests`
  - `npm run preview`
- `.github/workflows/deploy.yml` runs on push to `main`, plus `workflow_dispatch`. The steps are
  checkout → setup-node (from `.nvmrc`) → `npm ci` → typecheck → test → build →
  `actions/upload-pages-artifact` → `actions/deploy-pages`.
- The workflow needs `pages: write` and `id-token: write` permissions. **One-time manual step:**
  set Settings → Pages → Source to *GitHub Actions*.
- A PR runs the same steps without the deploy.
- **Offline:** quests and assets are bundled, so there are no network calls after the first load
  and an open tab works offline. There is no service worker (decided: simplest option).

### 6.5 Avatars

`avatar/generate.ts(spec) → SVG string`. A spec looks like this:
`{ seed, skin, hair, hairColour, eyes, mouth, accessory, frame: classId | "npc" | "enemy",
creature?: "goblin"|"wolf"|"skeleton"|... }`.

- Shapes are layered from small built-in path sets. The same seed always gives the same avatar.
- Character creation suggests 6 avatars for the chosen class. The player can pick one, shuffle
  for more, or adjust individual features with selects.
- Enemy and NPC avatars use the same generator, so the nice-to-have only needs data.
- Avatars render as inline SVG with `role="img"` and an `aria-label`.

---

## 7. UI flow and wireframes

The layout is mobile-first, single-column below 720 px. Every control is a real `<button>`,
`<select>` or `<input>` with a visible focus style.

**Keyboard controls:**

- Choices and combat actions are numbered, and keys `1`–`9` select them.
- `C` opens the character sheet, `I` the inventory, `L` the log and `Esc` closes drawers.

**Screen-reader support:**

- New narration and roll results are announced through an `aria-live="polite"` region.
- Focus moves to the new scene heading on each scene change.
- HP and slot bars have text equivalents.

**Motion:** `prefers-reduced-motion` and a Settings toggle both disable motion.

1. **Title.**
   - Logo, then **Continue** (the most recently saved active slot; disabled if there is none),
     **New Game**, **Load Game**, **Settings**.
   - Footer: version and credits.
2. **Save slots.** Three cards showing avatar, name, class and level, quest and scene, the last
   saved time, and status. Each card has Load and Delete (Delete asks for confirmation). New Game
   picks an empty slot, or confirms an overwrite.
3. **Character creation.** A four-step wizard with a progress indicator; Back and Next are always
   available.
   1. *Class*: a grid of twelve class cards with icon, role and primary abilities. Selecting a
      card shows its details: hit die, starting HP/AC/slots, kit, and the ability table with dice.
   2. *Abilities*: a method toggle (4d6 drop lowest / standard array) and a **Re-roll** button.
      There are six rows, each showing the ability, score, modifier and dice (`[6, 5, 3, ~~1~~] = 14`),
      plus a "swap with…" select. The derived HP, AC, slots and save DC update live alongside.
   3. *Identity*: the suggested name (from class-flavoured tables) with a "Suggest another" button and an editable text field. Below it, an avatar grid of 6 suggestions with
      Shuffle and Customise.
   4. *Review*: the character-sheet summary, then **Begin**.
4. **Quest select.** A list of quests showing title, summary, recommended level, duration and a
   completed badge. Invalid quests are disabled and show their errors. Choosing one starts it.
5. **Adventure (DM screen).**
   - *Top bar*: avatar, name, level, HP bar, slot pips or resources, gold.
   - *Main panel*: scene title, optional art, narration. NPC dialogue shows the speaker's avatar
     beside the text.
   - *Below that*: numbered choice buttons. Unmet `requires` choices are shown disabled with the
     reason, unless the scene hides them.
   - A check result appears as an inline "roll card" before the outcome text.
   - *Desktop side panel / mobile bottom tabs*: Character, Inventory (use or equip), Log (every
     roll with its breakdown). The game always picks the dice. There is no free-form roller.
   - *Rest button*: short rest (when allowed) and long rest (only at rest scenes).
6. **Combat.**
   - *Top*: the initiative strip, with the current turn highlighted.
   - *Middle*: enemy cards showing avatar, name, an HP bar with a descriptor ("Wounded"),
     conditions, and a target button.
   - *Bottom*: hero status and the action bar: Attack · Abilities/Spells (a menu showing cost and
     dice, with a slot-level picker for upcasting) · Items · Dodge · Flee (if allowed) · End Turn.
     Bonus-action abilities are shown separately.
   - *Combat log*: each roll with its breakdown and hit/miss/crit. Enemy turns play back one event
     at a time, and there's a "skip" option.
7. **Level-up modal.** What changed (HP, slots, new abilities), the ASI picker at level 4, then
   Confirm.
8. **Death screen.** Epitaph text, then **Retry from checkpoint** or **Return to title**.
9. **Ending screen.** Outcome banner (victory/neutral/defeat), epilogue, XP and gold earned, and
   quest stats. Then **Choose another quest** (the same hero continues) or **Title**.
10. **Settings.** Animations on/off, roll playback speed, and reset all data (with confirmation).

---

## 8. Backlog

### MVP (Phase 2, in build order)

1. Project scaffold, strict TS, Vite, Vitest, CI workflow, Pages deploy.
2. Dice engine and seeded RNG, with tests.
3. Rules and character creation: classes data, ability generation, derived stats, name tables.
4. Procedural avatar generator for player characters.
5. Quest types, validator, condition/effect evaluation and scene runner, with tests (including
   the all-quests reference test).
6. Combat engine: initiative, actions, abilities/spells, slots, conditions, enemy AI
   (weighted-random actions + recharge + morale + boss phases), flee. Tests.
7. Rests, levelling 1–5, death/checkpoint, quest completion.
8. Persistence: slots, envelope, autosave, migrations. Tests with a v0→v1 fixture to prove the
   pipeline works.
9. UI screens from §7, responsive, keyboard and ARIA.
10. Content: *The Bell Beneath Hollowmere* (full quest) and *Rats in the Cellar* (template quest).
11. README and `docs/QUESTS.md`.

**Example quest outline.** *The Bell Beneath Hollowmere* takes about 30 minutes and is worth
about 1,000 XP. The silver bell that keeps the marsh-mist away from Hollowmere has been stolen.

- **Village green** (dialogue with the elder, who offers a reward). A **shop** dialogue sells
  potions. The **inn** is a long-rest site.
- **Marsh road** (exploration). A Survival **check** finds a shortcut; failing it means sinking
  mud damage.
- **Wolves** (combat 1). Alternatively, a Druid or Ranger can calm them, or the hero can throw
  them food from the inventory.
- **Abandoned chapel** (Investigation check and **loot**). A clue reveals the thief: a goblin band
  serving a "Mire King".
- **Goblin lookout** (dialogue). The hero can bluff, sneak or fight (combat 2).
- **Flooded crypt** (skeletons, combat 3, optional). Holds better loot.
- **Boss: Grubnak, the Mire King** (a goblin chieftain with a swamp-troll bodyguard, two phases).
  A high Persuasion or Intimidation check, or a found item, opens a parley.
- **Endings:**
  - Return the bell (victory).
  - Broker peace, so the goblins return the bell and leave (victory, with more XP for parley).
  - Sell the bell to a passing merchant (neutral).
  - Defeat: captured and thrown out of the marsh, a non-lethal `defeat` scene.

**Template quest.** *Rats in the Cellar* has about 5 scenes: dialogue → check → combat → loot →
two endings. It is heavily commented in `docs/QUESTS.md`.

### Nice-to-have (only after the MVP is done and tested)

- **Enemy and NPC avatars.** The generator gets creature parts, and the quest JSON already
  supports `avatar`.
- **Battle animations with Three.js** (decided):
  - A WebGL canvas behind the combat panel shows tumbling 3D dice, hit flashes and particle
    bursts for spells.
  - `three` is loaded with dynamic `import()` only when combat starts and animations are on,
    so it never adds weight to the initial bundle.
  - The `fx/` layer only listens to engine events. If WebGL is unavailable, animations are off
    in Settings, or `prefers-reduced-motion` is set, the layer doesn't load and the game is
    fully playable.
- JSON Schema file for quest authoring autocomplete in editors.
- ESLint with an a11y plugin, plus Playwright smoke tests.

### Future work (designed for, not built)

- **Save export/import:** the self-contained envelope plus the existing migrate pipeline (§5).
- **Music and SFX with mute:** subscribers to engine events, and a settings flag (§6.3).
- **Multiplayer:** the pure, deterministic `engine/` with serializable actions and seeded RNG can
  run on an authoritative server. The UI would dispatch to a remote store instead of the local
  one (§6.2).

### Deliberately left out of the MVP, and why

| Left out | Why |
|---|---|
| Races/species, backgrounds, alignment, feats, multiclassing | The brief asks for classes only. Each multiplies balancing and UI work. **[FLAG]** Races are iconic to D&D. Easy to add later as data |
| Point-buy | The brief asks for dice and the standard array |
| Grid, positioning, ranges, reactions, opportunity attacks | Theatre-of-mind keeps the UI simple and mobile-friendly. Reactions need interrupt prompts |
| Concentration, spell preparation, spellbooks, rituals | Bookkeeping that adds little to a 30-minute solo quest |
| Companions or parties | Single-player, single-hero per the brief. The engine's combatant model allows more than one ally later |
| Encumbrance, item weight, item durability, crafting | Bookkeeping |
| Shop engine | Dialogue choices with gold costs cover it |
| Levels 6–20 | Agreed scope (1–5) |
| Death saves | Pointless with a lone hero. Replaced by defeat outcomes and checkpoints |
| Runtime loading of user-supplied quest files | Needs a file picker and untrusted-content handling. Quests are added at build time |

---

## Decisions (approved 2026-11-02)

- Accepted as proposed: half-casters get slots at level 1, Bardic Inspiration can target
  yourself, checkpoint retry on death, 3 save slots, the `validate-quests` CLI, races left out.
- No free dice tray. The game always chooses the dice.
- Battle animations use Three.js, lazy-loaded with graceful fallback.
- Offline: no service worker.
