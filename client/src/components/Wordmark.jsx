/**
 * The wordmark: the shop's name, set as the name.
 *
 * There is no symbol here on purpose. A mark has to be drawn small and still
 * read, and everything tried in that direction - a cow, a crescent, a lotus, a
 * drop in a circle - turned into a smudge by the time it was the size of a
 * browser tab. Letters do not have that problem: they are legible at twenty
 * pixels because they were designed to be.
 *
 * So the name carries the brand, and the only ornament is a gold hairline and a
 * wide-set line beneath it.
 *
 * Two things in here are not obvious and were both wrong the first time:
 *
 *   - The name and its hairline are one group, not two children of the mark. The
 *     hairline is sized off that group, so it is always measured against the
 *     name. In the footer the subtitle ("Pure Dairy Co. / Est. 1998") is the
 *     wider of the two, and sizing the hairline off the whole mark left a line
 *     hanging out past both ends of the name.
 *
 *   - The subtitle has a floor, not just a ratio. Its size is a fraction of the
 *     name's, which is right on a big sign and wrong in the bar: at the bar's
 *     20px name the ratio gave a 5px subtitle, which is smaller than the 10.5px
 *     one already on the site. `max()` in the rule keeps it legible at every
 *     size and only lets the ratio take over once the name is big enough for it
 *     to be the thing that decides.
 *
 * Set in the two fonts the site already loads (Fraunces, Outfit), so there is no
 * second font to download and the mark cannot come out looking different on a
 * machine that has never heard of either.
 */
export default function Wordmark({ sub, tone = 'dark', className = '' }) {
  return (
    <span
      className={`wordmark${tone === 'light' ? ' wordmark-light' : ''}${className ? ` ${className}` : ''}`}
    >
      <span className="wordmark-line">
        <span className="wordmark-name">MAA SARASWATI</span>
        {/* Decorative only. The text below is what a screen reader should read;
            announcing a rule as well would just be noise. */}
        {sub ? <span className="wordmark-rule" aria-hidden="true" /> : null}
      </span>
      {sub ? <span className="wordmark-sub">{sub}</span> : null}
    </span>
  );
}
