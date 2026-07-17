import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthenticatedUser, OnboardingStatus, WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { getActiveRole } from '../lib/session';
import { homeForWorkspace } from '../lib/home';
import { colors, radius, shadows, spacing } from '../lib/theme';
import { AlertBox, Button, Field } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export function OnboardingScreen({ navigation }: Props) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roleRef = useRef<WorkspaceRole | null>(null);

  const finishHome = useCallback(
    async (role?: WorkspaceRole | null) => {
      const next = role ?? (await getActiveRole()) ?? 'client';
      navigation.reset({
        index: 0,
        routes: [{ name: homeForWorkspace(next) === 'client' ? 'ClientHome' : 'SurveyorHome' }],
      });
    },
    [navigation],
  );

  const load = useCallback(async () => {
    const next = await api.getOnboarding();
    setStatus(next);
    setFullName((current) => current || next.fullName);
    setCompanyName((current) => current || next.companyName || '');
    const role = (await getActiveRole()) ?? 'client';
    roleRef.current = role;
    if (next.step === 'done') await finishHome(role);
  }, [finishHome]);

  useEffect(() => {
    void load().catch((err) => setError(errorMessage(err)));
  }, [load]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitProfile() {
    await run('profile', () =>
      api.completeProfile({
        fullName,
        companyName: companyName.trim() ? companyName.trim() : null,
      }),
    );
  }

  async function uploadPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to upload a profile photo.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setBusy('photo');
    setError(null);
    try {
      const next: AuthenticatedUser = await api.uploadAvatar(
        {
          uri: asset.uri,
          name: asset.fileName ?? 'profile.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        },
        asset.fileName ?? 'profile.jpg',
      );
      setStatus((current) => (current ? { ...current, avatarKey: next.avatarKey } : current));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading onboarding…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const needsContact = status.step === 'verify_contact';
  const needsProfile = status.step === 'complete_profile';
  const needsPortfolio = status.step === 'portfolio';
  const role = roleRef.current ?? 'client';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>Account setup</Text>
          <Text style={styles.title}>
            {needsContact
              ? 'Verify your contact'
              : needsProfile
                ? 'Complete your personal profile'
                : 'Build your portfolio'}
          </Text>
          <Text style={styles.lede}>
            {needsContact
              ? 'Verify either your email or phone to continue. You can finish the other later.'
              : needsProfile
                ? 'Add your personal details before moving to the workspace.'
                : 'Add project examples next so clients can understand your work.'}
          </Text>

          {error ? <AlertBox message={error} /> : null}

          {needsContact ? (
            <View style={{ gap: 14 }}>
              <View style={styles.channel}>
                <Feather name="mail" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.channelTitle}>Email</Text>
                  <Text style={styles.channelCopy}>
                    {status.emailVerified ? 'Verified' : 'Enter the OTP sent to your inbox'}
                  </Text>
                </View>
                {status.emailVerified ? <Feather name="check-circle" size={18} color={colors.ok} /> : null}
              </View>
              {!status.emailVerified ? (
                <>
                  <Field
                    label="Email OTP"
                    icon="hash"
                    value={emailCode}
                    onChangeText={setEmailCode}
                    keyboardType="number-pad"
                  />
                  <Button
                    label={busy === 'email' ? 'Verifying…' : 'Verify email'}
                    busy={busy === 'email'}
                    onPress={() => void run('email', () => api.verifyEmail(emailCode))}
                  />
                  <Button
                    label={busy === 'email-start' ? 'Sending…' : 'Resend email code'}
                    variant="outline"
                    busy={busy === 'email-start'}
                    onPress={() => void run('email-start', () => api.startEmailVerification())}
                  />
                </>
              ) : null}

              <View style={styles.channel}>
                <Feather name="phone" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.channelTitle}>Phone</Text>
                  <Text style={styles.channelCopy}>
                    {status.phoneVerified ? 'Verified' : 'Enter the SMS OTP sent to your phone'}
                  </Text>
                </View>
                {status.phoneVerified ? <Feather name="check-circle" size={18} color={colors.ok} /> : null}
              </View>
              {!status.phoneVerified ? (
                <>
                  <Field
                    label="Phone OTP"
                    icon="hash"
                    value={phoneCode}
                    onChangeText={setPhoneCode}
                    keyboardType="number-pad"
                  />
                  <Button
                    label={busy === 'phone' ? 'Verifying…' : 'Verify phone'}
                    busy={busy === 'phone'}
                    onPress={() => void run('phone', () => api.verifyPhone(phoneCode))}
                  />
                  <Button
                    label={busy === 'phone-start' ? 'Sending…' : 'Resend SMS code'}
                    variant="outline"
                    busy={busy === 'phone-start'}
                    onPress={() => void run('phone-start', () => api.startPhoneVerification())}
                  />
                </>
              ) : null}
            </View>
          ) : null}

          {needsProfile ? (
            <View style={{ gap: 14 }}>
              <View style={styles.photoRow}>
                <View style={styles.avatar}>
                  {status.avatarKey ? (
                    <Image source={{ uri: status.avatarKey }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{initials(fullName)}</Text>
                  )}
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={styles.channelTitle}>Profile photo</Text>
                  <Text style={styles.channelCopy}>Optional · JPG, PNG, or WebP · up to 5 MB</Text>
                  <Button
                    label={
                      busy === 'photo'
                        ? 'Uploading…'
                        : status.avatarKey
                          ? 'Change photo'
                          : 'Upload photo'
                    }
                    variant="outline"
                    busy={busy === 'photo'}
                    icon="camera"
                    onPress={() => void uploadPhoto()}
                  />
                </View>
              </View>
              <Field
                label="Full name"
                icon="user"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
              {role === 'client' ? (
                <Field
                  label="Company name"
                  icon="briefcase"
                  value={companyName}
                  onChangeText={setCompanyName}
                  autoCapitalize="words"
                  placeholder="Optional"
                />
              ) : null}
              <Button
                label={busy === 'profile' ? 'Saving…' : 'Continue'}
                busy={busy === 'profile'}
                icon="arrow-right"
                onPress={() => void submitProfile()}
              />
            </View>
          ) : null}

          {needsPortfolio ? (
            <View style={{ gap: 12 }}>
              <Button
                label="Go to portfolio builder"
                icon="arrow-right"
                onPress={() =>
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'SurveyorHome' }],
                  })
                }
              />
              <Button
                label={busy === 'portfolio' ? 'Skipping…' : 'I’ll add portfolio later'}
                variant="outline"
                busy={busy === 'portfolio'}
                onPress={() => void run('portfolio', () => api.completePortfolio())}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted },
  content: { padding: spacing.xl, paddingBottom: 48 },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  lede: { color: colors.muted, fontSize: 14.5, lineHeight: 21, marginTop: 6, marginBottom: 20 },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  channelTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  channelCopy: { color: colors.muted, fontSize: 13, marginTop: 2 },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.ice, fontSize: 20, fontWeight: '800' },
});
