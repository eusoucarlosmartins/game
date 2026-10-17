// input.js — gestos unificados (mouse, toque, caneta) sobre o canvas:
// toque/clique curto = ação; arrastar = mover câmera; pinça/roda = zoom.
import { state } from './state.js';
import { panBy, zoomAt, screenToWorld } from './camera.js';

const TAP_SLOP = 10; // px CSS que um dedo pode tremer sem virar arrasto

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onTap: (sx: number, sy: number, pointerType: string) => void }} handlers
 */
export function attachInput(canvas, handlers) {
  /** @type {Map<number, {x: number, y: number}>} */
  const pointers = new Map();
  let startX = 0, startY = 0;
  let dragging = false;
  let multi = false;
  let pinchDist = 0;
  let pinchMid = { x: 0, y: 0 };

  /** @param {PointerEvent | WheelEvent} e */
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const twoFinger = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  /** @param {number} sx @param {number} sy */
  const setHover = (sx, sy) => {
    const w = screenToWorld(state.scene, sx, sy);
    state.mouseX = w.x;
    state.mouseY = w.y;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ponteiro sintético ou já liberado */ }
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      startX = p.x; startY = p.y;
      dragging = false;
      multi = false;
    } else if (pointers.size === 2) {
      multi = true;
      const t = twoFinger();
      pinchDist = t.dist;
      pinchMid = t.mid;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (e.pointerType === 'mouse' && !pointers.has(e.pointerId)) {
      setHover(p.x, p.y);
      return;
    }
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, p);
    if (pointers.size >= 2) {
      const t = twoFinger();
      if (pinchDist > 0) zoomAt(state.scene, t.mid.x, t.mid.y, t.dist / pinchDist);
      panBy(state.scene, t.mid.x - pinchMid.x, t.mid.y - pinchMid.y);
      pinchDist = t.dist;
      pinchMid = t.mid;
      return;
    }
    if (!dragging && Math.hypot(p.x - startX, p.y - startY) > TAP_SLOP) dragging = true;
    if (dragging) {
      panBy(state.scene, p.x - prev.x, p.y - prev.y);
      canvas.classList.add('panning');
    }
  });

  /** @param {PointerEvent} e */
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.delete(e.pointerId);
    if (pointers.size > 0) {
      pinchDist = 0;
      const [rest] = [...pointers.values()];
      pinchMid = rest;
      return;
    }
    canvas.classList.remove('panning');
    const wasTap = !dragging && !multi && e.type === 'pointerup';
    dragging = false;
    multi = false;
    if (!wasTap) return;
    setHover(p.x, p.y);
    handlers.onTap(p.x, p.y, e.pointerType);
    if (e.pointerType !== 'mouse') {
      // toque não tem hover: some com o tooltip depois de um tempo
      setTimeout(() => { if (pointers.size === 0) { state.mouseX = -1; state.mouseY = -1; } }, 2500);
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !pointers.has(e.pointerId)) {
      state.mouseX = -1;
      state.mouseY = -1;
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e);
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    zoomAt(state.scene, p.x, p.y, factor);
    setHover(p.x, p.y);
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
