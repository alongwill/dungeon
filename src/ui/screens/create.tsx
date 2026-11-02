import { useMemo, useState } from 'preact/hooks';
import { Avatar } from '../../avatar/Avatar';
import { AbilityLabel } from '../abilityInfo';
import { randomAvatar, suggestAvatars } from '../../avatar/generate';
import { ACCESSORIES, EYES, HAIR_COLOURS, HAIR_STYLES, MOUTHS, SKINS } from '../../avatar/parts';
import { CLASSES, CLASS_IDS } from '../../content/classes';
import { suggestName } from '../../content/names';
import { rngFromSeed } from '../../engine/dice';
import {
  assignByPriority, createHero, deriveStats, rollAbilityScores, STANDARD_ARRAY, swapAbilities,
} from '../../engine/character';
import { abilityMod, ABILITY_IDS } from '../../engine/rules';
import type { AbilityId, AvatarSpec, ClassId } from '../../engine/quest/types';
import { classInfoLines } from '../format';
import { gotoScreen, newGame } from '../store';
import { getPendingSlot } from './meta';

export function CreateScreen() {
  const [stepIx, setStepIx] = useState(0);
  const [classId, setClassId] = useState<ClassId>('fighter');
  const [method, setMethod] = useState<'roll' | 'array'>('roll');
  const [seed, setSeed] = useState(() => Date.now() & 0xffff);
  const [rolls, setRolls] = useState(() => rollAbilityScores(rngFromSeed(seed)).rolls);
  const [abilities, setAbilities] = useState(() => assignByPriority(STANDARD_ARRAY, classId));
  const [name, setName] = useState(() => suggestName('fighter', rngFromSeed(1)).name);
  const [avatar, setAvatar] = useState<AvatarSpec>(() => randomAvatar('fighter', rngFromSeed(5)).spec);
  const [sugSeed, setSugSeed] = useState(11);

  const cls = CLASSES[classId];
  const previewHero = useMemo(
    () => createHero({ classId, name: name || 'Hero', abilities, avatar }),
    [classId, name, abilities, avatar],
  );
  const stats = deriveStats(classId, abilities, 1);
  const suggestions = useMemo(() => suggestAvatars(classId, rngFromSeed(sugSeed)).specs, [classId, sugSeed]);

  const pickClass = (c: ClassId) => {
    setClassId(c);
    setAbilities(assignByPriority(method === 'roll' ? rolls.map((r) => r.total) : STANDARD_ARRAY, c));
    setName(suggestName(c, rngFromSeed(Date.now() & 0xffff)).name);
    setAvatar(randomAvatar(c, rngFromSeed(Date.now() & 0xffff)).spec);
  };
  const reroll = () => {
    const s = (Date.now() & 0xffffff) + rolls.length;
    setSeed(s);
    const r = rollAbilityScores(rngFromSeed(s)).rolls;
    setRolls(r);
    if (method === 'roll') setAbilities(assignByPriority(r.map((x) => x.total), classId));
  };
  const setMethodM = (m: 'roll' | 'array') => {
    setMethod(m);
    setAbilities(assignByPriority(m === 'roll' ? rolls.map((r) => r.total) : STANDARD_ARRAY, classId));
  };

  const steps = ['Class', 'Abilities', 'Identity', 'Review'];
  return (
    <main class="screen create">
      <h2>Create your hero</h2>
      <ol class="wizard-progress" aria-label="progress">
        {steps.map((t, i) => <li key={t} class={i === stepIx ? 'current' : ''}>{t}</li>)}
      </ol>

      {stepIx === 0 && (
        <section>
          <div class="class-grid">
            {CLASS_IDS.map((c) => (
              <button key={c} class={`class-card ${c === classId ? 'selected' : ''}`} onClick={() => pickClass(c)}>
                <strong>{CLASSES[c].name}</strong>
                <span class="dim">{CLASSES[c].role}</span>
              </button>
            ))}
          </div>
          <div class="card">
            <p>Hit die d{cls.hitDie} · Health {stats.maxHp} · Armour {stats.ac}{stats.slots.length ? ` · Spell slots ${stats.slots.join('/')}` : ''}</p>
            <p class="dim">Kit: {cls.kit.items.map((k) => k.item.replace(/-/g, ' ') + (k.qty ? ` ×${k.qty}` : '')).join(', ')} · {cls.kit.gold} gp</p>
            <h4>Abilities</h4>
            <ul class="ability-list">
              {classInfoLines(classId, previewHero).map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        </section>
      )}

      {stepIx === 1 && (
        <section>
          <div class="row">
            <button class={method === 'roll' ? 'selected' : ''} onClick={() => setMethodM('roll')}>4d6 drop lowest</button>
            <button class={method === 'array' ? 'selected' : ''} onClick={() => setMethodM('array')}>Standard array</button>
            {method === 'roll' && <button onClick={reroll}>Re-roll</button>}
          </div>
          <table class="abilities">
            <tbody>
              {ABILITY_IDS.map((ab, i) => (
                <tr key={ab}>
                  <th scope="row"><AbilityLabel id={ab} /></th>
                  <td>{abilities[ab]}</td>
                  <td class="dim">({abilityMod(abilities[ab]) >= 0 ? '+' : ''}{abilityMod(abilities[ab])})</td>
                  <td class="dice">
                    {method === 'roll' && rolls[i]!.rolls.map((d, j) => (
                      <span key={j} class={d.kept ? 'die' : 'die dropped'}>{d.value}</span>
                    ))}
                  </td>
                  <td>
                    <select aria-label={`swap ${ab} with`} value=""
                      onChange={(e) => {
                        const other = e.currentTarget.value as AbilityId;
                        if (other) setAbilities(swapAbilities(abilities, ab, other));
                      }}>
                      <option value="">swap…</option>
                      {ABILITY_IDS.filter((x) => x !== ab).map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="card">
            <svg class="stat-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-8-5.5-10-10.5C.7 6 3 3 6.5 3 9 3 11 5 12 6.5 13 5 15 3 17.5 3 21 3 23.3 6 22 10.5 20 15.5 12 21 12 21z"/></svg> Health {stats.maxHp} ·
            <svg class="stat-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 9.6-8 11-4.6-1.4-8-6-8-11V5z"/></svg> Armour {stats.ac} ·
            {stats.slots.length ? <><svg class="stat-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM19 15l.9 2.6 2.1.7-2.1.7L19 21l-.9-2.6-2.1-.7 2.1-.7z"/></svg> Spell slots {stats.slots.join('/')}</> : 'no spell slots'} · Spell difficulty {stats.saveDC || '—'}
          </p>
        </section>
      )}

      {stepIx === 2 && (
        <section>
          <label class="row">Name
            <input value={name} onInput={(e) => setName(e.currentTarget.value)} />
            <button onClick={() => setName(suggestName(classId, rngFromSeed(Date.now() & 0xffff)).name)}>
              Suggest another
            </button>
          </label>
          <h4>Avatar</h4>
          <div class="avatar-grid">
            {suggestions.map((sp, i) => (
              <button key={i} class={`avatar-pick ${avatar === sp ? 'selected' : ''}`}
                aria-pressed={avatar === sp}
                onClick={() => setAvatar({ ...sp, frame: classId })}>
                <Avatar spec={sp} size={76} label={`avatar option ${i + 1}`} />
              </button>
            ))}
          </div>
          <div class="row">
            <button onClick={() => setSugSeed((x) => x + 1)}>Shuffle</button>
          </div>
          <div class="customise">
            {([
              ['skin', 'Skin', Object.keys(SKINS)], ['hair', 'Hair', HAIR_STYLES],
              ['hairColour', 'Hair colour', Object.keys(HAIR_COLOURS)],
              ['eyes', 'Eyes', EYES], ['mouth', 'Mouth', MOUTHS], ['accessory', 'Accessory', ACCESSORIES],
            ] as const).map(([field, label, opts]) => (
              <label key={field} htmlFor={`av-${field}`}>{label}
                <select id={`av-${field}`} value={avatar[field] ?? ''}
                  onChange={(e) => setAvatar({ ...avatar, [field]: e.currentTarget.value })}>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {stepIx === 3 && (
        <section class="card">
          <div class="row"><Avatar spec={avatar} size={80} label="your hero" />
            <div><h3>{name}</h3><p>{cls.name} · Health {stats.maxHp} · Armour {stats.ac} · {cls.kit.gold} gp</p></div>
          </div>
          <ul>{ABILITY_IDS.map((ab) => <li key={ab}><AbilityLabel id={ab} /> {abilities[ab]}</li>)}</ul>
        </section>
      )}

      <div class="row nav">
        <button onClick={() => (stepIx === 0 ? gotoScreen('slots') : setStepIx(stepIx - 1))}>Back</button>
        {stepIx < 3 ? (
          <button class="primary" onClick={() => setStepIx(stepIx + 1)}>Next</button>
        ) : (
          <button class="primary" onClick={() => void newGame(previewHero, getPendingSlot())}>Begin</button>
        )}
      </div>
    </main>
  );
}
