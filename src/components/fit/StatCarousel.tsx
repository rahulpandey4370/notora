import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Ring, type StatSpec } from './Ring';

const DELAY = 4500; // ms each card stays before sliding on (also the dot's fill animation, see fit.css)

/**
 * The hero's stats, one card at a time. Swipe or tap a dot; it moves on by
 * itself every few seconds, holding while you touch, hover or focus it, while
 * the tab is hidden, and never for reduced-motion users.
 */
export function StatCarousel({ slides, onSetTarget }: { slides: StatSpec[]; onSetTarget: () => void }) {
  const [ref, api] = useEmblaCarousel({ loop: true, duration: 32 });
  const [sel, setSel] = useState(0);
  const [hold, setHold] = useState(false);
  const [ready, setReady] = useState(false); // one frame after mount, so the first card's ring animates in too
  const [still, setStill] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    setStill(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSel(api.selectedScrollSnap());
    const down = () => setHold(true), up = () => setHold(false);
    api.on('select', onSelect).on('pointerDown', down).on('pointerUp', up);
    return () => { api.off('select', onSelect).off('pointerDown', down).off('pointerUp', up); };
  }, [api]);

  // Autoplay: re-armed on every change of card, so a swipe gets the full delay too.
  useEffect(() => {
    if (!api || hold || still) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const arm = () => { clearTimeout(t); if (!document.hidden) t = setTimeout(() => api.scrollNext(), DELAY); };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', arm); };
  }, [api, hold, still, sel]);

  return (
    <section aria-roledescription="carousel" aria-label="Day totals" className="flex flex-col gap-2"
      onPointerEnter={e => e.pointerType === 'mouse' && setHold(true)} onPointerLeave={e => e.pointerType === 'mouse' && setHold(false)}
      onFocus={() => setHold(true)} onBlur={e => !e.currentTarget.contains(e.relatedTarget) && setHold(false)}>
      <div ref={ref} className="overflow-hidden rounded-[22px]">
        <div className="-ml-3 flex touch-pan-y">
          {slides.map(({ key, ...s }, i) => (
            <div key={key} className="min-w-0 shrink-0 grow-0 basis-full pl-3" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${s.label}`}>
              <Ring {...s} active={ready && i === sel} onSetTarget={onSetTarget} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-0.5">
        {slides.map((s, i) => (
          <button key={s.key} type="button" className="f-dot" data-on={i === sel} aria-label={`Show ${s.label}`} aria-current={i === sel}
            onClick={() => api?.scrollTo(i)}>
            {/* the fill restarts with the timer: hidden while held, remounted when autoplay resumes */}
            <span>{i === sel && !still && !hold && <i key={sel} />}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
