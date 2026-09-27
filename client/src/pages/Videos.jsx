import { Link } from 'react-router-dom';
import Icon from '../components/Icons';
import VideoCard from '../components/VideoCard';
import Picture from '../components/Picture';
import { PageHeader } from '../components/Feedback';
import { usePageMeta } from '../hooks';
import { useVideoAds } from '../hooks/useVideoAds';
import { SITE } from '../site';

/**
 * The shop's video ads.
 *
 * Kept off the product pages on purpose. A film is the heaviest thing on the
 * site, and nothing here is needed to decide whether to buy milk, so a customer
 * looking for a price should never pay for a video they did not ask to see.
 */
export default function Videos() {
  usePageMeta({
    title: 'Our Videos',
    description:
      'Short films of Maa Saraswati - how our ghee is churned, how the paneer is set, and how the milk gets to your door in Gurdaspur.',
  });

  const { ads } = useVideoAds();

  return (
    <>
      <PageHeader
        eyebrow="Watch"
        title={
          <>
            The shop, in a <br className="br-sm" />
            <span className="serif-it hl">short film</span>
          </>
        }
        subtitle="A few minutes of the plant, the paneer unit and the morning run. Turn the sound on if you have it."
      />

      <section className="section">
        <div className="container">
          {ads.length ? (
            <div className="grid grid-2 videos-grid">
              {ads.map((ad) => (
                <VideoCard key={ad.slug} ad={ad} />
              ))}
            </div>
          ) : (
            <p className="muted">Our films are being put together — please come back soon.</p>
          )}
        </div>
      </section>

      <section className="section-sm">
        <div className="container">
          <div className="facility reveal">
            <div className="facility-copy">
              <span className="eyebrow">Rather see it in person?</span>
              <h2 className="h3">The plant is open to visitors</h2>
              <p className="muted">
                See the milking, the pasteuriser, the lab and the cold room. No
                appointment needed — come during working hours and ask for the
                counter.
              </p>
              <ul className="check-list">
                <li>
                  <span className="cl-check">
                    <Icon.Check size={15} />
                  </span>
                  {SITE.hours}
                </li>
                <li>
                  <span className="cl-check">
                    <Icon.Check size={15} />
                  </span>
                  {SITE.addressLines.join(', ')}
                </li>
                <li>
                  <span className="cl-check">
                    <Icon.Check size={15} />
                  </span>
                  Bulk and wholesale enquiries welcome
                </li>
              </ul>
              <div className="facility-actions">
                <Link to="/contact" className="btn btn-red btn-sm">
                  <Icon.MapPin size={16} /> Visit Us
                </Link>
                <a
                  className="btn btn-ghost btn-sm"
                  href={SITE.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon.Phone size={16} /> WhatsApp Us
                </a>
              </div>
            </div>
            <div className="facility-media">
              {/* A photograph, not a second copy of the first film - the grid
                  above already has it, and a film repeated in a call to action
                  reads as a mistake. */}
              <Picture
                src="/images/products/milk-billboard.jpeg"
                alt="Maa Saraswati brand billboard"
                loading="lazy"
                sizes="(max-width: 900px) 94vw, 46vw"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
