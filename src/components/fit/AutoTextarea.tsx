import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';

/** A text box that grows with what's typed (up to `maxRows`), for long food names, notes and edits. */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { maxRows?: number }>(
  function AutoTextarea({ maxRows = 8, className = '', onChange, value, ...props }, outer) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    const fit = useCallback(() => {
      const el = inner.current;
      if (!el) return;
      el.style.height = 'auto';
      const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
      el.style.height = `${Math.min(el.scrollHeight, line * maxRows + 24)}px`;
    }, [maxRows]);
    useLayoutEffect(fit, [value, fit]);
    return (
      <textarea
        {...props}
        rows={props.rows ?? 1}
        value={value}
        ref={el => { inner.current = el; if (typeof outer === 'function') outer(el); else if (outer) outer.current = el; }}
        onChange={e => { onChange?.(e); fit(); }}
        className={`f-input resize-none leading-6 ${className}`}
      />
    );
  },
);
