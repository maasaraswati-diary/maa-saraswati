import { useEffect, useRef, useState } from 'react';

/**
 * Fetches data on mount and whenever `deps` change.
 * Returns { data, loading, error, reload }.
 */
export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    Promise.resolve()
      .then(fetcher)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error?.message || 'Something went wrong.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = () => setNonce((n) => n + 1);
  return { ...state, reload, setData: (d) => setState((s) => ({ ...s, data: d })) };
}

/** Debounces a rapidly changing value (used for search inputs). */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * One shared IntersectionObserver reveals every `.reveal` element on scroll.
 *
 * `useReveal()` is called once at the app level, but components that load data
 * asynchronously (product grids, enquiry lists) re-render on their own — the
 * app shell does not. So a MutationObserver watches the DOM and reveals any
 * `.reveal` node that appears later, which keeps route changes, fetched cards
 * and filtered lists animating in without extra wiring.
 */
let sharedObserver = null;
let sharedMutation = null;

function revealNow(el) {
  el.classList.add('in');
}

function ensureObserver() {
  if (sharedObserver) return sharedObserver;
  if (!('IntersectionObserver' in window)) return null;

  sharedObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealNow(entry.target);
          sharedObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
  );
  return sharedObserver;
}

/** Observes every `.reveal` element that has not been revealed yet. */
function scanReveals() {
  const pending = document.querySelectorAll('.reveal:not(.in)');
  if (!pending.length) return;

  const observer = ensureObserver();
  if (!observer) {
    // No IntersectionObserver (very old browser): show everything.
    pending.forEach(revealNow);
    return;
  }
  pending.forEach((el) => observer.observe(el));
}

/** Reveals `.reveal` elements inside a freshly added subtree. */
function scanSubtree(node) {
  if (!(node instanceof Element)) return;
  if (node.classList?.contains('reveal') && !node.classList.contains('in')) {
    const observer = ensureObserver();
    if (observer) observer.observe(node);
    else revealNow(node);
  }
  node.querySelectorAll?.('.reveal:not(.in)').forEach((el) => {
    const observer = ensureObserver();
    if (observer) observer.observe(el);
    else revealNow(el);
  });
}

function ensureMutationWatcher() {
  if (sharedMutation || !('MutationObserver' in window)) return;
  sharedMutation = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(scanSubtree);
    }
  });
  sharedMutation.observe(document.body, { childList: true, subtree: true });
}

export function useReveal() {
  useEffect(() => {
    ensureMutationWatcher();
    scanReveals();
  });
}

export { scanReveals };

/** Locks body scroll while `locked` is true (mobile nav, modals). */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/** Reads and writes a value in localStorage with a React state mirror. */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [key, value]);

  return [value, setValue];
}
