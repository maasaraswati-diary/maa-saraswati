import { useEffect, useState } from 'react';
import Icon from './Icons';
import { ping } from '../catalogue';

/**
 * A quiet banner that appears only when the API cannot be reached and the page
 * is showing the built-in catalogue snapshot. Fades out as soon as the API
 * comes back, so a normal visit never sees it.
 */
export default function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      const res = await ping();
      if (!alive) return;
      if (res.ok) {
        setGone(true);
        setTimeout(() => alive && setOffline(false), 600);
      } else {
        setGone(false);
        setOffline(true);
      }
    };

    check();
    // Re-check periodically: the free API host sleeps, so it can wake or nap.
    const timer = setInterval(check, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className={`offline-notice ${gone ? 'leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <Icon.Refresh size={16} className={gone ? '' : 'spin'} />
      <span>
        Live prices reconnecting — you are viewing our saved catalogue. Call us
        on <strong>+91 98143 91854</strong> to confirm stock.
      </span>
    </div>
  );
}
