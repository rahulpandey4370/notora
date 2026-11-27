'use client';

import { useEffect } from 'react';

/**
 * iOS doesn't shrink the page when the on-screen keyboard opens, so anything
 * fixed to the bottom (log sheets, full-screen chat) ends up behind it, and
 * Safari scrolls the whole page around trying to show the field. This keeps
 * the keyboard's height in --kb on <html>; bottom-anchored UI sits at
 * `bottom: var(--kb)` and sizes itself to what's still visible.
 */
export default function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const update = () => {
      // Pinch-zoomed: the visual viewport is small because of the zoom, not a keyboard.
      const kb = vv.scale > 1.01 ? 0 : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.setProperty('--kb', `${kb}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.removeProperty('--kb');
    };
  }, []);
  return null;
}
