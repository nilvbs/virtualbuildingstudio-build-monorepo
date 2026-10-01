import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MatchStatus, SurveyorRequest } from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { firstName } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';
import { AlertBox, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';
import { FeedbackForm } from '../../components/FeedbackForm';
import { SurveyorProjectCard } from '../../components/SurveyorProjectCard';
import type { SurveyorTabParamList } from '../../navigation/types';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

function tone(status: MatchStatus): BadgeTone {
  if (status === 'accepted' || status === 'completed') return 'success';
  if (status === 'declined' || status === 'cancelled') return 'danger';
  return 'accent';
}

function introCopy(count: number): string {
  if (count === 0) return 'Accepted projects will show up here with site details and distance from your base.';
  if (count === 1) return 'Here’s your accepted project — site details and travel distance included.';
  return `Here’s your accepted work — ${count} projects with site details and distances.`;
}

export function MatchesScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<SurveyorTabParamList>>();
  const [matches, setMatches] = useState<SurveyorRequest[] | null>(null);
  const [profileComplete, setProfileComplete] = useState(true);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [status, rows, me] = await Promise.all([
        api.getSurveyorStatus(),
        api.getSurveyorMatches(),
        api.me(),
      ]);
      setProfileComplete(status.profileComplete);
      setCompletionPercent(status.completionPercent);
      setMatches(rows);
      setUserName(me.fullName ?? '');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const count = matches?.length ?? 0;
  const gated = matches != null && !profileComplete;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader showAccountMenu />
      <FlatList
        data={gated ? [] : (matches ?? [])}
        keyExtractor={(m) => m.matchId}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            {!gated ? (
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
            ) : null}
            {error ? (
              <View style={{ marginBottom: spacing.md }}>
                <AlertBox message={error} />
              </View>
            ) : null}
          </FadeInUp>
        }
        ListEmptyComponent={
          matches == null ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.accent} />
          ) : gated ? (
            <FadeInUp delay={60}>
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Feather name="briefcase" size={26} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Complete your portfolio first</Text>
                <Text style={styles.emptyCopy}>
                  Matches appear once your portfolio is 100% complete and you accept a project request.
                </Text>
                <Button
                  label={`Finish portfolio · ${completionPercent}%`}
                  icon="arrow-right"
                  onPress={() => navigation.navigate('Portfolio')}
                  style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
                />
              </View>
            </FadeInUp>
          ) : (
            <FadeInUp delay={80}>
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Feather name="check-circle" size={26} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>No accepted matches yet</Text>
                <Text style={styles.emptyCopy}>
                  When you accept a project from Requests, it lands here. Declined requests stay hidden.
                </Text>
                <Button
                  label="Open Requests"
                  icon="inbox"
                  variant="outline"
                  onPress={() => navigation.navigate('Requests')}
                  style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
                />
              </View>
            </FadeInUp>
          )
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={60 + Math.min(index, 6) * 55}>
            <SurveyorProjectCard
              request={item}
              pill={{ label: item.status, tone: tone(item.status) }}
              clientPrefix="With"
              datePrefix="Accepted"
            >
              {item.canLeaveFeedback ? (
                <FeedbackForm
                  matchId={item.matchId}
                  projectTitle={item.project.title}
                  role="surveyor"
                  onSubmitted={() => void load()}
                />
              ) : null}
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
  empty: {
    marginTop: 16,
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
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptyCopy: { color: colors.muted, marginTop: 8, lineHeight: 20, textAlign: 'center', fontSize: 14 },
});
