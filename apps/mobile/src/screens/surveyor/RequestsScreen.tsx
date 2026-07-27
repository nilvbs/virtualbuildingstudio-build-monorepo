import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { SurveyorRequest } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, Badge, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function RequestsScreen() {
  const [requests, setRequests] = useState<SurveyorRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await api.getSurveyorRequests();
      setRequests(rows);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const accept = useCallback(async (matchId: string) => {
    setActingId(matchId);
    setError(null);
    try {
      await api.acceptMatch(matchId);
      setRequests((prev) => (prev ?? []).filter((row) => row.matchId !== matchId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActingId(null);
    }
  }, []);

  const decline = useCallback(async (matchId: string) => {
    setActingId(matchId);
    setError(null);
    try {
      await api.declineMatch(matchId);
      setRequests((prev) => (prev ?? []).filter((row) => row.matchId !== matchId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActingId(null);
    }
  }, []);

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
              <Text style={styles.title}>My Requests</Text>
              <Text style={styles.sub}>Review project requests and accept or decline.</Text>
            </View>
            {error ? (
              <View style={{ marginTop: spacing.md }}>
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
                <Text style={styles.emptyCopy}>
                  New project requests will appear here for your decision.
                </Text>
              </View>
            </FadeInUp>
          )
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={60 + Math.min(index, 6) * 55}>
            <View style={styles.card}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.project.title}</Text>
                  <Text style={styles.cardMeta}>
                    {item.client.fullName}
                    {item.client.companyName ? ` · ${item.client.companyName}` : ''}
                  </Text>
                </View>
                <Badge label={item.status} tone="warn" />
              </View>

              <View style={styles.details}>
                {item.project.locationText ? (
                  <Text style={styles.detailText}>Location: {item.project.locationText}</Text>
                ) : null}
                {item.project.buildingType ? (
                  <Text style={styles.detailText}>
                    Building: {item.project.buildingType}
                    {item.project.buildingAge ? ` · ${item.project.buildingAge}` : ''}
                  </Text>
                ) : null}
                {item.project.floors != null ? (
                  <Text style={styles.detailText}>Floors: {item.project.floors}</Text>
                ) : null}
                {item.project.areaSqft != null ? (
                  <Text style={styles.detailText}>Area: {item.project.areaSqft.toLocaleString()} sq ft</Text>
                ) : null}
                {item.project.neededWithin ? (
                  <Text style={styles.detailText}>Timeline: {item.project.neededWithin}</Text>
                ) : null}
                {item.project.services.length > 0 ? (
                  <Text style={styles.detailText}>Services: {item.project.services.join(', ')}</Text>
                ) : null}
                {item.project.notes ? (
                  <Text style={styles.noteText}>Notes: {item.project.notes}</Text>
                ) : null}
              </View>

              <Text style={styles.cardMeta}>Requested {formatDate(item.createdAt)}</Text>

              <View style={styles.actions}>
                <Button
                  label="Accept"
                  icon="check-circle"
                  onPress={() => accept(item.matchId)}
                  busy={actingId === item.matchId}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Decline"
                  icon="x-circle"
                  variant="outline"
                  onPress={() => decline(item.matchId)}
                  busy={actingId === item.matchId}
                  style={{ flex: 1 }}
                />
              </View>
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
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardMeta: { color: colors.muted, marginTop: 3, fontSize: 13 },
  details: { gap: 5 },
  detailText: { color: colors.text, fontSize: 13.5, lineHeight: 20 },
  noteText: { color: colors.text, fontSize: 13.5, lineHeight: 20 },
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
