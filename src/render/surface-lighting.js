import { SURFACE_LIGHTING } from '../data/surface-lighting.js';

const buffers = new WeakMap();

/** Same ordered weather tints for the backdrop and every outdoor object. All values are gameplay art choices. */
export function surfaceEffects({ dark, dusk, storm, flare }) {
  return [
    { ...SURFACE_LIGHTING.storm, opacity: storm ? SURFACE_LIGHTING.storm.opacity : 0 },
    { ...SURFACE_LIGHTING.dusk, opacity: storm ? 0 : dusk * SURFACE_LIGHTING.dusk.opacity },
    { ...SURFACE_LIGHTING.night, opacity: dark * SURFACE_LIGHTING.night.opacity },
    { ...SURFACE_LIGHTING.flare, opacity: flare ? SURFACE_LIGHTING.flare.opacity : 0 },
  ].filter((effect) => effect.opacity > 0);
}

/** Tint only an object's actual pixels, keeping transparent corners and the other objects behind it intact. */
export function paintSurfaceEffects(ctx, id, bounds, paint, effects) {
  let objects = buffers.get(ctx);
  if (!objects) { objects = new Map(); buffers.set(ctx, objects); }
  let canvas = objects.get(id);
  if (!canvas) { canvas = document.createElement('canvas'); objects.set(id, canvas); }
  const m = ctx.getTransform();
  const left = Math.floor(bounds.x * m.a + m.e);
  const top = Math.floor(bounds.y * m.d + m.f);
  const width = Math.max(1, Math.ceil((bounds.x + bounds.w) * m.a + m.e) - left);
  const height = Math.max(1, Math.ceil((bounds.y + bounds.h) * m.d + m.f) - top);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, width, height);
  g.save();
  g.imageSmoothingEnabled = false;
  g.setTransform(m.a, m.b, m.c, m.d, m.e - left, m.f - top);
  paint(g);
  g.restore();
  g.save();
  g.globalCompositeOperation = 'source-atop';
  for (const effect of effects) {
    g.fillStyle = `rgba(${effect.tint},${effect.opacity})`;
    g.fillRect(0, 0, width, height);
  }
  g.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(canvas, left, top);
  ctx.restore();
}
