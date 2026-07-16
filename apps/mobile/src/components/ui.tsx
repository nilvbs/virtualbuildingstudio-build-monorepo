import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, shadows, spacing } from '../lib/theme';

type FeatherName = keyof typeof Feather.glyphMap;

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function IconCircle({
  name,
  size = 20,
  color = colors.accent,
  bg = colors.accentSoft,
  dim = 44,
}: {
  name: FeatherName;
  size?: number;
  color?: string;
  bg?: string;
  dim?: number;
}) {
  return (
    <View style={[styles.iconCircle, { width: dim, height: dim, borderRadius: dim / 3, backgroundColor: bg }]}>
      <Feather name={name} size={size} color={color} />
    </View>
  );
}

export function Button({
  label,
  onPress,
  busy,
  variant = 'solid',
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'solid' | 'ghost' | 'outline';
  disabled?: boolean;
  icon?: FeatherName;
  style?: ViewStyle;
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.btn,
        solid && styles.btnSolid,
        solid && shadows.accent,
        variant === 'ghost' && styles.btnGhost,
        variant === 'outline' && styles.btnOutline,
        (disabled || busy) && styles.btnDisabled,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={solid ? colors.ice : colors.accent} />
      ) : icon ? (
        <Feather name={icon} size={18} color={solid ? colors.ice : colors.text} />
      ) : null}
      <Text style={[styles.btnText, solid ? styles.btnTextSolid : styles.btnTextMuted]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  icon,
  ...props
}: { label: string; icon?: FeatherName } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {icon ? <Feather name={icon} size={17} color={colors.faint} style={styles.inputIcon} /> : null}
        <TextInput
          placeholderTextColor={colors.faint}
          style={[styles.input, icon ? styles.inputWithIcon : null]}
          autoCapitalize="none"
          {...props}
        />
      </View>
    </View>
  );
}

/** Official multicolor Google "G" — same glyph as web `google-button.tsx`. */
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" accessibilityElementsHidden>
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </Svg>
  );
}

export function GoogleButton({
  label = 'Continue with Google',
  onPress,
  busy,
  disabled,
}: {
  label?: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.google,
        (disabled || busy) && styles.btnDisabled,
        pressed && { opacity: 0.9 },
      ]}
    >
      {busy ? <ActivityIndicator color={colors.accent} /> : <GoogleGlyph />}
      <Text style={styles.googleText}>{busy ? 'Connecting…' : label}</Text>
    </Pressable>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger';
  icon?: FeatherName;
}) {
  const map = {
    neutral: { bg: colors.accentSoft, fg: colors.accent },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    success: { bg: colors.okSoft, fg: colors.ok },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      {icon ? <Feather name={icon} size={12} color={map.fg} /> : null}
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

export function BackButton({
  onPress,
  label,
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
    >
      <View style={styles.backIcon}>
        <Feather name="chevron-left" size={22} color={colors.text} />
      </View>
      {label ? <Text style={styles.backLabel}>{label}</Text> : null}
    </Pressable>
  );
}

export function AlertBox({
  tone = 'error',
  message,
}: {
  tone?: 'error' | 'info' | 'success';
  message: string;
}) {
  const icon: FeatherName = tone === 'success' ? 'check-circle' : tone === 'info' ? 'info' : 'alert-circle';
  const fg = tone === 'success' ? colors.ok : tone === 'info' ? colors.accent : colors.danger;
  return (
    <View
      style={[
        styles.alert,
        tone === 'error' && styles.alertError,
        tone === 'info' && styles.alertInfo,
        tone === 'success' && styles.alertSuccess,
      ]}
    >
      <Feather name={icon} size={16} color={fg} />
      <Text style={[styles.alertText, { color: fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  btn: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnSolid: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: 'transparent' },
  btnOutline: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.borderStrong },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: 15.5, fontWeight: '700' },
  btnTextSolid: { color: colors.ice },
  btnTextMuted: { color: colors.text },
  field: { gap: 6, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  inputWrap: { justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 14, zIndex: 1 },
  input: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  inputWithIcon: { paddingLeft: 40 },
  google: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  googleText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.faint, fontSize: 13, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertError: { backgroundColor: colors.dangerSoft },
  alertInfo: { backgroundColor: colors.accentSoft },
  alertSuccess: { backgroundColor: colors.okSoft },
  alertText: { fontSize: 13.5, lineHeight: 19, flex: 1, fontWeight: '500' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  backIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  backLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
