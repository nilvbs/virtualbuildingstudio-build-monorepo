import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { AuthenticatedUser } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export function ClientProfileScreen() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUser(await api.me());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <FadeInUp delay={20}>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.lede}>Account details for your client workspace.</Text>
        </FadeInUp>

        {error ? <AlertBox message={error} /> : null}

        {!user && !error ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : null}

        {user ? (
          <FadeInUp delay={60}>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(user.fullName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{user.fullName}</Text>
                <Text style={styles.role}>Client</Text>
              </View>
            </View>

            <View style={styles.card}>
              <InfoRow icon="mail" label="Email" value={user.email} />
              <View style={styles.divider} />
              <InfoRow icon="phone" label="Phone" value={user.phone || 'Not set'} />
              <View style={styles.divider} />
              <InfoRow
                icon="shield"
                label="Email verified"
                value={user.emailVerified ? 'Verified' : 'Not verified'}
              />
            </View>

            <View style={styles.hint}>
              <Feather name="info" size={16} color={colors.accent} />
              <Text style={styles.hintText}>
                To update your details or post a new project, use the web app. Sign out from the
                Projects home screen.
              </Text>
            </View>
          </FadeInUp>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  lede: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: spacing.lg },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.ice, fontSize: 18, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  role: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 3 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
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
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  hint: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintText: { flex: 1, color: colors.muted, fontSize: 13.5, lineHeight: 20 },
});
