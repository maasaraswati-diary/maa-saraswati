/**
 * The shop's video ads. Written by scripts/prepare-videos.mjs and
 * scripts/add-video.mjs - edit those, not this.
 *
 * Each entry can be shown two ways. `src` is a file on this site, compressed
 * and served from Cloudflare Pages. `youtube` is an id from a channel upload,
 * and the picture then streams from there and costs this site no bandwidth at
 * all. Whichever is filled in wins, so a film can move between the two freely.
 *
 * These are the films that were built into the site. Once films are uploaded
 * through the partner panel they are listed there instead, and this file is only
 * ever what the video page falls back to.
 */
export const VIDEO_ADS = [
  {
    "slug": "dahi-motu-patlu",
    "src": "/videos/dahi-motu-patlu.mp4",
    "poster": "/images/videos/dahi-motu-patlu.jpg",
    "title": "Dahi Motu Patlu",
    "note": "Our friends from the neighbourhood, on a pack of Dahi.",
    "youtube": ""
  },
  {
    "slug": "ghee",
    "src": "/videos/ghee.mp4",
    "poster": "/images/videos/ghee.jpg",
    "title": "Desi Ghee",
    "note": "Hand-churned from cultured white butter, in small batches.",
    "youtube": ""
  },
  {
    "slug": "milk",
    "src": "/videos/milk.mp4",
    "poster": "/images/videos/milk.jpg",
    "title": "Standardised Milk",
    "note": "Full-cream, pasteurised, tested and cold-chained to your door.",
    "youtube": ""
  },
  {
    "slug": "panner",
    "src": "/videos/panner.mp4",
    "poster": "/images/videos/panner.jpg",
    "title": "High Protein Paneer",
    "note": "Set from our own milk. No starch, no vegetable fat.",
    "youtube": ""
  }
];
