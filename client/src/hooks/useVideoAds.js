import { useCallback, useEffect, useState } from 'react';
import { fetchVideoList } from '../store/videos';
import { VIDEO_ADS } from '../videoAds';

/**
 * The films for the public video page.
 *
 * The films built into the site are shown first, straight away, and the panel's
 * list replaces them only if it arrives. Two reasons for that order:
 *
 *  - Nothing on the page waits on a network round trip, so the page never shows
 *    an empty grid or a spinner, and it looks the same whether the video service
 *    is quick, slow, or not switched on at all.
 *  - If the endpoint is unreachable, the page is still a working video page. The
 *    films built into the build are the floor the site stands on, not a
 *    second source of truth - once films are in the panel, that is the list.
 *
 * It re-reads when the tab comes back to the front, and every half minute while
 * it is being looked at. The person most likely to have just removed a film is
 * the owner, sitting with the panel in one tab and the website in the other;
 * without this the website carries on showing a film they have already deleted,
 * and the page is not so much stale as wrong.
 *
 * Both were added because a cached copy of the list sat behind this, and the
 * same need to check on focus. That copy is gone: it could be a minute behind,
 * which is the wrong answer for the person who has just pressed a button, and a
 * read of one small document is not worth trading that for.
 *
 * The interval only runs while the page is in front. A tab nobody is looking at
 * costs nothing, and a browser slows a background tab's timers down anyway, so
 * this is a handful of reads a day for a page that gets few visitors - against an
 * allowance of fifty thousand.
 *
 * The tick and the floor are kept apart, and that is not tidiness. One number
 * doing both jobs put the tick a few milliseconds short of its own limit, so it
 * was turned away and the page re-read every second tick instead of every tick.
 * The interval is the rate limit now; the floor only guards the events, which
 * can arrive in bursts - clicking between tabs raises several at once.
 */
const RECHECK_EVERY_MS = 20000;

/** A re-read brought on by a focus may not come sooner than this. */
const FOCUS_FLOOR_MS = 8000;

/** When the page was last read, so the floor can be applied. */
let lastCheck = 0;

export function useVideoAds() {
  const [state, setState] = useState({
    ads: VIDEO_ADS,
    fromPanel: false,
    storageOn: true,
    reason: '',
  });

  const read = useCallback(async () => {
    try {
      const { available, videos } = await fetchVideoList();
      lastCheck = Date.now();
      setState({
        ads: videos.length ? videos : VIDEO_ADS,
        fromPanel: videos.length > 0,
        storageOn: available,
        reason: '',
      });
    } catch (err) {
      // The films already on screen stay there. The visitor gets the page they
      // came for; only the owner needs to know the service is unhappy, and
      // they can see that in the panel.
      setState((s) => ({ ...s, storageOn: false, reason: err?.message || '' }));
    }
  }, []);

  useEffect(() => {
    read();
  }, [read]);

  useEffect(() => {
    // Straight away on coming back, for the person who has just been in the
    // panel. Guarded, because one click can raise several of these.
    const whenBack = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck < FOCUS_FLOOR_MS) return;
      read();
    };
    // The interval is the rate limit in its own right, so it only has to ask
    // whether anyone is looking.
    const onTick = () => {
      if (document.visibilityState === 'visible') read();
    };
    document.addEventListener('visibilitychange', whenBack);
    window.addEventListener('focus', whenBack);
    const timer = setInterval(onTick, RECHECK_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', whenBack);
      window.removeEventListener('focus', whenBack);
      clearInterval(timer);
    };
  }, [read]);

  return state;
}
