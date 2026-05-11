/**
 * Normalize and validate a phone number.
 *
 * ─── Egyptian Numbers ───
 *   +201234567890, 01234567890, 1234567890
 *   → normalized to 201234567890 (12 digits)
 *
 * ─── International Numbers ───
 *   +14155552671, +442071234567, +971501234567
 *   → kept as-is (digits only, with country code)
 *
 * Rules:
 *   - Strips all non-digit characters
 *   - Egyptian: auto-adds country code 20 if needed
 *   - International: accepts if ≥ 10 digits with country code
 *   - Returns empty string if invalid
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Strip everything except digits
  let digits = phone.replace(/[^0-9]/g, '');

  if (!digits) return '';

  // ─── Egyptian number normalization ───

  // +20 or 0020 prefix
  if (digits.startsWith('0020')) {
    digits = digits.slice(2); // → 20xxx
  }

  if (digits.startsWith('20')) {
    // 20 + 10 digits mobile = 12 digits total (valid Egyptian)
    if (digits.length === 12 && digits.startsWith('201')) {
      return digits;
    }
    // Invalid Egyptian (wrong length)
    return '';
  }

  // Starts with 01 → Egyptian mobile without country code (11 digits)
  if (digits.startsWith('01')) {
    if (digits.length === 11) {
      return '20' + digits; // Add country code → 12 digits
    }
    return '';
  }

  // Starts with 1 (without leading 0) → Egyptian mobile like 1234567890 (10 digits)
  if (digits.startsWith('1') && digits.length === 10) {
    return '20' + digits; // → 12 digits
  }

  // ─── International numbers ───
  // Accept any number ≥ 10 digits that starts with a digit > 0 (country code)
  if (digits.length >= 10 && !digits.startsWith('0')) {
    return digits;
  }

  // ─── Fallback: any number ≥ 10 digits ───
  if (digits.length >= 10) {
    return digits;
  }

  // Too short — invalid
  return '';
}

/**
 * Get a human-readable validation error for a phone number.
 * Returns null if the phone is valid.
 *
 * Supports:
 *   - Egyptian numbers (strict: 11 digits starting with 01)
 *   - International numbers (flexible: ≥ 10 digits with country code)
 */
export function getPhoneError(phone: string): string | null {
  if (!phone || !phone.trim()) {
    return 'رقم الهاتف فارغ';
  }

  const raw = phone.trim();
  const digits = raw.replace(/[^0-9]/g, '');

  if (!digits) {
    return 'لا يحتوي على أرقام';
  }

  // ─── Egyptian number patterns ───

  // Starts with 01 → must be exactly 11 digits
  if (digits.startsWith('01')) {
    if (digits.length < 11) {
      return `رقم مصري غير مكتمل (${digits.length}/11 رقم)`;
    }
    if (digits.length > 11) {
      return `رقم مصري طويل جداً (${digits.length}/11 رقم)`;
    }
    return null; // Valid Egyptian mobile
  }

  // Starts with 20 (country code) → must be exactly 12 digits
  if (digits.startsWith('20')) {
    if (digits.length < 12) {
      return `رقم مصري غير مكتوب بالكامل مع كود الدولة (${digits.length}/12 رقم)`;
    }
    if (digits.length > 12) {
      return `رقم مصري طويل جداً (${digits.length}/12 رقم)`;
    }
    return null; // Valid Egyptian with country code
  }

  // Starts with 0020 → same as 20
  if (digits.startsWith('0020')) {
    if (digits.length < 14) {
      return `رقم مصري غير مكتوب بالكامل مع كود الدولة (${digits.length}/14 رقم)`;
    }
    return null;
  }

  // Starts with 1 (without 0) and 10 digits → Egyptian without leading 0
  if (digits.startsWith('1') && digits.length === 10) {
    return null;
  }

  // ─── International numbers ───
  // Starts with + (stripped) or digits not starting with 0 → international format
  // Must be ≥ 10 digits
  if (digits.length >= 10 && !digits.startsWith('0')) {
    // Looks like a valid international number
    return null;
  }

  // Starts with 0 but not 01 → could be local format of some countries
  // Accept if ≥ 10 digits
  if (digits.startsWith('0') && digits.length >= 10 && !digits.startsWith('01')) {
    return null;
  }

  // ─── Too short ───
  if (digits.length < 10) {
    return `رقم قصير جداً (${digits.length} رقم — الحد الأدنى 10 أرقام)`;
  }

  return null; // Fallback: accept
}

/**
 * Detect country info from a normalized phone number.
 * Returns { countryCode, capital } or null if unknown.
 * Used by webhook to auto-fill city on incoming messages.
 */
export function detectCountryFromPhone(phone: string): { countryCode: string; capital: string } | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return null;

  const COUNTRY_MAP: Array<{ code: string; capital: string }> = [
    { code: '20', capital: 'Cairo' },
    { code: '966', capital: 'Riyadh' },
    { code: '971', capital: 'Abu Dhabi' },
    { code: '965', capital: 'Kuwait City' },
    { code: '974', capital: 'Doha' },
    { code: '968', capital: 'Muscat' },
    { code: '973', capital: 'Manama' },
    { code: '962', capital: 'Amman' },
    { code: '961', capital: 'Beirut' },
    { code: '964', capital: 'Baghdad' },
    { code: '212', capital: 'Rabat' },
    { code: '216', capital: 'Tunis' },
    { code: '213', capital: 'Algiers' },
    { code: '218', capital: 'Tripoli' },
    { code: '249', capital: 'Khartoum' },
    { code: '963', capital: 'Damascus' },
    { code: '970', capital: 'Jerusalem' },
    { code: '967', capital: 'Sana\'a' },
    { code: '1', capital: 'New York' },
    { code: '44', capital: 'London' },
    { code: '49', capital: 'Berlin' },
    { code: '33', capital: 'Paris' },
    { code: '91', capital: 'New Delhi' },
    { code: '90', capital: 'Istanbul' },
    { code: '55', capital: 'São Paulo' },
    { code: '86', capital: 'Beijing' },
    { code: '81', capital: 'Tokyo' },
    { code: '234', capital: 'Lagos' },
    { code: '27', capital: 'Johannesburg' },
    { code: '39', capital: 'Rome' },
    { code: '34', capital: 'Madrid' },
    { code: '43', capital: 'Vienna' },
    { code: '41', capital: 'Zurich' },
    { code: '46', capital: 'Stockholm' },
    { code: '47', capital: 'Oslo' },
    { code: '48', capital: 'Warsaw' },
    { code: '31', capital: 'Amsterdam' },
    { code: '32', capital: 'Brussels' },
    { code: '351', capital: 'Lisbon' },
    { code: '92', capital: 'Islamabad' },
    { code: '880', capital: 'Dhaka' },
    { code: '66', capital: 'Bangkok' },
    { code: '84', capital: 'Hanoi' },
    { code: '63', capital: 'Manila' },
    { code: '62', capital: 'Jakarta' },
    { code: '60', capital: 'Kuala Lumpur' },
    { code: '7', capital: 'Moscow' },
    { code: '380', capital: 'Kyiv' },
    { code: '40', capital: 'Bucharest' },
    { code: '20', capital: 'Cairo' },
    { code: '972', capital: 'Tel Aviv' },
  ];

  // Sort by code length descending to match longest first
  const sorted = [...COUNTRY_MAP].sort((a, b) => b.code.length - a.code.length);
  for (const country of sorted) {
    if (digits.startsWith(country.code)) {
      return { countryCode: country.code, capital: country.capital };
    }
  }

  return null;
}
