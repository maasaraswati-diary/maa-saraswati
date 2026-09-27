import { Link } from 'react-router-dom';
import Icon from '../components/Icons';
import ProductImage from '../components/ProductImage';
import { PageHeader } from '../components/Feedback';
import { useFetch, usePageMeta } from '../hooks';
import { fetchAboutContent } from '../store/db';
import { withAboutDefaults } from '../aboutContent';

/**
 * The words on this page come from Firestore so the owner can change them from
 * the partner panel. withAboutDefaults fills in anything that has not been saved
 * yet, which means the panel does not have to be used at all for the page to
 * read properly - and a field added later cannot leave a hole in it.
 */
export default function About() {
  const { data } = useFetch(() => fetchAboutContent(), []);
  const c = withAboutDefaults(data);

  usePageMeta({
    title: 'About Us',
    description:
      'A family dairy in Kahnuwaan Chowk, Gurdaspur. Grass-fed cows, our own chilling plant and testing lab, and the same promise since 1998.',
  });

  return (
    <>
      <PageHeader
        eyebrow={c.header.eyebrow}
        title={
          <>
            {c.header.titleLead} <br className="br-sm" />
            <span className="serif-it hl">{c.header.titleHighlight}</span>
          </>
        }
        subtitle={c.header.subtitle}
      />

      {/* Story */}
      <section className="section" id="story">
        <div className="container story">
          <div className="story-media reveal">
            <div className="story-frame">
              <ProductImage
                src={c.story.image}
                alt={c.story.imageAlt}
                loading="lazy"
                sizes="(max-width: 900px) 94vw, 52vw"
              />
            </div>
            <div className="story-badge glass">
              <strong>{c.story.badgeValue}</strong>
              <span>{c.story.badgeLabel}</span>
            </div>
          </div>

          <div className="story-copy">
            <span className="eyebrow reveal">{c.story.eyebrow}</span>
            <h2 className="h2 reveal reveal-d1">{c.story.title}</h2>
            <div className="reveal reveal-d2">
              {c.story.paragraphs.map((p, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <p className="pd-para" key={i}>
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Promise */}
      <section className="section tint-green" id="promise">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow reveal">{c.promise.eyebrow}</span>
            <h2 className="h2 reveal reveal-d1">{c.promise.title}</h2>
          </div>
          <div className="grid grid-4">
            {c.promise.items.map((v, i) => {
              const I = Icon[v.icon] || Icon.Drop;
              return (
                <article
                  key={`${v.title}-${i}`}
                  className={`pillar tone-green reveal reveal-d${i + 1}`}
                >
                  <span className="pillar-icon">
                    <I size={26} />
                  </span>
                  <h2 className="pillar-title">{v.title}</h2>
                  <p className="pillar-text">{v.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="section">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow reveal">{c.timeline.eyebrow}</span>
            <h2 className="h2 reveal reveal-d1">{c.timeline.title}</h2>
          </div>

          <div className="timeline">
            {c.timeline.items.map((t, i) => (
              <div
                key={`${t.year}-${i}`}
                className={`tl-item reveal reveal-d${(i % 4) + 1}`}
              >
                <span className="tl-dot" aria-hidden="true" />
                <div className="tl-card">
                  <span className="tl-year">{t.year}</span>
                  <h2 className="tl-title">{t.title}</h2>
                  <p className="tl-text">{t.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section tint-cream">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow reveal">{c.team.eyebrow}</span>
            <h2 className="h2 reveal reveal-d1">{c.team.title}</h2>
          </div>
          <div className="grid grid-3">
            {c.team.members.map((m, i) => (
              <article
                key={`${m.name}-${i}`}
                className={`team-card reveal reveal-d${i + 1}`}
              >
                {/* A photo once the owner uploads one; initials until then, so a
                    card is never left with an empty hole in it. */}
                {m.image ? (
                  <span className="team-avatar team-avatar-photo">
                    <ProductImage
                      src={m.image}
                      alt={m.name}
                      loading="lazy"
                      preferThumb
                    />
                  </span>
                ) : (
                  <span className="team-avatar">
                    {m.name
                      .split(' ')
                      .map((w) => w[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')}
                  </span>
                )}
                <h2 className="team-name">{m.name}</h2>
                <span className="team-role">{m.role}</span>
                <p className="team-text">{m.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Facility strip */}
      <section className="section-sm">
        <div className="container">
          <div className="facility reveal">
            <div className="facility-media">
              <ProductImage
                src={c.facility.image}
                alt={c.facility.imageAlt}
                loading="lazy"
                sizes="(max-width: 900px) 94vw, 46vw"
              />
            </div>
            <div className="facility-copy">
              <span className="eyebrow">{c.facility.eyebrow}</span>
              <h2 className="h3">{c.facility.title}</h2>
              <p className="muted">{c.facility.text}</p>
              <ul className="check-list">
                {c.facility.points.map((pt) => (
                  <li key={pt}>
                    <span className="cl-check">
                      <Icon.Check size={15} />
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
              <div className="facility-actions">
                <Link to="/contact" className="btn btn-red btn-sm">
                  <Icon.MapPin size={16} /> Visit Us
                </Link>
                <Link to="/products" className="btn btn-ghost btn-sm">
                  Browse Products <Icon.ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
