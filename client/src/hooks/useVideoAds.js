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
 * It re-reads when the tab comes back to the front, asking for the list of record
 * rather than the fast copy. The person most likely to have just removed a film
 * is the owner, sitting with the panel in one tab and the website in the other;
 * without this the website carries on showing a film they have already deleted.
 *
 * "Of record" matters as much as re-reading. The copy the visitors are served
 * can be up to a minute behind, because that is how long the store keeps it -
 * which is the right trade for a page of films and the wrong one for the person
 * who just pressed a button. A tab being brought back to the front is a rare
 * event next to a page being opened, so it is not worth spending the store's
 * allowance on. There is a floor on how often it may happen, because switching
 * between tabs is easy to do by accident.
 */
const MIN_RECHECK_MS = 20000;

/** How long a focus may go without costing a read, however often it fires. */
let lastCheck = 0;

export function useVideoAds() {
  const [state, setState] = useState({
    ads: VIDEO_ADS,
    fromPanel: false,
    storageOn: true,
    reason: '',
  });

  const read = useCallback(async ({ fresh = false } = {}) => {
    try {
      const { available, videos } = await fetchVideoList({ fresh });
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
    const whenBack = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck < MIN_RECHECK_MS) return;
      read({ fresh: true });
    };
    document.addEventListener('visibilitychange', whenBack);
    window.addEventListener('focus', whenBack);
    return () => {
      document.removeEventListener('visibilitychange', whenBack);
      window.removeEventListener('focus', whenBack);
    };
  }, [read]);

  return state;
}
