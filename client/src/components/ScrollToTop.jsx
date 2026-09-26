import { useEffect, useState } from 'react';
import Icon from './Icons';

/**
 * Back-to-top button that appears after the user scrolls past the hero, plus
 * a thin progress bar under the navbar showing page scroll position.
 */
export default function ScrollToTop() {
  const [pct, setPct] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setPct(height > 0 ? Math.min(100, (top / height) * 100) : 0);
      setShow(top > 600);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <button
        className={`to-top ${show ? 'show' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
      >
        <Icon.ArrowRight size={20} style={{ transform: 'rotate(-90deg)' }} />
      </button>
      <style>{`.nav-progress{width:${pct}%}`}</style>
    </>
  );
}
