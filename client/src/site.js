/**
 * Single source of truth for the shop's contact details.
 * Change anything here and it updates across the whole site.
 */
export const SITE = {
  name: 'MAA SARASWATI',
  legalName: 'Maa Saraswati Diary H.O',
  tagline: 'A promise of purity, a commitment to health',

  // --- phone ---
  phone: '+91 98143 91854',
  phoneDigits: '919814391854',
  phoneHref: 'tel:+919814391854',
  whatsapp: 'https://wa.me/919814391854',

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
