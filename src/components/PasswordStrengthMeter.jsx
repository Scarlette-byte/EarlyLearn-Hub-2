import { useMemo } from 'react';
import Icon from './Icons.jsx';
import {
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RECOMMENDED_LENGTH,
} from '../lib/passwordPolicy.js';

const BAR_COLORS = [
  'bg-rose-500',
  'bg-orange-400',
  'bg-amber-400',
  'bg-emerald-500',
  'bg-emerald-700',
];

const TEXT_COLORS = [
  'text-rose-600',
  'text-orange-600',
  'text-amber-700',
  'text-emerald-700',
  'text-emerald-800',
];

/**
 * Shared password strength meter + policy feedback.
 *
 * @param {{ password: string, identifiers?: Array<string|null|undefined>, className?: string }} props
 */
export default function PasswordStrengthMeter({ password, identifiers = [], className = '' }) {
  const result = useMemo(
    () => validatePassword(password, { identifiers }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [password, JSON.stringify(identifiers)]
  );

  if (!password) {
    return (
      <p className={`text-[11px] text-slate-500 mt-1 m-0 text-left ${className}`}>
        Use at least {PASSWORD_MIN_LENGTH} characters ({PASSWORD_RECOMMENDED_LENGTH}+ recommended). Avoid common
        passwords and your username or phone number.
      </p>
    );
  }

  return (
    <div className={`mt-1.5 space-y-1 text-left ${className}`} aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-5 gap-1" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-colors ${
                i <= result.score ? BAR_COLORS[result.score] : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-bold whitespace-nowrap ${TEXT_COLORS[result.score]}`}>
          {result.label}
        </span>
      </div>

      {result.errors.length > 0 && (
        <ul className="m-0 pl-4 text-[11px] text-rose-600 font-semibold space-y-0.5 list-disc">
          {result.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      {result.errors.length === 0 && result.warnings.length > 0 && (
        <ul className="m-0 pl-4 text-[11px] text-amber-700 space-y-0.5 list-disc">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {result.valid && result.warnings.length === 0 && (
        <p className="m-0 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
          <Icon name="check" size={13} />
          <span>Meets password requirements</span>
        </p>
      )}
    </div>
  );
}
