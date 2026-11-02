import type { GameEvent, GameState } from '../engine/model';

/**
 * The engine state is final the moment an action resolves, but the UI must only
 * show what playback has REVEALED. This rewinds visible health (and life/death)
 * by the still-unrevealed damage/heal events so enemy cards and the status bar
 * never spoil the roll the player is about to click.
 */
export function displayState(game: GameState, queue: GameEvent[], cursor: number): GameState {
  if (cursor >= queue.length) return game;
  // shallow-copy only what we mutate — structuredClone can choke on the rng object
  const s = {
    ...game,
    hero: game.hero ? { ...game.hero } : game.hero,
    combat: game.combat
      ? { ...game.combat, enemies: game.combat.enemies.map((e) => ({ ...e })) }
      : game.combat,
  };
  const hero = s.hero;
  const combat = s.combat;
  for (const ev of queue.slice(cursor)) {
    if (ev.type === 'damage') {
      if (ev.target === 'hero' && hero) hero.hp = Math.min(hero.maxHp, hero.hp + ev.amount);
      else if (ev.target === 'hero-beast' && combat) combat.beastHp = Math.min(11, combat.beastHp + ev.amount);
      else {
        const e = combat?.enemies.find((x) => x.id === ev.target);
        if (e) e.hp = Math.min(e.maxHp, e.hp + ev.amount);
      }
    } else if (ev.type === 'heal' && ev.target === 'hero' && hero) {
      hero.hp = Math.max(0, hero.hp - ev.amount);
    }
  }
  if (combat) {
    for (const e of combat.enemies) if (!e.fled) e.dead = e.hp === 0;
    if (hero && hero.hp > 0) hero.dead = false;
  }
  return s;
}

/** True when every event has been revealed and no manual roll is pending —
 *  result banners, death and ending transitions wait for this. */
export function playbackSettled(queue: GameEvent[], cursor: number, pending: GameEvent | null): boolean {
  return pending === null && cursor >= queue.length;
}
