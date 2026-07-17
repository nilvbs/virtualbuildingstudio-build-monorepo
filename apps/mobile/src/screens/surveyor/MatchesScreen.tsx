import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { MatchStatus, SurveyorStatusMatch } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, Badge } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

function tone(status: MatchStatus): BadgeTone {
  if (status === 'accepted' || status === 'completed') return 'success';
  if (status === 'declined' || status === 'cancelled') return 'danger';
  return 'accent';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MatchesScreen() {
  const [matches, setMatches] = useState<SurveyorStatusMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const status = await api.getSurveyorStatus();
      setMatches(status.matches ?? []);
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
      <AppHeader showAccountMenu />
      <FlatList
        data={matches ?? []}
        keyExtractor={(m) => m.matchId}
        contentContainerStyle={styles.list}
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
        ListHeaderComponent={
          <FadeInUp delay={30}>
            <View style={styles.intro}>
              <Text style={styles.title}>Matches</Text>
              <Text style={styles.sub}>Projects our team has matched to you.</Text>
            </View>
            {error ? (
              <View style={{ marginTop: spacing.md }}>
                <AlertBox message={error} />
              </View>
            ) : null}
          </FadeInUp>
        }
        ListEmptyComponent={
          matches == null ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.accent} />
          ) : (
            <FadeInUp delay={80}>
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Feather name="zap" size={26} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>No matches yet</Text>
                <Text style={styles.emptyCopy}>
                  When the ops team matches you to a project, it will show up here.
                </Text>
              </View>
            </FadeInUp>
          )
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={60 + Math.min(index, 6) * 55}>
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <Feather name="briefcase" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.projectTitle}
                </Text>
                <Text style={styles.cardMeta}>Matched {formatDate(item.createdAt)}</Text>
              </View>
              <Badge label={item.status} tone={tone(item.status)} />
            </View>
          </FadeInUp>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  list: { padding: spacing.xl },
  intro: {
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardMeta: { color: colors.muted, marginTop: 3, fontSize: 13 },
  empty: {
    marginTop: 32,
    padding: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft2,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyCopy: { color: colors.muted, marginTop: 8, lineHeight: 20, textAlign: 'center', fontSize: 14 },
});
