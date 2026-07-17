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
import type { AuthenticatedUser, WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { colors, radius, shadows, spacing } from '../lib/theme';
import { AlertBox, BackButton, Button, Field } from '../components/ui';
import { AppHeader } from '../components/AppHeader';
import { FadeInUp } from '../components/motion';

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
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [nextUser, onboarding] = await Promise.all([api.me(), api.getOnboarding()]);
    setUser(nextUser);
    setFullName(nextUser.fullName);
    setCompanyName(onboarding.companyName ?? '');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().catch((err) => setError(errorMessage(err)));
    }, [load]),
  );

  function startEditing() {
    if (!user) return;
    setFullName(user.fullName);
    setSavedMessage(null);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (!user) return;
    setFullName(user.fullName);
    setEditing(false);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setSavedMessage(null);
    setError(null);
    try {
      const next = await api.updateMe({
        fullName: fullName.trim(),
        ...(role === 'client' ? { companyName: companyName.trim() || null } : {}),
      });
      setUser(next);
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
                      <ActivityIndicator color={colors.ice} size="small" />
                    ) : (
                      <Feather name="edit-2" size={14} color={colors.ice} />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.name}>{user.fullName}</Text>
                <Text style={styles.role}>
                  {role === 'surveyor' ? 'Expert (surveyor)' : 'Client'}
                </Text>
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
                  onChangeText={setFullName}
                  editable={editing}
                  autoCapitalize="words"
                />
                {role === 'client' ? (
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
                      onPress={cancelEditing}
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
      <View style={[styles.badge, verified ? styles.badgeOk : styles.badgeBad]}>
        <Feather
          name={verified ? 'check-circle' : 'x-circle'}
          size={13}
          color={verified ? colors.ok : '#9b3b34'}
        />
        <Text style={[styles.badgeText, { color: verified ? colors.ok : '#9b3b34' }]}>
          {verified ? 'Verified' : 'Not verified'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  lede: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: spacing.lg },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  avatarWrap: { position: 'relative', marginBottom: spacing.md },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.ice,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.ice, fontSize: 24, fontWeight: '800' },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy,
    borderWidth: 3,
    borderColor: colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  role: { color: colors.muted, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft2,
    marginBottom: 12,
  },
  editBtnText: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeOk: { backgroundColor: 'rgba(5,150,105,0.12)' },
  badgeBad: { backgroundColor: '#fff0ee' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
