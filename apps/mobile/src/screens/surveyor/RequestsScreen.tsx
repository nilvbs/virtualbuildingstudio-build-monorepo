import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { SurveyorRequest } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { firstName } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';
import { AlertBox, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';
import { SurveyorProjectCard } from '../../components/SurveyorProjectCard';

function introCopy(count: number): string {
  if (count === 0) return 'You’re all caught up — new fitted projects will land here.';
  if (count === 1) return 'You’ve got a project waiting. Take a look and accept if it’s a fit.';
  return `You’ve got ${count} projects waiting. Review each one and accept the ones that fit.`;
}

export function RequestsScreen() {
  const [requests, setRequests] = useState<SurveyorRequest[] | null>(null);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [rows, me] = await Promise.all([api.getSurveyorRequests(), api.me()]);
      setRequests(rows);
      setUserName(me.fullName ?? '');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => {
        void api
          .getSurveyorRequests()
          .then(setRequests)
          .catch(() => undefined);
      }, 20_000);
      return () => clearInterval(id);
    }, [load]),
  );

  const act = useCallback(async (matchId: string, kind: 'accept' | 'decline') => {
    setActingId(matchId);
    setError(null);
    try {
      if (kind === 'accept') await api.acceptMatch(matchId);
      else await api.declineMatch(matchId);
      setRequests((prev) => (prev ?? []).filter((row) => row.matchId !== matchId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActingId(null);
    }
  }, []);

  const count = requests?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader showAccountMenu />
      <FlatList
        data={requests ?? []}
        keyExtractor={(item) => item.matchId}
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
              <View style={styles.titleRow}>
                <Text style={styles.title}>Hi {firstName(userName)}</Text>
                {count > 0 ? (
                  <View style={styles.count}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.sub}>{introCopy(count)}</Text>
            </View>
            {error ? (
              <View style={{ marginBottom: spacing.md }}>
                <AlertBox message={error} />
              </View>
            ) : null}
          </FadeInUp>
        }
        ListEmptyComponent={
          requests == null ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.accent} />
          ) : (
            <FadeInUp delay={80}>
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Feather name="inbox" size={26} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptyCopy}>When a project is matched to you, it will appear here.</Text>
              </View>
            </FadeInUp>
          )
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={60 + Math.min(index, 6) * 55}>
            <SurveyorProjectCard
              request={item}
              pill={{ label: 'Incoming', tone: 'warn' }}
              clientPrefix="From"
              showTimer
            >
              <View style={styles.actions}>
                <Button
                  label="Accept"
                  icon="check-circle"
                  onPress={() => void act(item.matchId, 'accept')}
                  busy={actingId === item.matchId}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Decline"
                  icon="x-circle"
                  variant="outline"
                  onPress={() => void act(item.matchId, 'decline')}
                  disabled={actingId === item.matchId}
                  style={{ flex: 1 }}
                />
              </View>
            </SurveyorProjectCard>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  count: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: colors.ice, fontWeight: '800', fontSize: 13 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm },
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
