/**
 * Telling an open copy of the website that the films have changed.
 *
 * The video page holds the list of films. It reads it when it opens, and again
 * now and then while it is in front. That covers a visitor, who came to look at
 * something and has no reason to know anything changed.
 *
 * It does not cover the owner. They are looking at the panel in one tab and the
 * website in the other, and they add or remove a film and look across - and for
 * up to twenty seconds the two disagree. That is a small window, but the owner is
 * the one person who always sees it, and it has been reported as a fault more
 * than once. A twenty-second wait is not "nearly right" when you are looking
 * straight at the thing you just changed.
 *
 * So the panel says so. It is the same browser, the same origin, and the page is
 * already open; there is a channel for exactly this. It costs nothing, it is
 * immediate, and it involves no waiting at all.
 *
 * The interval stays, because most changes are not made in this browser at all -
 * the desktop tool, a phone, another tab signed in elsewhere.
 */

const CHANNEL = 'maa-saraswati-films';

/**
 * Announce that the list has changed.
 *
 * Called after a film is added, renamed, moved or removed, and only then: an
 * announcement is a promise that something did change.
 */
export function announceFilmChange() {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL);
    // A channel is held open by design, so it is told to let go once it has
    // shouted. Otherwise every change leaves one behind for the life of the tab.
    channel.postMessage('changed');
    setTimeout(() => channel.close(), 0);
  } catch {
    // A browser that will not do this is a browser that will do without it.
  }
}

/**
 * Run `onChange` whenever a film is added, renamed, moved or removed.
 *
 * @param {() => void} onChange
 * @returns {() => void} a way to stop listening
 */
export function onFilmChange(onChange) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  let channel;
  try {
    channel = new BroadcastChannel(CHANNEL);
  } catch {
    return () => {};
  }
  const handler = (event) => {
    if (event.data === 'changed') onChange();
  };
  channel.addEventListener('message', handler);
  return () => {
    channel.removeEventListener('message', handler);
    channel.close();
  };
}
