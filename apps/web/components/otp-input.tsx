'use client';

import {
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { motion, useReducedMotion } from 'motion/react';

const DIGITS = 6;

function onlyDigits(raw: string, max = DIGITS): string {
  return raw.replace(/\D/g, '').slice(0, max);
}

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Fires once when all boxes are filled. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Accessible label for the group. */
  label?: string;
  className?: string;
};

/**
 * Six single-digit OTP boxes with paste + autofill support and soft pop animation.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  label = 'Verification code',
  className,
}: OtpInputProps) {
  const groupId = useId();
  const reduceMotion = useReducedMotion();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const completedRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const digits = onlyDigits(value).padEnd(DIGITS, ' ').slice(0, DIGITS).split('');
  const filled = onlyDigits(value);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const t = window.setTimeout(() => refs.current[0]?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (filled.length !== DIGITS) {
      completedRef.current = null;
      return;
    }
    if (completedRef.current === filled) return;
    completedRef.current = filled;
    onCompleteRef.current?.(filled);
  }, [filled]);

  function setAt(index: number, digit: string) {
    const next = onlyDigits(value).split('');
    while (next.length < DIGITS) next.push('');
    next[index] = digit;
    const joined = onlyDigits(next.join(''));
    onChange(joined);
    return joined;
  }

  function focusIndex(index: number) {
    const el = refs.current[Math.max(0, Math.min(DIGITS - 1, index))];
    el?.focus();
    el?.select();
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Autofill / paste into a single box may dump the whole code.
    const cleaned = onlyDigits(raw);
    if (cleaned.length > 1) {
      onChange(cleaned);
      focusIndex(Math.min(cleaned.length, DIGITS) - 1);
      return;
    }
    if (cleaned.length === 0) {
      setAt(index, '');
      return;
    }
    setAt(index, cleaned);
    if (index < DIGITS - 1) focusIndex(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const current = onlyDigits(value);
      if (digits[index]?.trim()) {
        setAt(index, '');
        return;
      }
      if (index > 0) {
        setAt(index - 1, '');
        focusIndex(index - 1);
      } else if (current.length) {
        onChange(current.slice(0, -1));
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusIndex(index - 1);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusIndex(index + 1);
      return;
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = onlyDigits(e.clipboardData.getData('text'));
    if (!pasted) return;
    onChange(pasted);
    focusIndex(Math.min(pasted.length, DIGITS) - 1);
  }

  return (
    <div
      className={`otp-input${className ? ` ${className}` : ''}${disabled ? ' is-disabled' : ''}`}
      role="group"
      aria-labelledby={groupId}
    >
      <span id={groupId} className="otp-input-label">
        {label}
      </span>
      <div className="otp-input-row">
        {digits.map((char, index) => {
          const digit = char.trim();
          const isFilled = Boolean(digit);
          const isActive = filled.length === index;
          return (
            <motion.div
              key={index}
              className={`otp-cell${isFilled ? ' is-filled' : ''}${isActive ? ' is-active' : ''}`}
              animate={
                reduceMotion
                  ? undefined
                  : isFilled
                    ? { scale: [1, 1.08, 1], y: [0, -3, 0] }
                    : { scale: 1, y: 0 }
              }
              transition={{ type: 'spring', stiffness: 420, damping: 22, mass: 0.55 }}
            >
              <input
                ref={(el) => {
                  refs.current[index] = el;
                }}
                className="otp-cell-input"
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={index === 0 ? DIGITS : 1}
                value={digit}
                disabled={disabled}
                aria-label={`Digit ${index + 1} of ${DIGITS}`}
                onChange={(e) => handleChange(index, e)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
              />
              {!isFilled && isActive ? <span className="otp-caret" aria-hidden /> : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
