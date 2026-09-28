/**
 * Single source of truth for the shop's contact details.
 * Change anything here and it updates across the whole site.
 */

/**
 * The number behind the WhatsApp links.
 *
 * TO GO LIVE: put 919814391854 here, and in the three phone lines below.
 *
 * Every WhatsApp link on the site is built from this one line, and the number
 * itself is written in this file three times rather than once. That is on
 * purpose: the second and third are `phoneDigits` and `phoneHref`, which the
 * dialling links and the WhatsApp links share, so there is one number to reason
 * about here instead of one here and one hardcoded in ten files. It used to be
 * the other way round - the number was written by hand across ten files, so
 * changing it meant finding ten copies and hoping none had been missed, and a
 * missed one is a link that quietly messages or rings the wrong person.
 *
 * `client/scripts/set-phone.mjs` moves all of it in one pass and leaves the
 * instruction line above alone.
 */
export const WHATSAPP_DIGITS = '919781444655';

export const SITE = {
  name: 'MAA SARASWATI',
  legalName: 'Maa Saraswati Diary H.O',
  tagline: 'A promise of purity, a commitment to health',

  // --- phone ---
  // Printed on the site and dialled by the Call buttons. Same line as the
  // WhatsApp number above, in international form for wa.me and tel: links, and
  // spaced for the ways it is written out for a person to read.
  phone: '+91 97814 44655',
  phoneDigits: '919781444655',
  phoneHref: 'tel:+919781444655',

  // --- WhatsApp ---
  whatsapp: `https://wa.me/${WHATSAPP_DIGITS}`,

  /**
   * A WhatsApp link with the enquiry already written out, ready to send.
   *
   * Built here rather than at each call site so the pre-filling cannot be got
   * wrong in one place and right in another.
   */
  whatsappEnquiry(text) {
    return `https://wa.me/${WHATSAPP_DIGITS}?text=${encodeURIComponent(text)}`;
  },

  // --- email ---
  // The address customers write to. The owner signs in to the partner panel
  // with a different account, so that one is kept in AuthContext instead.
  email: 'maasaraswati449@gmail.com',
  emailHref: 'mailto:maasaraswati449@gmail.com',

  // --- address ---
  addressLines: [
    'Maa Saraswati Diary H.O',
    'Mallowal, Post Office Gajikot',
    'Branch – Kahnuwaan Chowk',
    'Gurdaspur, Punjab 143521',
  ],
  addressOneLine:
    'Maa Saraswati Diary H.O, Mallowal, Post Office Gajikot, ' +
    'Branch – Kahnuwaan Chowk, Gurdaspur, Punjab 143521',
  locality: 'Mallowal, Gajikot',
  city: 'Gurdaspur',
  state: 'Punjab',
  pincode: '143521',
  mapsHref:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(
      'Mallowal, Post Office Gajikot, Gurdaspur, Punjab 143521'
    ),

  // --- opening hours ---
  hours: '6:00 AM – 9:00 PM',
  hoursShort: '6 AM – 9 PM',
  openDays: 'Mon – Sun, all days',
};

export default SITE;
