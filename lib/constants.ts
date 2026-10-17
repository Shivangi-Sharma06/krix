export const DETECTION_CONFIG = {
  // Minimum number of distinct independent wallets required to flag cover-up
  INDEPENDENT_REPORTER_THRESHOLD_K: 3,

  // Weights for cover-up score computation (0-100 total)
  WEIGHTS: {
    INDEPENDENT_REPORTERS_MAX: 30, // 10 pts per independent reporter up to 30
    AVERAGE_SEVERITY_MAX: 25,     // up to 25 pts based on avg severity (1-10)
    STATUS_REVERSAL_MAX: 25,      // 25 pts for flip to positive against evidence
    REVERSE_TIMING_MAX: 10,       // 10 pts if positive edit occurred after first report
    QUANTITY_GAP_MAX: 10,         // 10 pts if claimed > dispatched or unexplained deficit
    TAMPERING_MAX: 40,            // 40 pts if immutable manifest attributes were modified
  },

  // Daily report submission limit per wallet per record (Item 5)
  CLIENT_DAILY_REPORT_LIMIT: 3,

  // Max photo attachments per report
  MAX_REPORT_PHOTOS: 3,

  // Max photo file size (5 MB)
  MAX_PHOTO_BYTES: 5 * 1024 * 1024,

  // Allowed image mime types (sniffed via magic bytes)
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const;
