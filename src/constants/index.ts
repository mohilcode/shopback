export const LANGUAGE_NAMES = {
  ar: 'Arabic',
  bn: 'Bengali',
  bg: 'Bulgarian',
  zh: 'Chinese',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  iw: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  id: 'Indonesian',
  it: 'Italian',
  ko: 'Korean',
  lv: 'Latvian',
  lt: 'Lithuanian',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sr: 'Serbian',
  sk: 'Slovak',
  sl: 'Slovenian',
  es: 'Spanish',
  sw: 'Swahili',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
} as const

export const SUPPORTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'] as const

export const MAX_FILE_SIZE = 20 * 1024 * 1024

export const JMA_LANGUAGE_MAPPING = {
  en: 'english',
  zh: 'chinese_zs',
  ko: 'korean',
  pt: 'portuguese',
  es: 'spanish',
  vi: 'vietnamese',
  th: 'thai',
  id: 'indonesian',
} as const

export const EARTHQUAKE_CACHE_TTL = 300
