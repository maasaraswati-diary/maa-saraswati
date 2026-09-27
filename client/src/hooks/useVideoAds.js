import { useEffect, useState } from 'react';
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
 */
export function useVideoAds() {
  const [state, setState] = useState({
    ads: VIDEO_ADS,
    fromPanel: false,
    storageOn: true,
    reason: '',
  });

  useEffect(() => {
    let alive = true;

    fetchVideoList()
      .then(({ available, videos }) => {
        if (!alive) return;
        setState({
          ads: videos.length ? videos : VIDEO_ADS,
          fromPanel: videos.length > 0,
          storageOn: available,
          reason: '',
        });
      })
      .catch((err) => {
        if (!alive) return;
        // The films already on screen stay there. The visitor gets the page they
        // came for; only the owner needs to know the service is unhappy, and
        // they can see that in the panel.
        setState((s) => ({ ...s, storageOn: false, reason: err?.message || '' }));
      });

    return () => {
      alive = false;
    };
  }, []);

  return state;
}
