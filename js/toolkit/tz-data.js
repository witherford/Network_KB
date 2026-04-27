// Curated timezone abbreviation → metadata table.
//
// Some abbreviations are AMBIGUOUS (e.g. CST = China / Cuba / US Central / Australian Central
// Standard depending on context, IST = India / Israel / Irish, BST = British / Bangladesh).
// Where that's the case we keep multiple entries and flag `ambiguousWith`.
//
// Each entry resolves to one or more IANA names so DST is handled correctly
// by Intl.DateTimeFormat. The static `offsetMinutes` is the standard-time
// offset; live formatting always uses the IANA zone for accuracy.

export const TZ_ABBR = [
  // ----- UTC / GMT family -----
  { abbr: 'UTC',  name: 'Coordinated Universal Time',         iana: 'UTC',                          regions: 'Reference / aviation / IT', offsetMinutes: 0,    dstAbbr: null },
  { abbr: 'GMT',  name: 'Greenwich Mean Time',                iana: 'Etc/GMT',                      regions: 'UK (winter), Iceland, West Africa', offsetMinutes: 0, dstAbbr: 'BST' },

  // ----- Europe -----
  { abbr: 'BST',  name: 'British Summer Time',                iana: 'Europe/London',                regions: 'United Kingdom (summer), Ireland', offsetMinutes: 60, dstAbbr: null, ambiguousWith: 'BST (Bangladesh)' },
  { abbr: 'IST',  name: 'Irish Standard Time',                iana: 'Europe/Dublin',                regions: 'Republic of Ireland', offsetMinutes: 60, dstAbbr: null, ambiguousWith: 'IST (India), IST (Israel)' },
  { abbr: 'WET',  name: 'Western European Time',              iana: 'Europe/Lisbon',                regions: 'Portugal, Canaries, Faroe Islands', offsetMinutes: 0, dstAbbr: 'WEST' },
  { abbr: 'WEST', name: 'Western European Summer Time',       iana: 'Europe/Lisbon',                regions: 'Portugal, Canaries (summer)', offsetMinutes: 60, dstAbbr: null },
  { abbr: 'CET',  name: 'Central European Time',              iana: 'Europe/Paris',                 regions: 'France, Germany, Spain, Italy, Poland, Netherlands, Sweden, Norway, Denmark, etc.', offsetMinutes: 60, dstAbbr: 'CEST' },
  { abbr: 'CEST', name: 'Central European Summer Time',       iana: 'Europe/Paris',                 regions: 'Most of EU (summer)', offsetMinutes: 120, dstAbbr: null },
  { abbr: 'EET',  name: 'Eastern European Time',              iana: 'Europe/Athens',                regions: 'Greece, Finland, Bulgaria, Romania, Cyprus, Egypt', offsetMinutes: 120, dstAbbr: 'EEST' },
  { abbr: 'EEST', name: 'Eastern European Summer Time',       iana: 'Europe/Athens',                regions: 'Greece, Finland, Romania (summer)', offsetMinutes: 180, dstAbbr: null },
  { abbr: 'MSK',  name: 'Moscow Standard Time',               iana: 'Europe/Moscow',                regions: 'Russia (Moscow + western)', offsetMinutes: 180, dstAbbr: null },
  { abbr: 'TRT',  name: 'Turkey Time',                        iana: 'Europe/Istanbul',              regions: 'Turkey', offsetMinutes: 180, dstAbbr: null },

  // ----- Middle East / South Asia -----
  { abbr: 'AST',  name: 'Arabia Standard Time',               iana: 'Asia/Riyadh',                  regions: 'Saudi Arabia, UAE, Qatar, Bahrain, Kuwait, Iraq, Yemen', offsetMinutes: 180, dstAbbr: null, ambiguousWith: 'AST (Atlantic)' },
  { abbr: 'IRST', name: 'Iran Standard Time',                 iana: 'Asia/Tehran',                  regions: 'Iran', offsetMinutes: 210, dstAbbr: 'IRDT' },
  { abbr: 'GST',  name: 'Gulf Standard Time',                 iana: 'Asia/Dubai',                   regions: 'UAE, Oman', offsetMinutes: 240, dstAbbr: null },
  { abbr: 'AZT',  name: 'Azerbaijan Time',                    iana: 'Asia/Baku',                    regions: 'Azerbaijan', offsetMinutes: 240, dstAbbr: null },
  { abbr: 'AMT',  name: 'Armenia Time',                       iana: 'Asia/Yerevan',                 regions: 'Armenia', offsetMinutes: 240, dstAbbr: null },
  { abbr: 'AFT',  name: 'Afghanistan Time',                   iana: 'Asia/Kabul',                   regions: 'Afghanistan', offsetMinutes: 270, dstAbbr: null },
  { abbr: 'PKT',  name: 'Pakistan Standard Time',             iana: 'Asia/Karachi',                 regions: 'Pakistan', offsetMinutes: 300, dstAbbr: null },
  { abbr: 'IST',  name: 'India Standard Time',                iana: 'Asia/Kolkata',                 regions: 'India, Sri Lanka', offsetMinutes: 330, dstAbbr: null, ambiguousWith: 'IST (Israel), IST (Ireland)' },
  { abbr: 'NPT',  name: 'Nepal Time',                         iana: 'Asia/Kathmandu',               regions: 'Nepal', offsetMinutes: 345, dstAbbr: null },
  { abbr: 'BTT',  name: 'Bhutan Time',                        iana: 'Asia/Thimphu',                 regions: 'Bhutan', offsetMinutes: 360, dstAbbr: null },
  { abbr: 'BST',  name: 'Bangladesh Standard Time',           iana: 'Asia/Dhaka',                   regions: 'Bangladesh', offsetMinutes: 360, dstAbbr: null, ambiguousWith: 'BST (British Summer)' },
  { abbr: 'MMT',  name: 'Myanmar Time',                       iana: 'Asia/Yangon',                  regions: 'Myanmar', offsetMinutes: 390, dstAbbr: null },
  { abbr: 'ICT',  name: 'Indochina Time',                     iana: 'Asia/Bangkok',                 regions: 'Thailand, Vietnam, Cambodia, Laos', offsetMinutes: 420, dstAbbr: null },
  { abbr: 'WIB',  name: 'Western Indonesia Time',             iana: 'Asia/Jakarta',                 regions: 'Western Indonesia (Jakarta)', offsetMinutes: 420, dstAbbr: null },

  // ----- East Asia / SE Asia -----
  { abbr: 'CST',  name: 'China Standard Time',                iana: 'Asia/Shanghai',                regions: 'Mainland China', offsetMinutes: 480, dstAbbr: null, ambiguousWith: 'CST (US Central), CST (Cuba)' },
  { abbr: 'HKT',  name: 'Hong Kong Time',                     iana: 'Asia/Hong_Kong',               regions: 'Hong Kong, Macau', offsetMinutes: 480, dstAbbr: null },
  { abbr: 'SGT',  name: 'Singapore Time',                     iana: 'Asia/Singapore',               regions: 'Singapore', offsetMinutes: 480, dstAbbr: null },
  { abbr: 'MYT',  name: 'Malaysia Time',                      iana: 'Asia/Kuala_Lumpur',            regions: 'Malaysia', offsetMinutes: 480, dstAbbr: null },
  { abbr: 'PHT',  name: 'Philippine Time',                    iana: 'Asia/Manila',                  regions: 'Philippines', offsetMinutes: 480, dstAbbr: null },
  { abbr: 'WITA', name: 'Central Indonesia Time',             iana: 'Asia/Makassar',                regions: 'Central Indonesia (Bali, Borneo)', offsetMinutes: 480, dstAbbr: null },
  { abbr: 'JST',  name: 'Japan Standard Time',                iana: 'Asia/Tokyo',                   regions: 'Japan', offsetMinutes: 540, dstAbbr: null },
  { abbr: 'KST',  name: 'Korea Standard Time',                iana: 'Asia/Seoul',                   regions: 'South Korea, North Korea', offsetMinutes: 540, dstAbbr: null },
  { abbr: 'WIT',  name: 'Eastern Indonesia Time',             iana: 'Asia/Jayapura',                regions: 'Eastern Indonesia (Papua)', offsetMinutes: 540, dstAbbr: null },

  // ----- Oceania -----
  { abbr: 'AWST', name: 'Australian Western Standard Time',   iana: 'Australia/Perth',              regions: 'Western Australia', offsetMinutes: 480, dstAbbr: null },
  { abbr: 'ACST', name: 'Australian Central Standard Time',   iana: 'Australia/Adelaide',           regions: 'South Australia, Northern Territory', offsetMinutes: 570, dstAbbr: 'ACDT' },
  { abbr: 'ACDT', name: 'Australian Central Daylight Time',   iana: 'Australia/Adelaide',           regions: 'South Australia (summer)', offsetMinutes: 630, dstAbbr: null },
  { abbr: 'AEST', name: 'Australian Eastern Standard Time',   iana: 'Australia/Sydney',             regions: 'NSW, Victoria, Queensland, ACT, Tasmania', offsetMinutes: 600, dstAbbr: 'AEDT' },
  { abbr: 'AEDT', name: 'Australian Eastern Daylight Time',   iana: 'Australia/Sydney',             regions: 'NSW, Victoria, ACT, Tasmania (summer)', offsetMinutes: 660, dstAbbr: null },
  { abbr: 'NZST', name: 'New Zealand Standard Time',          iana: 'Pacific/Auckland',             regions: 'New Zealand', offsetMinutes: 720, dstAbbr: 'NZDT' },
  { abbr: 'NZDT', name: 'New Zealand Daylight Time',          iana: 'Pacific/Auckland',             regions: 'New Zealand (summer)', offsetMinutes: 780, dstAbbr: null },
  { abbr: 'CHST', name: 'Chamorro Standard Time',             iana: 'Pacific/Guam',                 regions: 'Guam, Northern Mariana Islands', offsetMinutes: 600, dstAbbr: null },
  { abbr: 'FJT',  name: 'Fiji Time',                          iana: 'Pacific/Fiji',                 regions: 'Fiji', offsetMinutes: 720, dstAbbr: null },

  // ----- Africa -----
  { abbr: 'WAT',  name: 'West Africa Time',                   iana: 'Africa/Lagos',                 regions: 'Nigeria, Cameroon, Angola, DR Congo (west)', offsetMinutes: 60, dstAbbr: null },
  { abbr: 'CAT',  name: 'Central Africa Time',                iana: 'Africa/Maputo',                regions: 'Mozambique, Zambia, Zimbabwe, Malawi, Botswana', offsetMinutes: 120, dstAbbr: null },
  { abbr: 'EAT',  name: 'East Africa Time',                   iana: 'Africa/Nairobi',               regions: 'Kenya, Tanzania, Uganda, Ethiopia, Somalia', offsetMinutes: 180, dstAbbr: null },
  { abbr: 'SAST', name: 'South Africa Standard Time',         iana: 'Africa/Johannesburg',          regions: 'South Africa, Lesotho, Eswatini', offsetMinutes: 120, dstAbbr: null },

  // ----- North America -----
  { abbr: 'NST',  name: 'Newfoundland Standard Time',         iana: 'America/St_Johns',             regions: 'Newfoundland and Labrador (Canada)', offsetMinutes: -210, dstAbbr: 'NDT' },
  { abbr: 'NDT',  name: 'Newfoundland Daylight Time',         iana: 'America/St_Johns',             regions: 'Newfoundland (summer)', offsetMinutes: -150, dstAbbr: null },
  { abbr: 'AST',  name: 'Atlantic Standard Time',             iana: 'America/Halifax',              regions: 'Atlantic Canada, Caribbean (Puerto Rico, USVI, Bermuda)', offsetMinutes: -240, dstAbbr: 'ADT', ambiguousWith: 'AST (Arabia)' },
  { abbr: 'ADT',  name: 'Atlantic Daylight Time',             iana: 'America/Halifax',              regions: 'Atlantic Canada (summer)', offsetMinutes: -180, dstAbbr: null },
  { abbr: 'EST',  name: 'Eastern Standard Time (US/Canada)',  iana: 'America/New_York',             regions: 'NY, ON, FL, GA, NC, etc. — eastern US/Canada', offsetMinutes: -300, dstAbbr: 'EDT' },
  { abbr: 'EDT',  name: 'Eastern Daylight Time (US/Canada)',  iana: 'America/New_York',             regions: 'Eastern US/Canada (summer)', offsetMinutes: -240, dstAbbr: null },
  { abbr: 'CST',  name: 'Central Standard Time (US/Canada)',  iana: 'America/Chicago',              regions: 'TX, IL, IA, MO, MN, MB, SK — central US/Canada', offsetMinutes: -360, dstAbbr: 'CDT', ambiguousWith: 'CST (China), CST (Cuba)' },
  { abbr: 'CDT',  name: 'Central Daylight Time (US/Canada)',  iana: 'America/Chicago',              regions: 'Central US/Canada (summer)', offsetMinutes: -300, dstAbbr: null },
  { abbr: 'MST',  name: 'Mountain Standard Time (US/Canada)', iana: 'America/Denver',               regions: 'CO, AZ (no DST), NM, MT, ID, AB — mountain US/Canada', offsetMinutes: -420, dstAbbr: 'MDT' },
  { abbr: 'MDT',  name: 'Mountain Daylight Time',             iana: 'America/Denver',               regions: 'Mountain US/Canada (summer; AZ stays MST)', offsetMinutes: -360, dstAbbr: null },
  { abbr: 'PST',  name: 'Pacific Standard Time',              iana: 'America/Los_Angeles',          regions: 'CA, WA, OR, NV, BC — Pacific US/Canada', offsetMinutes: -480, dstAbbr: 'PDT' },
  { abbr: 'PDT',  name: 'Pacific Daylight Time',              iana: 'America/Los_Angeles',          regions: 'Pacific US/Canada (summer)', offsetMinutes: -420, dstAbbr: null },
  { abbr: 'AKST', name: 'Alaska Standard Time',               iana: 'America/Anchorage',            regions: 'Alaska', offsetMinutes: -540, dstAbbr: 'AKDT' },
  { abbr: 'AKDT', name: 'Alaska Daylight Time',               iana: 'America/Anchorage',            regions: 'Alaska (summer)', offsetMinutes: -480, dstAbbr: null },
  { abbr: 'HST',  name: 'Hawaii–Aleutian Standard Time',      iana: 'Pacific/Honolulu',             regions: 'Hawaii, Aleutian Islands (no DST)', offsetMinutes: -600, dstAbbr: null },

  // ----- Central / South America -----
  { abbr: 'CT',   name: 'Cuba Standard Time',                 iana: 'America/Havana',               regions: 'Cuba', offsetMinutes: -300, dstAbbr: 'CDT' },
  { abbr: 'COT',  name: 'Colombia Time',                      iana: 'America/Bogota',               regions: 'Colombia, Ecuador (mainland)', offsetMinutes: -300, dstAbbr: null },
  { abbr: 'PET',  name: 'Peru Time',                          iana: 'America/Lima',                 regions: 'Peru', offsetMinutes: -300, dstAbbr: null },
  { abbr: 'VET',  name: 'Venezuela Time',                     iana: 'America/Caracas',              regions: 'Venezuela', offsetMinutes: -240, dstAbbr: null },
  { abbr: 'BRT',  name: 'Brasília Time',                      iana: 'America/Sao_Paulo',            regions: 'Brazil (most populated states)', offsetMinutes: -180, dstAbbr: null },
  { abbr: 'ART',  name: 'Argentina Time',                     iana: 'America/Argentina/Buenos_Aires', regions: 'Argentina', offsetMinutes: -180, dstAbbr: null },
  { abbr: 'CLT',  name: 'Chile Standard Time',                iana: 'America/Santiago',             regions: 'Chile (mainland)', offsetMinutes: -240, dstAbbr: 'CLST' },
  { abbr: 'CLST', name: 'Chile Summer Time',                  iana: 'America/Santiago',             regions: 'Chile (summer)', offsetMinutes: -180, dstAbbr: null },
  { abbr: 'UYT',  name: 'Uruguay Time',                       iana: 'America/Montevideo',           regions: 'Uruguay', offsetMinutes: -180, dstAbbr: null },
  { abbr: 'PYT',  name: 'Paraguay Time',                      iana: 'America/Asuncion',             regions: 'Paraguay', offsetMinutes: -240, dstAbbr: 'PYST' },

  // ----- Asia (continued) -----
  { abbr: 'YEKT', name: 'Yekaterinburg Time',                 iana: 'Asia/Yekaterinburg',           regions: 'Russia (Urals)', offsetMinutes: 300, dstAbbr: null },
  { abbr: 'OMST', name: 'Omsk Standard Time',                 iana: 'Asia/Omsk',                    regions: 'Russia (Omsk)', offsetMinutes: 360, dstAbbr: null },
  { abbr: 'KRAT', name: 'Krasnoyarsk Time',                   iana: 'Asia/Krasnoyarsk',             regions: 'Russia (Krasnoyarsk)', offsetMinutes: 420, dstAbbr: null },
  { abbr: 'IRKT', name: 'Irkutsk Time',                       iana: 'Asia/Irkutsk',                 regions: 'Russia (Irkutsk)', offsetMinutes: 480, dstAbbr: null },
  { abbr: 'YAKT', name: 'Yakutsk Time',                       iana: 'Asia/Yakutsk',                 regions: 'Russia (Yakutsk)', offsetMinutes: 540, dstAbbr: null },
  { abbr: 'VLAT', name: 'Vladivostok Time',                   iana: 'Asia/Vladivostok',             regions: 'Russia (Far East — Vladivostok)', offsetMinutes: 600, dstAbbr: null },
  { abbr: 'MAGT', name: 'Magadan Time',                       iana: 'Asia/Magadan',                 regions: 'Russia (Magadan)', offsetMinutes: 660, dstAbbr: null },
  { abbr: 'PETT', name: 'Kamchatka Time',                     iana: 'Asia/Kamchatka',               regions: 'Russia (Kamchatka)', offsetMinutes: 720, dstAbbr: null }
];

// Build a quick-lookup index keyed by uppercase abbreviation.
// Multi-valued because of ambiguous abbreviations.
export const TZ_BY_ABBR = (() => {
  const m = new Map();
  for (const z of TZ_ABBR) {
    const k = z.abbr.toUpperCase();
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(z);
  }
  return m;
})();

/**
 * Format a UTC-offset-minutes value as "UTC+HH:MM" / "UTC-HH:MM" / "UTC".
 */
export function fmtOffset(min) {
  if (min === 0) return 'UTC';
  const sign = min >= 0 ? '+' : '-';
  const m = Math.abs(min);
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `UTC${sign}${h}:${mm}`;
}

/**
 * Get a Date object's offset (in minutes) for a particular IANA zone, AT
 * that Date instant. Honours DST rules. Returns 0 for UTC, +330 for IST etc.
 */
export function offsetForZone(date, iana) {
  try {
    // Trick: format the same instant as a "fake UTC" string and as a real
    // local string for the IANA zone, then compute the difference.
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: iana, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = dtf.formatToParts(date);
    const get = t => parts.find(p => p.type === t)?.value;
    const asUtc = Date.UTC(
      +get('year'), +get('month') - 1, +get('day'),
      +get('hour'), +get('minute'), +get('second')
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}
