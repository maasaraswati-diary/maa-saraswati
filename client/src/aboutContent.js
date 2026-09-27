/**
 * The About page reads its words from Firestore so the owner can change them from
 * the partner panel without a deploy.
 *
 * The shape below is the default - it is what the page falls back to if nothing
 * has been saved yet, which means an empty collection leaves the site exactly as
 * it is rather than blank. Saving from the panel writes the whole document, so
 * there is one record to read and no merging to reason about.
 *
 * Images are the same references the catalogue uses: "upload:<id>" pointing at a
 * document in `uploads`, resolved by ProductImage. A plain path such as
 * "/images/products/milk-billboard.jpeg" also works, so the built-in
 * photography stays in place until the owner replaces it.
 */

export const ABOUT_DEFAULT_SECTIONS = [
  'header',
  'story',
  'promise',
  'timeline',
  'team',
  'facility',
];

export const DEFAULT_ABOUT = {
  header: {
    eyebrow: 'About Us',
    titleLead: 'A family dairy that never',
    titleHighlight: 'changed the rules',
    subtitle:
      'Maa Saraswati has been delivering honest dairy to the same city since 1998. Same farm, same family, same promise — nothing artificial, ever.',
  },

  story: {
    image: '/images/products/milk-city-billboard.jpeg',
    imageAlt: 'Maa Saraswati campaign in the city',
    badgeValue: '25+',
    badgeLabel: 'years of the same promise',
    eyebrow: 'Our Story',
    title: 'It began with one cow and thirty houses',
    paragraphs: [
      'In 1998, Deepak Sharma milked one cow and sold the milk to thirty families in Kahnuwaan Chowk, Gurdaspur. He carried it in a steel can, twice a day, and everyone on that street knew him by name.',
      'Nothing about the product changed. What changed was the scale — and the fact that we built our own chilling plant, our own testing lab, and our own paneer unit instead of buying the easy way.',
      'Today 12,000 families, 30 retail partners and 40 delivery routes depend on the same four things: pure milk, pasteurisation, a cold chain, and an honest label.',
    ],
  },

  promise: {
    eyebrow: 'Our Promise',
    title: 'Four things we will never compromise on',
    items: [
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
    ],
  },

  timeline: {
    eyebrow: 'Milestones',
    title: 'How we got here',
    items: [
      {
        year: '1998',
        title: 'One cow, one neighbourhood',
        text: 'Maa Saraswati started as a single hand-milked cow sold to 30 homes in Kahnuwaan Chowk, Gurdaspur. The milk went out in steel cans, twice a day.',
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
    ],
  },

  team: {
    eyebrow: 'The People',
    title: 'Who actually runs this',
    members: [
      {
        name: 'Deepak Sharma',
        role: 'Founder & Plant Head',
        text: 'Started with one cow in 1998. Still checks the first batch of the morning, every morning.',
        image: '',
      },
      {
        name: 'Isha Kalia',
        role: 'Quality & Testing',
        text: 'Runs the lab and the batch records. Has rejected more milk than she has accepted.',
        image: '',
      },
      {
        name: 'Mahir',
        role: 'Cold Chain & Delivery',
        text: 'Keeps 40 routes and 14 vehicles on schedule so the milk arrives properly chilled.',
        image: '',
      },
    ],
  },

  facility: {
    image: '/images/products/milk-billboard.jpeg',
    imageAlt: 'Maa Saraswati brand billboard',
    eyebrow: 'The Plant',
    title: 'A facility you can visit',
    text: 'Our plant and retail counter are open to visitors. See the milking, the pasteuriser, the lab, and the cold room. No appointment needed.',
    points: [
      'Open 6:00 AM to 9:00 PM, all days',
      'Lab reports available on request',
      'FSSAI Lic. 10021064000123',
    ],
  },
};

/** The icon names the values grid knows how to draw. */
export const VALUE_ICONS = ['Drop', 'Shield', 'Family', 'Leaf', 'Sparkle', 'Tag', 'Check', 'Star'];

/**
 * Fills in anything a saved document is missing.
 *
 * The owner edits a form, not the raw document, so a field added to this file
 * later would otherwise come back undefined on the live page and render as a
 * blank. Merging over the defaults means the page always has something to show.
 */
export function withAboutDefaults(saved) {
  if (!saved || typeof saved !== 'object') return DEFAULT_ABOUT;

  const pick = (section, key, fallback) => {
    const v = saved[section]?.[key];
    return v === undefined || v === null || v === '' ? fallback : v;
  };

  const list = (section, key, fallback) => {
    const v = saved[section]?.[key];
    return Array.isArray(v) && v.length ? v : fallback;
  };

  return {
    header: {
      eyebrow: pick('header', 'eyebrow', DEFAULT_ABOUT.header.eyebrow),
      titleLead: pick('header', 'titleLead', DEFAULT_ABOUT.header.titleLead),
      titleHighlight: pick('header', 'titleHighlight', DEFAULT_ABOUT.header.titleHighlight),
      subtitle: pick('header', 'subtitle', DEFAULT_ABOUT.header.subtitle),
    },
    story: {
      image: pick('story', 'image', DEFAULT_ABOUT.story.image),
      imageAlt: pick('story', 'imageAlt', DEFAULT_ABOUT.story.imageAlt),
      badgeValue: pick('story', 'badgeValue', DEFAULT_ABOUT.story.badgeValue),
      badgeLabel: pick('story', 'badgeLabel', DEFAULT_ABOUT.story.badgeLabel),
      eyebrow: pick('story', 'eyebrow', DEFAULT_ABOUT.story.eyebrow),
      title: pick('story', 'title', DEFAULT_ABOUT.story.title),
      paragraphs: list('story', 'paragraphs', DEFAULT_ABOUT.story.paragraphs),
    },
    promise: {
      eyebrow: pick('promise', 'eyebrow', DEFAULT_ABOUT.promise.eyebrow),
      title: pick('promise', 'title', DEFAULT_ABOUT.promise.title),
      items: list('promise', 'items', DEFAULT_ABOUT.promise.items).map((it, i) => ({
        icon: it?.icon || DEFAULT_ABOUT.promise.items[i % 4]?.icon || 'Drop',
        title: it?.title ?? '',
        text: it?.text ?? '',
      })),
    },
    timeline: {
      eyebrow: pick('timeline', 'eyebrow', DEFAULT_ABOUT.timeline.eyebrow),
      title: pick('timeline', 'title', DEFAULT_ABOUT.timeline.title),
      items: list('timeline', 'items', DEFAULT_ABOUT.timeline.items).map((it) => ({
        year: it?.year ?? '',
        title: it?.title ?? '',
        text: it?.text ?? '',
      })),
    },
    team: {
      eyebrow: pick('team', 'eyebrow', DEFAULT_ABOUT.team.eyebrow),
      title: pick('team', 'title', DEFAULT_ABOUT.team.title),
      members: list('team', 'members', DEFAULT_ABOUT.team.members).map((m) => ({
        name: m?.name ?? '',
        role: m?.role ?? '',
        text: m?.text ?? '',
        image: m?.image ?? '',
      })),
    },
    facility: {
      image: pick('facility', 'image', DEFAULT_ABOUT.facility.image),
      imageAlt: pick('facility', 'imageAlt', DEFAULT_ABOUT.facility.imageAlt),
      eyebrow: pick('facility', 'eyebrow', DEFAULT_ABOUT.facility.eyebrow),
      title: pick('facility', 'title', DEFAULT_ABOUT.facility.title),
      text: pick('facility', 'text', DEFAULT_ABOUT.facility.text),
      points: list('facility', 'points', DEFAULT_ABOUT.facility.points),
    },
  };
}
