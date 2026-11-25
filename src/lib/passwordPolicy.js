// Shared password policy for EarlyLearn Hub.
// Used by: Login forced password change, parent SignUp, admin teacher/user create,
// admin password reset, and Superadmin "Create Admin".
//
// IMPORTANT: Keep these constants in sync with the Supabase Auth dashboard settings
// (Authentication → Providers → Email → "Minimum password length" / "Password requirements").
// The client must never accept a password the server will reject.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RECOMMENDED_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt / Supabase Auth hard limit

// Must mirror Supabase Dashboard → "Password requirements":
//   'none'                         → No required characters (default, recommended with length + leaked-password check)
//   'letters_digits'               → Letters and digits
//   'lower_upper_digits'           → Lowercase, uppercase letters and digits
//   'lower_upper_digits_symbols'   → Lowercase, uppercase letters, digits and symbols
export const PASSWORD_REQUIRED_CHARACTER_SET = 'none';

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

// Common / breached passwords and locally-predictable words (compared case-insensitively,
// after leetspeak normalization and stripping trailing digits/symbols).
const COMMON_PASSWORDS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345678910', '0123456789',
  '987654321', '9876543210', '111111', '11111111', '000000', '00000000', '123123', '123123123',
  '121212', '112233', '654321', '666666', '777777', '888888', '999999', '696969', '131313',
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd',
  'p@ssword', 'pass1234', 'passpass', 'qwerty', 'qwerty1', 'qwerty12', 'qwerty123', 'qwertyuiop',
  'qwer1234', 'asdfgh', 'asdfghjk', 'asdfghjkl', 'zxcvbnm', 'zxcvbnm1', '1q2w3e4r', '1q2w3e4r5t',
  '1qaz2wsx', 'qazwsx', 'qazwsxedc', 'abc123', 'abc12345', 'abcd1234', 'abcdefg', 'abcdefgh',
  'aaaaaa', 'aaaaaaaa', 'iloveyou', 'iloveyou1', 'iloveyou2', 'loveyou', 'princess', 'sunshine',
  'monkey', 'dragon', 'master', 'shadow', 'letmein', 'welcome', 'welcome1', 'welcome123',
  'football', 'baseball', 'basketball', 'superman', 'batman', 'trustno1', 'starwars', 'whatever',
  'freedom', 'michael', 'jennifer', 'jessica', 'charlie', 'daniel', 'computer', 'internet',
  'secret', 'changeme', 'default', 'login', 'access', 'hello', 'hello123', 'hellokitty',
  'admin', 'admin1', 'admin12', 'admin123', 'admin1234', 'administrator', 'root', 'toor',
  'superadmin', 'user', 'user123', 'guest', 'test', 'test123', 'testing', 'demo', 'temp',
  'temp123', 'temporary', 'student', 'student1', 'teacher', 'teacher1', 'teacher123', 'parent',
  'parent123', 'school', 'school123', 'daycare', 'daycare1', 'pilipinas', 'philippines',
  'mahalkita', 'mahal', 'iloveu', 'maganda', 'gwapo', 'pogi', 'tanga',
  'earlylearn', 'earlylearnhub', 'mswdo', 'mswd', 'eccd', 'manolofortich', 'manolo', 'fortich',
  'bukidnon', 'tankulan', 'damilag', 'pineapple', 'delmonte',
]);

const KEYBOARD_SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  '1qaz2wsx3edc4rfv',
  'qazwsxedcrfv',
];

const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

function normalizeAlnum(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function deLeet(value) {
  return String(value || '')
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] || ch)
    .join('');
}

function isKeyboardOrSequence(lower) {
  if (lower.length < 6) return false;
  return KEYBOARD_SEQUENCES.some((seq) => {
    const reversed = seq.split('').reverse().join('');
    return seq.includes(lower) || reversed.includes(lower);
  });
}

function isRepetitive(value) {
  // e.g. "aaaaaaaa", "abcabcabc", "12121212"
  return /^(.{1,3})\1+$/.test(value);
}

/**
 * Detects common / predictable passwords, including variants like "Password123!", "P@ssw0rd",
 * "admin2026", "earlylearn01", sequences ("12345678", "qwertyui") and repetitions.
 */
export function isCommonPassword(password) {
  const raw = String(password || '');
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const alnum = normalizeAlnum(raw);

  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(alnum)) return true;
  if (isRepetitive(lower) || isKeyboardOrSequence(lower) || isKeyboardOrSequence(alnum)) return true;

  // Base word after leetspeak normalization and stripping trailing digits/symbols (e.g. "P@ssword2026!")
  const leet = deLeet(raw);
  const baseWord = leet.replace(/[^a-z]+$/g, '').replace(/^[^a-z]+/g, '').replace(/[^a-z]/g, '');
  if (baseWord.length >= 4 && COMMON_PASSWORDS.has(baseWord)) {
    // Only reject when the common word dominates the password
    if (baseWord.length >= raw.length * 0.5) return true;
  }

  return false;
}

/**
 * Builds normalized comparison candidates from usernames, emails, Teacher IDs,
 * phone numbers (PH variants: 09XXXXXXXXX / 639XXXXXXXXX / 9XXXXXXXXX), and names.
 */
export function buildIdentifierCandidates(values = []) {
  const candidates = new Set();
  const phoneCores = new Set();

  [values].flat(Infinity).forEach((value) => {
    if (value === null || value === undefined) return;
    const raw = String(value).split('||')[0].trim().toLowerCase();
    if (!raw) return;

    const alnum = normalizeAlnum(raw);
    if (alnum.length >= 3) candidates.add(alnum);

    if (raw.includes('@')) {
      const local = normalizeAlnum(raw.split('@')[0]);
      if (local.length >= 3) candidates.add(local);
    }

    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 7) {
      candidates.add(digits);
      let core = digits;
      if (core.startsWith('63') && core.length === 12) core = core.slice(2);
      else if (core.startsWith('0') && core.length === 11) core = core.slice(1);
      candidates.add(core);
      candidates.add(`0${core}`);
      candidates.add(`63${core}`);
      if (core.length >= 7) phoneCores.add(core);
    }
  });

  return { candidates: Array.from(candidates), phoneCores: Array.from(phoneCores) };
}

function meetsCharacterSet(password, mode) {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  switch (mode) {
    case 'letters_digits':
      return { ok: (hasLower || hasUpper) && hasDigit, message: 'Password must include both letters and numbers.' };
    case 'lower_upper_digits':
      return {
        ok: hasLower && hasUpper && hasDigit,
        message: 'Password must include lowercase letters, uppercase letters, and numbers.',
      };
    case 'lower_upper_digits_symbols':
      return {
        ok: hasLower && hasUpper && hasDigit && hasSymbol,
        message: 'Password must include lowercase, uppercase, numbers, and symbols.',
      };
    default:
      return { ok: true, message: '' };
  }
}

/**
 * Validates a password against the shared policy.
 *
 * @param {string} password
 * @param {{ identifiers?: Array<string|null|undefined> }} [options]
 *   identifiers: username, email, Teacher ID, phone number, full name(s) to compare against.
 * @returns {{ valid: boolean, errors: string[], warnings: string[], score: number, label: string, percent: number }}
 */
export function validatePassword(password, options = {}) {
  const pw = String(password || '');
  const errors = [];
  const warnings = [];

  if (!pw) {
    return {
      valid: false,
      errors: [`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`],
      warnings: [],
      score: 0,
      label: STRENGTH_LABELS[0],
      percent: 0,
    };
  }

  if (pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }

  if (pw.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
  }

  if (/^\s|\s$/.test(pw)) {
    errors.push('Password cannot start or end with a space.');
  }

  const charSetCheck = meetsCharacterSet(pw, PASSWORD_REQUIRED_CHARACTER_SET);
  if (!charSetCheck.ok) {
    errors.push(charSetCheck.message);
  }

  if (isCommonPassword(pw)) {
    errors.push('This password is too common or easy to guess. Choose something less predictable.');
  }

  const { candidates, phoneCores } = buildIdentifierCandidates(options.identifiers || []);
  const pwAlnum = normalizeAlnum(pw);
  const pwDigits = pw.replace(/\D/g, '');

  if (pwAlnum && candidates.includes(pwAlnum)) {
    errors.push('Password cannot be the same as your username, email, Teacher ID, phone number, or name.');
  } else if (phoneCores.some((core) => core.length >= 10 && pwDigits.includes(core))) {
    errors.push('Password cannot contain your phone number.');
  } else if (
    candidates.some((c) => c.length >= 4 && !/^\d+$/.test(c) && pwAlnum.includes(c))
  ) {
    warnings.push('Avoid including your name, username, or Teacher ID in your password.');
  }

  if (pw.length >= PASSWORD_MIN_LENGTH && pw.length < PASSWORD_RECOMMENDED_LENGTH) {
    warnings.push(`${PASSWORD_RECOMMENDED_LENGTH}+ characters is recommended (try a short passphrase).`);
  }

  // --- Strength score (0–4) ---
  const classes =
    Number(/[a-z]/.test(pw)) +
    Number(/[A-Z]/.test(pw)) +
    Number(/\d/.test(pw)) +
    Number(/[^A-Za-z0-9]/.test(pw));

  let score;
  if (pw.length < PASSWORD_MIN_LENGTH) score = 0;
  else if (pw.length < PASSWORD_RECOMMENDED_LENGTH) score = 1;
  else if (pw.length < 16) score = 2;
  else score = 3;

  if (classes >= 3) score += 1;
  if (classes <= 1 && pw.length < 20) score -= 1;
  if (/(.)\1\1/.test(pw)) score -= 1; // 3+ repeated characters

  if (errors.length > 0) score = Math.min(score, pw.length < PASSWORD_MIN_LENGTH ? 0 : 1);
  score = Math.max(0, Math.min(4, score));

  if (errors.length === 0 && classes < 3 && pw.length < 16) {
    warnings.push('Mix uppercase, lowercase, numbers, and symbols for extra strength.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score,
    label: STRENGTH_LABELS[score],
    percent: ((score + 1) / 5) * 100,
  };
}

/**
 * Generates a cryptographically random password that satisfies the policy
 * (default 14 characters, all four character classes, no ambiguous characters).
 */
export function generateStrongPassword(length = 14) {
  const targetLength = Math.max(PASSWORD_RECOMMENDED_LENGTH, Math.min(length, PASSWORD_MAX_LENGTH));
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+?';
  const all = lower + upper + digits + symbols;

  const randomIndex = (max) => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  for (let attempt = 0; attempt < 20; attempt++) {
    const chars = [
      lower[randomIndex(lower.length)],
      upper[randomIndex(upper.length)],
      digits[randomIndex(digits.length)],
      symbols[randomIndex(symbols.length)],
    ];
    while (chars.length < targetLength) {
      chars.push(all[randomIndex(all.length)]);
    }
    // Fisher–Yates shuffle
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const candidate = chars.join('');
    if (validatePassword(candidate).valid) return candidate;
  }

  return `El${Date.now().toString(36)}!Hub#9`;
}
