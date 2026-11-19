import { drawMenuInk, menuInkWidth } from './menu-lettering.js';
import { applyTeaPaperStock } from './tea-paper.js';

export function paintLabel(canvas, label, scale, ink='#472e20', strokeWidth) {
  const width = Math.ceil(menuInkWidth(label) * scale + 12);
  const height = Math.ceil(37 * scale + 8);
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.width = `${width}px`;
  const pen = canvas.getContext('2d');
  pen.scale(2, 2);
  pen.strokeStyle = ink;
  drawMenuInk(pen,label,6,4,scale,undefined,strokeWidth);
}

export function createCounterPaper(id, title, dismiss) {
  const overlay = document.getElementById(id);
  const paper = overlay.querySelector('article');
  const scroll = overlay.querySelector('.sushi-paper-window') || paper;
  const exit = overlay.querySelector('.paper-exit');
  paintLabel(paper.querySelector('h2 canvas'), title, 1.68);
  paintLabel(exit.querySelector('canvas'), 'Back to Explore', 1);
  if (scroll !== paper) applyTeaPaperStock(paper);
  exit.addEventListener('click', dismiss);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) dismiss();
  });
  return {
    paper,
    open() {overlay.hidden = false; scroll.scrollTop = 0;},
    show(progress) {overlay.style.setProperty('--paper-progress', progress);},
    focus() {paper.focus({preventScroll:true});},
    hide() {overlay.hidden = true;},
  };
}
