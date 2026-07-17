import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { SurveyorStatus } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import type { RootStackParamList, SurveyorTabParamList } from '../../navigation/types';

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<SurveyorTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNav>();
  const [status, setStatus] = useState<SurveyorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await api.getSurveyorStatus());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pct = status?.completionPercent ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader showLogout showAccountMenu />

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
        <Text style={styles.title}>Dashboard</Text>

        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <AlertBox message={error} />
          </View>
        ) : null}

        {!status && !error ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : null}

        {status ? (
          <>
            {(() => {
              const live = status.isMatchable;
              const incomplete = !status.profileComplete;
              const preferenceOn = status.matchablePreference ?? false;
              const chip = live ? 'LIVE' : incomplete ? 'INCOMPLETE' : 'PAUSED';
              const title = live
                ? 'Receiving matches'
                : incomplete
                  ? preferenceOn
                    ? 'Almost ready — finish your portfolio'
                    : 'Portfolio incomplete'
                  : 'Not receiving matches';
              const copy = live
                ? 'Your portfolio is active. The ops team can match you to nearby projects.'
                : incomplete
                  ? preferenceOn
                    ? `Matchable is on in your portfolio, but you are ${status.completionPercent}% complete. Matching goes live at 100% (map location is required).`
                    : `Your portfolio is ${status.completionPercent}% complete. Finish it, then turn Matchable on to go live.`
                  : 'Matching is off. Turn Matchable on in your portfolio when you are ready for new work.';
              const iconName = live ? 'radio' : incomplete ? 'alert-circle' : 'pause-circle';
              const iconColor = live ? colors.ok : incomplete ? colors.accent : colors.text;
              const iconBg = live
                ? 'rgba(5,150,105,0.15)'
                : incomplete
                  ? colors.accentSoft
                  : colors.accentSoft2;
              const chipColor = live ? colors.ok : incomplete ? colors.accent : colors.muted;
              const cardStyle = live
                ? styles.statusLive
                : incomplete
                  ? styles.statusIncomplete
                  : styles.statusPaused;

              return (
                <View style={[styles.statusCard, cardStyle]}>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusIcon, { backgroundColor: iconBg }]}>
                      <Feather name={iconName} size={22} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.statusChip, { color: chipColor }]}>{chip}</Text>
                      <Text style={styles.statusTitle}>{title}</Text>
                    </View>
                  </View>
                  <Text style={styles.statusCopy}>{copy}</Text>
                  {!live ? (
                    <Button
                      label={incomplete ? 'Finish portfolio' : 'Open portfolio'}
                      icon={incomplete ? 'arrow-right' : 'briefcase'}
                      variant="outline"
                      onPress={() => navigation.navigate('Portfolio')}
                      style={{ marginTop: 4 }}
                    />
                  ) : null}
                </View>
              );
            })()}

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardLabel}>Portfolio completion</Text>
                <Text style={styles.pct}>{pct}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(6, pct)}%` as `${number}%` }]} />
              </View>
              <Text style={styles.cardCopy}>
                {status.profileComplete
                  ? 'Keep your coverage and rates up to date.'
                  : 'Add map location and any missing fields to unlock matching.'}
              </Text>
              {!status.profileComplete ? (
                <Button
                  label="Finish portfolio"
                  icon="arrow-right"
                  onPress={() => navigation.navigate('Portfolio')}
                />
              ) : null}
            </View>

            <Pressable style={styles.statBtn} onPress={() => navigation.navigate('Matches')}>
              <View style={styles.statIcon}>
                <Feather name="zap" size={18} color={colors.accent2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statTitle}>Matches</Text>
                <Text style={styles.statCopy}>
                  {(status.matches?.length ?? 0) === 0
                    ? 'No matches yet'
                    : `${status.matches.length} match${status.matches.length === 1 ? '' : 'es'} waiting`}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.faint} />
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  statusCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  statusLive: {
    backgroundColor: colors.okSoft,
    borderColor: 'rgba(5,150,105,0.2)',
  },
  statusIncomplete: {
    backgroundColor: colors.accentSoft2,
    borderColor: colors.border,
  },
  statusPaused: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChip: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statusTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  statusCopy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: {
    color: colors.muted,
    fontSize: 12.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pct: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft2,
    overflow: 'hidden',
    marginVertical: 6,
  },
  fill: { height: 8, borderRadius: 999, backgroundColor: colors.accent },
  cardCopy: { color: colors.muted, lineHeight: 20, fontSize: 14, marginBottom: 4 },
  statBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  statCopy: { color: colors.muted, fontSize: 13.5, marginTop: 2 },
});
