import * as THREE from 'three';
import type { FxHandle } from './index';

interface Active { t0: number; dur: number; obj: THREE.Object3D; tick: (k: number, obj: THREE.Object3D) => void }

const DAMAGE_COLOURS: Record<string, number> = {
  fire: 0xff7a2a, radiant: 0xffd94a, psychic: 0xa86af0, force: 0x5a9af0,
  cold: 0x9ad8f0, poison: 0x7ac04a, lightning: 0xf0e05a,
};
const burstColour = (t?: string) => DAMAGE_COLOURS[t ?? ''] ?? 0xe8e0d0;

export async function createFx(container: HTMLElement): Promise<FxHandle> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  if (getComputedStyle(container).position === 'static')
    container.style.position = 'relative';

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, w, 0, h, -200, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d0, 1.6);
  key.position.set(-0.4, -0.8, 1);
  scene.add(key);
  const center = (r?: DOMRect) => r
    ? { x: r.left - container.getBoundingClientRect().left + r.width / 2,
        y: r.top - container.getBoundingClientRect().top + r.height / 2 }
    : { x: w / 2, y: h / 2 };

  const active: Active[] = [];
  let raf = 0;
  const clock = { getElapsedTime: () => performance.now() / 1000 };
  const loop = () => {
    const now = clock.getElapsedTime() * 1000;
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i]!;
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.tick(k, a.obj);
      if (k >= 1) { scene.remove(a.obj); disposeObj(a.obj); active.splice(i, 1); }
    }
    renderer.render(scene, cam);
    raf = active.length ? requestAnimationFrame(loop) : 0;
  };
  const add = (dur: number, obj: THREE.Object3D, tick: Active['tick']) => {
    scene.add(obj);
    active.push({ t0: clock.getElapsedTime() * 1000, dur, obj, tick });
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const disposeObj = (o: THREE.Object3D) =>
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });

  /** A lit, flat-shaded d20 with gold edges that tumbles in an arc and settles. */
  const die = (p: { x: number; y: number }) => {
    const geo = new THREE.IcosahedronGeometry(18, 0);
    const g = new THREE.Group();
    const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x8a1e1e, roughness: 0.35, metalness: 0.1, flatShading: true, transparent: true, side: THREE.DoubleSide,
    }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xf3d27a, transparent: true }));
    g.add(body, edges);
    const from = { x: p.x - 90, y: p.y - 70 };
    add(950, g, (k, o) => {
      const e = 1 - (1 - k) ** 3;
      o.position.set(from.x + (p.x - from.x) * e, from.y + (p.y - from.y) * e - Math.sin(e * Math.PI) * 40, 20);
      o.rotation.x += (1 - k) * 0.4;
      o.rotation.y += (1 - k) * 0.5;
      o.rotation.z += (1 - k) * 0.2;
      const op = k < 0.75 ? 1 : (1 - k) * 4;
      (body.material as THREE.Material).opacity = op;
      (edges.material as THREE.Material).opacity = op;
    });
  };

  /** Expanding ring at the point of impact. */
  const ring = (p: { x: number; y: number }, colour: number, maxR = 70) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, side: THREE.DoubleSide }));
    m.position.set(p.x, p.y, 5);
    add(500, m, (k, o) => {
      const r = 6 + maxR * (1 - (1 - k) ** 2);
      o.scale.set(r, r, 1);
      ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8;
    });
  };

  const burst = (p: { x: number; y: number }, colour: number) => {
    const n = 36, pos = new Float32Array(n * 3), vel: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      pos.set([p.x, p.y, 0], i * 3);
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 220, (Math.random() - 0.5) * 220 - 60, 0));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: colour, size: 5, transparent: true });
    add(650, new THREE.Points(geo, mat), (k, o) => {
      const pts = o as THREE.Points;
      const arr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < n; i++)
        arr.setXYZ(i, p.x + vel[i]!.x * k, p.y + vel[i]!.y * k + 90 * k * k, 0);
      arr.needsUpdate = true;
      (pts.material as THREE.PointsMaterial).opacity = 1 - k;
    });
  };

  const streak = (a: { x: number; y: number }, b: { x: number; y: number }, colour: number) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(5, 8, 8),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true }),
    );
    add(300, m, (k, o) => {
      o.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 0);
      ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k * 0.5;
    });
  };

  const pulse = (colour: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0 }),
    );
    m.position.set(w / 2, h / 2, -10);
    add(450, m, (k, o) => {
      ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.18;
    });
  };

  const handle: FxHandle = {
    play(e, ctx) {
      const hero = center(ctx.heroRect);
      const target = ctx.targetRect ? center(ctx.targetRect) : hero;
      if (e.type === 'roll' && e.actor === 'hero' && e.purpose !== 'initiative' && e.purpose !== 'damage') die(hero);
      if (e.type === 'roll' && e.outcome === 'crit') { ring(target, 0xffd84a, 110); pulse(0xffd84a); }
      if (e.type === 'damage') {
        const magic = e.damageType && !/slashing|piercing|bludgeoning/.test(e.damageType);
        const at = e.target === 'hero' || e.target === 'hero-beast' ? hero : target;
        if (magic && ctx.heroRect && ctx.targetRect) streak(hero, target, burstColour(e.damageType));
        burst(at, burstColour(e.damageType));
        ring(at, burstColour(e.damageType), e.hpLeft === 0 ? 120 : 60);
        if (e.target === 'hero' || e.target === 'hero-beast') pulse(0xb03020);
      }
      if (e.type === 'heal') {
        burst(hero, 0x7ac04a);
        pulse(0x3a6a30);
      }
    },
    cancel() {
      for (const a of active.splice(0)) { scene.remove(a.obj); disposeObj(a.obj); }
    },
    dispose() {
      handle.cancel();
      if (raf) cancelAnimationFrame(raf);
      renderer.dispose();
      canvas.remove();
    },
  };
  return handle;
}
