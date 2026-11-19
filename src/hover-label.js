import { drawMenuInk, menuInkWidth } from './menu-lettering.js';

export function createHoverLabel(canvas) {
  const ctx = canvas.getContext('2d');
  const margin = 9;
  const gap = 14;
  const height = 43;
  const scale = .92;
  let shownLabel;
  let width;
  let density;

  return function showLabel(label, x, y) {
    if (!label) {
      canvas.hidden = true;
      return;
    }
    const nextDensity = Math.min(devicePixelRatio, 2);
    if (label !== shownLabel || density !== nextDensity) {
      shownLabel = label;
      density = nextDensity;
      width = Math.ceil(menuInkWidth(label) * scale + 22);
      canvas.width = Math.ceil(width * density);
      canvas.height = Math.ceil(height * density);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.setAttribute('aria-label', label);
      canvas.setAttribute('role',label==='Experience' ? 'button' : 'img');
      ctx.setTransform(density, 0, 0, density, 0, 0);
      ctx.strokeStyle = '#fff';
      ctx.shadowColor = 'rgba(255, 248, 234, .88)';
      ctx.shadowBlur = 5 * density;
      drawMenuInk(ctx, label, 11, 7, scale);
    }

    const left = x + gap + width <= innerWidth - margin ? x + gap : x - width - gap;
    const top = y - height - gap >= margin ? y - height - gap : y + gap;
    const safeLeft = Math.max(margin, Math.min(left, innerWidth - width - margin));
    const safeTop = Math.max(margin, Math.min(top, innerHeight - height - margin));
    canvas.style.transform = `translate(${Math.round(safeLeft)}px, ${Math.round(safeTop)}px)`;
    canvas.hidden = false;
  };
}
