import { Link } from 'react-router-dom';
import Icon from '../components/Icons';
import { PageHeader } from '../components/Feedback';

const TIMELINE = [
  {
    year: '1998',
    title: 'One cow, one neighbourhood',
    text: 'Maa Saraswati started as a single hand-milked cow sold to 30 homes on Gopal Mandi Road. The milk went out in steel cans, twice a day.',
  },
  {
    year: '2006',
    title: 'Our own cold room',
    text: 'We built a chilling plant so milk could travel further without going bad. Eight new routes opened the same month.',
  },
  {
    year: '2014',
    title: 'Paneer, made properly',
    text: 'A small set-making unit opened so we could make our own paneer instead of buying it. No starch, no vegetable fat, ever.',
  },
  {
    year: '2019',
    title: 'FSSAI certified, fully tested',
    text: 'Every batch began going through an accredited lab the day it is received. The results are on file, and customers can ask for them.',
  },
  {
    year: 'Today',
    title: '12,000 families, 40 routes',
    text: 'Still the same family, the same neighbourhood, the same rule — if it is not good enough for our own kitchen, it does not leave the plant.',
  },
];

const VALUES = [
  {
    icon: 'Drop',
    title: 'Purity is not negotiable',
    text: 'No water added, no starch, no synthetic colour, no preservatives. If an ingredient is not on the pack, it is not in the product.',
  },
  {
    icon: 'Shield',
    title: 'Safety over everything',
    text: 'Pasteurised, lab-tested and cold-chained. We would rather lose a day of sales than send out a single unchecked batch.',
  },
  {
    icon: 'Family',
    title: 'We answer the phone',
    text: 'A real person picks up between 6 AM and 9 PM. If a pouch is late or a pack is not right, it gets replaced the same day.',
  },
  {
    icon: 'Leaf',
    title: 'Waste goes back to the farm',
    text: 'Sour milk and curd trimmings go to the farm as cattle feed, and our pots and crates are reused rather than landfilled.',
  },
];

const TEAM = [
  {
    name: 'Deepak Sharma',
    role: 'Founder & Plant Head',
    text: 'Started with one cow in 1998. Still checks the first batch of the morning, every morning.',
  },
  {
    name: 'Sunita Yadav',
    role: 'Quality & Testing',
    text: 'Runs the lab and the batch records. Has rejected more milk than she has accepted.',
  },
  {
    name: 'Imran Sheikh',
    role: 'Cold Chain & Delivery',
    text: 'Keeps 40 routes and 14 vehicles on schedule so the milk arrives properly chilled.',
  },
];

export default function About() {
  return (
    <>
      <PageHeader
        eyebrow="About Us"
        title={
          <>
            A family dairy that never <br className="br-sm" />
            <span className="serif-it hl">changed the rules</span>
          </>
        }
        subtitle="Maa Saraswati has been delivering honest dairy to the same city since 1998. Same farm, same family, same promise — nothing artificial, ever."
      />

      {/* Story */}
      <section className="section" id="story">
        <div className="container story">
          <div className="story-media reveal">
            <div className="story-frame">
              <img
                src="/images/products/milk-city-billboard.jpeg"
                alt="Maa Saraswati campaign in the city"
                loading="lazy"
              />
            </div>
            <div className="story-badge glass">
              <strong>25+</strong>
              <span>years of the same promise</span>
            </div>
          </div>

          <div className="story-copy">
            <span className="eyebrow reveal">Our Story</span>
            <h2 className="h2 reveal reveal-d1">
              It began with one cow and thirty houses
            </h2>
            <div className="reveal reveal-d2">
              <p className="pd-para">
                In 1998, Deepak Sharma milked one cow and sold the milk to
                thirty families on Gopal Mandi Road. He carried it in a steel
                can, twice a day, and everyone on that street knew him by name.
              </p>
              <p className="pd-para">
                Nothing about the product changed. What changed was the scale —
                and the fact that we built our own chilling plant, our own
                testing lab, and our own paneer unit instead of buying the
                easy way.
              </p>
              <p className="pd-para">
                Today 12,000 families, 30 retail partners and 40 delivery routes
                depend on the same four things: pure milk, pasteurisation, a
                cold chain, and an honest label.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Promise */}
      <section className="section tint-green" id="promise">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow reveal">Our Promise</span>
            <h2 className="h2 reveal reveal-d1">
              Four things we will never compromise on
            </h2>
          </div>
          <div className="grid grid-4">
            {VALUES.map((v, i) => {
              const I = Icon[v.icon];
              return (
                <article
                  key={v.title}
                  className={`pillar tone-green reveal reveal-d${i + 1}`}
                >
                  <span className="pillar-icon">
                    <I size={26} />
                  </span>
                  <h3 className="pillar-title">{v.title}</h3>
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
            <span className="eyebrow reveal">Milestones</span>
            <h2 className="h2 reveal reveal-d1">
              How we got here
            </h2>
          </div>

          <div className="timeline">
            {TIMELINE.map((t, i) => (
              <div
                key={t.year}
                className={`tl-item reveal reveal-d${(i % 4) + 1}`}
              >
                <span className="tl-dot" aria-hidden="true" />
                <div className="tl-card">
                  <span className="tl-year">{t.year}</span>
                  <h3 className="tl-title">{t.title}</h3>
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
            <span className="eyebrow reveal">The People</span>
            <h2 className="h2 reveal reveal-d1">
              Who actually runs this
            </h2>
          </div>
          <div className="grid grid-3">
            {TEAM.map((m, i) => (
              <article
                key={m.name}
                className={`team-card reveal reveal-d${i + 1}`}
              >
                <span className="team-avatar">
                  {m.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <h3 className="team-name">{m.name}</h3>
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
              <img
                src="/images/products/milk-billboard.jpeg"
                alt="Maa Saraswati brand billboard"
                loading="lazy"
              />
            </div>
            <div className="facility-copy">
              <span className="eyebrow">The Plant</span>
              <h2 className="h3">A facility you can visit</h2>
              <p className="muted">
                Our plant and retail counter are open to visitors. See the
                milking, the pasteuriser, the lab, and the cold room. No
                appointment needed.
              </p>
              <ul className="check-list">
                <li>
                  <span className="cl-check">
                    <Icon.Check size={15} />
                  </span>
                  Open 6:00 AM to 9:00 PM, all days
                </li>
                <li>
                  <span className="cl-check">
                    <Icon.Check size={15} />
                  </span>
                  Lab reports available on request
                </li>
                <li>
                  <span className="cl-check">
                    <Icon.Check size={15} />
                  </span>
                  FSSAI Lic. 10021064000123
                </li>
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
