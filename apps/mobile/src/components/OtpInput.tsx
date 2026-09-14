import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, shadows } from '../lib/theme';

const DIGITS = 6;

function onlyDigits(raw: string, max = DIGITS): string {
  return raw.replace(/\D/g, '').slice(0, max);
}

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
};

/**
 * Six single-digit OTP boxes with paste support and a soft pop on each fill.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  label = 'Verification code',
}: OtpInputProps) {
  const refs = useRef<Array<TextInput | null>>([]);
  const scales = useRef(Array.from({ length: DIGITS }, () => new Animated.Value(1))).current;
  const completedRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [focused, setFocused] = useState(0);
  const filled = onlyDigits(value);
  const digits = Array.from({ length: DIGITS }, (_, i) => filled[i] ?? '');

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const t = setTimeout(() => refs.current[0]?.focus(), 60);
    return () => clearTimeout(t);
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

  function pop(index: number) {
    const scale = scales[index];
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function focusIndex(index: number) {
    const next = Math.max(0, Math.min(DIGITS - 1, index));
    refs.current[next]?.focus();
    setFocused(next);
  }

  function applyValue(next: string, preferFocus?: number) {
    const cleaned = onlyDigits(next);
    const prevLen = filled.length;
    onChange(cleaned);
    if (cleaned.length > prevLen) {
      for (let i = prevLen; i < cleaned.length; i += 1) pop(i);
    }
    if (preferFocus != null) focusIndex(preferFocus);
    else if (cleaned.length < DIGITS) focusIndex(cleaned.length);
    else focusIndex(DIGITS - 1);
  }

  function onChangeText(index: number, text: string) {
    const cleaned = onlyDigits(text);
    if (cleaned.length > 1) {
      applyValue(cleaned);
      return;
    }
    const next = digits.slice();
    if (cleaned.length === 0) {
      next[index] = '';
      applyValue(next.join(''), index > 0 ? index - 1 : 0);
      return;
    }
    next[index] = cleaned;
    applyValue(next.join(''), index < DIGITS - 1 ? index + 1 : index);
  }

  function onKeyPress(index: number, key: string) {
    if (key !== 'Backspace') return;
    if (digits[index]) return;
    if (index > 0) {
      const next = digits.slice();
      next[index - 1] = '';
      applyValue(next.join(''), index - 1);
    }
  }

  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {digits.map((digit, index) => {
          const isFilled = Boolean(digit);
          const isActive = focused === index;
          return (
            <Animated.View
              key={index}
              style={[
                styles.cell,
                isFilled && styles.cellFilled,
                isActive && styles.cellActive,
                { transform: [{ scale: scales[index] }] },
              ]}
            >
              <TextInput
                ref={(el) => {
                  refs.current[index] = el;
                }}
                style={styles.input}
                value={digit}
                onChangeText={(text) => onChangeText(index, text)}
                onKeyPress={(e) => onKeyPress(index, e.nativeEvent.key)}
                onFocus={() => setFocused(index)}
                keyboardType="number-pad"
                textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                autoComplete={index === 0 ? 'sms-otp' : 'off'}
                maxLength={index === 0 ? DIGITS : 1}
                editable={!disabled}
                selectTextOnFocus
                caretHidden
                importantForAutofill={index === 0 ? 'yes' : 'no'}
              />
              {!isFilled && isActive ? <View style={styles.caret} pointerEvents="none" /> : null}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    position: 'relative',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellFilled: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    ...shadows.sm,
  },
  cellActive: {
    borderColor: colors.sky,
    shadowColor: colors.sky,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  input: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    padding: 0,
  },
  caret: {
    position: 'absolute',
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
});
