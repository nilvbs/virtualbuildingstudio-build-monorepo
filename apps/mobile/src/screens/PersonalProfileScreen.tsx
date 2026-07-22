import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AccountType, AuthenticatedUser, OnboardingStatus, WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { colors, radius, shadows, spacing } from '../lib/theme';
import { AlertBox, BackButton, Button, Field } from '../components/ui';
import { AppHeader } from '../components/AppHeader';
import { FadeInUp } from '../components/motion';

const EMPTY_ADDRESS = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

function avatarIsUrl(value: string | null | undefined): boolean {
  return /^(https?:\/\/|\/)/.test(value ?? '');
}

export function PersonalProfileScreen({ role }: { role: WorkspaceRole }) {
  const navigation = useNavigation();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function applyOnboarding(onboarding: OnboardingStatus) {
    setAccountType(onboarding.accountType);
    setCompanyName(onboarding.companyName ?? '');
    setRegistrationNumber(onboarding.registrationNumber ?? '');
    setWebsite(onboarding.website ?? '');
    setAddress({
      line1: onboarding.address.line1 ?? '',
      line2: onboarding.address.line2 ?? '',
      city: onboarding.address.city ?? '',
      state: onboarding.address.state ?? '',
      postalCode: onboarding.address.postalCode ?? '',
      country: onboarding.address.country ?? '',
    });
  }

  const load = useCallback(async () => {
    setError(null);
    const [nextUser, onboarding] = await Promise.all([api.me(), api.getOnboarding()]);
    setUser(nextUser);
    setFullName(nextUser.fullName);
    applyOnboarding(onboarding);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().catch((err) => setError(errorMessage(err)));
    }, [load]),
  );

  function startEditing() {
    setSavedMessage(null);
    setError(null);
    setEditing(true);
  }

  async function cancelEditing() {
    setEditing(false);
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function save() {
    setBusy(true);
    setSavedMessage(null);
    setError(null);
    try {
      const isCompany = accountType === 'company';
      await api.updateMe({
        ...(role === 'client' || isCompany
          ? { companyName: companyName.trim() || null }
          : {}),
        address: {
          line1: address.line1.trim(),
          line2: address.line2.trim() ? address.line2.trim() : null,
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
          country: address.country.trim(),
        },
        ...(isCompany
          ? {
              registrationNumber: registrationNumber.trim() || null,
              website: website.trim() || null,
            }
          : {}),
      });
      await load();
      setEditing(false);
      setSavedMessage('Personal details saved.');
      DeviceEventEmitter.emit('bld:user-updated');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
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
    setUploadingPhoto(true);
    setSavedMessage(null);
    setError(null);
    try {
      const next = await api.uploadAvatar(
        {
          uri: asset.uri,
          name: asset.fileName ?? 'profile.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        },
        asset.fileName ?? 'profile.jpg',
      );
      setUser(next);
      setSavedMessage('Profile photo updated.');
      DeviceEventEmitter.emit('bld:user-updated');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploadingPhoto(false);
    }
  }

  const isCompany = accountType === 'company';
  const showCompanyName = role === 'client' || isCompany;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader showAccountMenu />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.accent}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await load();
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setRefreshing(false);
                }
              }}
            />
          }
        >
          <FadeInUp delay={20}>
            {navigation.canGoBack() ? (
              <BackButton label="Back" onPress={() => navigation.goBack()} />
            ) : null}
            <Text style={styles.title}>Personal profile</Text>
            <Text style={styles.lede}>Your identity, contact details, and verification status.</Text>
          </FadeInUp>

          {error ? <AlertBox message={error} /> : null}
          {savedMessage ? <AlertBox tone="success" message={savedMessage} /> : null}

          {!user && !error ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
          ) : null}

          {user ? (
            <FadeInUp delay={60}>
              <View style={styles.hero}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    {avatarIsUrl(user.avatarKey) ? (
                      <Image source={{ uri: user.avatarKey! }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{initials(user.fullName)}</Text>
                    )}
                  </View>
                  <Pressable
                    style={styles.avatarEdit}
                    disabled={uploadingPhoto}
                    onPress={() => void uploadPhoto()}
                    hitSlop={8}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Feather name="edit-2" size={13} color="#fff" />
                    )}
                  </Pressable>
                </View>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{user.fullName}</Text>
                  {user.emailVerified && user.phoneVerified ? (
                    <Feather name="check-circle" size={18} color="#2563eb" />
                  ) : null}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Contact details</Text>
                <InfoRow
                  icon="mail"
                  label="Email address"
                  value={user.email}
                  verified={user.emailVerified}
                />
                <View style={styles.divider} />
                <InfoRow
                  icon="phone"
                  label="Phone number"
                  value={user.phone || 'Not set'}
                  verified={user.phoneVerified}
                />
              </View>

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Personal details</Text>
                  {!editing ? (
                    <Pressable style={styles.editBtn} onPress={startEditing}>
                      <Feather name="edit-2" size={14} color={colors.navy} />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Field
                  label="Full name"
                  icon="user"
                  value={fullName}
                  editable={false}
                  autoCapitalize="words"
                />
                <Text style={styles.hint}>From your account · not editable here</Text>
                {showCompanyName ? (
                  <Field
                    label="Company name"
                    icon="briefcase"
                    value={companyName}
                    onChangeText={setCompanyName}
                    editable={editing}
                    autoCapitalize="words"
                    placeholder="Optional"
                  />
                ) : null}
                {isCompany ? (
                  <>
                    <Field
                      label="Registration number"
                      value={registrationNumber}
                      onChangeText={setRegistrationNumber}
                      editable={editing}
                    />
                    <Field
                      label="Website"
                      icon="globe"
                      value={website}
                      onChangeText={setWebsite}
                      editable={editing}
                      autoCapitalize="none"
                      placeholder="https://"
                    />
                  </>
                ) : null}
                <Field
                  label={isCompany ? 'Company address' : 'Base address'}
                  icon="map-pin"
                  value={address.line1}
                  onChangeText={(line1) => setAddress((a) => ({ ...a, line1 }))}
                  editable={editing}
                  placeholder="Address line 1"
                />
                <Field
                  label="Address line 2 (optional)"
                  value={address.line2}
                  onChangeText={(line2) => setAddress((a) => ({ ...a, line2 }))}
                  editable={editing}
                />
                <Field
                  label="City"
                  value={address.city}
                  onChangeText={(city) => setAddress((a) => ({ ...a, city }))}
                  editable={editing}
                />
                <Field
                  label="State / region"
                  value={address.state}
                  onChangeText={(state) => setAddress((a) => ({ ...a, state }))}
                  editable={editing}
                />
                <Field
                  label="Postal code"
                  value={address.postalCode}
                  onChangeText={(postalCode) => setAddress((a) => ({ ...a, postalCode }))}
                  editable={editing}
                />
                <Field
                  label="Country"
                  value={address.country}
                  onChangeText={(country) => setAddress((a) => ({ ...a, country }))}
                  editable={editing}
                />
                {editing ? (
                  <View style={styles.actions}>
                    <Button
                      label={busy ? 'Saving…' : 'Save changes'}
                      busy={busy}
                      onPress={() => void save()}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Cancel"
                      variant="outline"
                      disabled={busy}
                      onPress={() => void cancelEditing()}
                      style={{ flex: 1 }}
                    />
                  </View>
                ) : null}
              </View>
            </FadeInUp>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  verified,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  verified: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      <View style={[styles.badge, verified ? styles.badgeOk : styles.badgeWarn]}>
        <Feather
          name={verified ? 'check-circle' : 'x-circle'}
          size={13}
          color={verified ? colors.ok : colors.danger}
        />
        <Text style={[styles.badgeText, verified ? styles.badgeTextOk : styles.badgeTextWarn]}>
          {verified ? 'Verified' : 'Not verified'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48, gap: 14 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  lede: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 6 },
  hint: { color: colors.muted, fontSize: 12, marginTop: -6, marginBottom: 4 },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.ice, fontSize: 22, fontWeight: '800' },
  avatarEdit: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#00246B',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  card: {
    gap: 10,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
  },
  editBtnText: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeOk: { backgroundColor: colors.okSoft },
  badgeWarn: { backgroundColor: colors.dangerSoft },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextOk: { color: colors.ok },
  badgeTextWarn: { color: colors.danger },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
