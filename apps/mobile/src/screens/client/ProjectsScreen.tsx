import { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SURVEY_SERVICE_LABELS,
  clientProjectHeadline,
  type Project,
  type ProjectStatus,
} from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { firstName } from '../../lib/format';
import {
  clearProjectDraft,
  readProjectDraftSummary,
  type ProjectDraftSummary,
} from '../../lib/project-draft';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, Badge, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp, PressCard } from '../../components/motion';
import type { RootStackParamList } from '../../navigation/types';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

function statusTone(status: ProjectStatus): BadgeTone {
  switch (status) {
    case 'completed':
    case 'confirmed':
      return 'success';
    case 'cancelled':
      return 'danger';
    case 'matched':
      return 'accent';
    default:
      return 'neutral';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const OPEN_STATUSES: ProjectStatus[] = ['submitted', 'matching', 'matched', 'confirmed'];

export function ProjectsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [userName, setUserName] = useState('');
  const [draft, setDraft] = useState<ProjectDraftSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setDraft(await readProjectDraftSummary());
    try {
      const [rows, me] = await Promise.all([api.getProjects(), api.me()]);
      setProjects(rows);
      setUserName(me.firstName || firstName(me.fullName));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const stats = useMemo(() => {
    const rows = projects ?? [];
    return {
      total: rows.length,
      active: rows.filter((p) => OPEN_STATUSES.includes(p.status)).length,
      completed: rows.filter((p) => p.status === 'completed').length,
    };
  }, [projects]);

  async function discardDraft() {
    await clearProjectDraft();
    setDraft(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader showLogout showAccountMenu />

      <FlatList
        data={projects ?? []}
        keyExtractor={(p) => p.id}
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
              <View style={styles.introTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kicker}>Client workspace</Text>
                  <Text style={styles.title}>{projects == null ? 'Your projects' : `Hi ${userName || 'there'}`}</Text>
                  <Text style={styles.sub}>Post a brief and we&apos;ll notify nearby surveyors automatically.</Text>
                </View>
                <Button
                  label="Post"
                  icon="plus"
                  onPress={() => navigation.navigate('NewProject')}
                  style={styles.postBtn}
                />
              </View>
            </View>

            <View style={styles.stats}>
              {([
                ['All projects', stats.total],
                ['In progress', stats.active],
                ['Completed', stats.completed],
              ] as const).map(([label, value]) => (
                <View key={label} style={styles.stat}>
                  <Text style={styles.statLabel}>{label}</Text>
                  <Text style={styles.statValue}>{projects == null ? '—' : value}</Text>
                </View>
              ))}
            </View>

            {error ? (
              <View style={{ marginTop: spacing.md }}>
                <AlertBox message={error} />
              </View>
            ) : null}

            {draft ? (
              <View style={[styles.card, styles.draftCard]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <Feather name="edit-3" size={18} color={colors.accent} />
                  </View>
                  <Badge label="Draft" tone="warn" />
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {draft.title}
                </Text>
                <Text style={styles.cardMeta}>
                  Saved at {draft.stepLabel}
                  {draft.savedAt ? ` · ${formatDate(draft.savedAt)}` : ''}
                </Text>
                {(draft.locationText || draft.services.length > 0) && (
                  <View style={styles.facts}>
                    {draft.locationText ? (
                      <View style={styles.fact}>
                        <Feather name="map-pin" size={13} color={colors.faint} />
                        <Text style={styles.factText}>{draft.locationText}</Text>
                      </View>
                    ) : null}
                    {draft.services.length > 0 ? (
                      <Text style={styles.services}>
                        {draft.services
                          .slice(0, 2)
                          .map((s) => SURVEY_SERVICE_LABELS[s])
                          .join(' · ')}
                        {draft.services.length > 2 ? ` +${draft.services.length - 2}` : ''}
                      </Text>
                    ) : null}
                  </View>
                )}
                <View style={styles.draftActions}>
                  <Button
                    label="Discard"
                    icon="trash-2"
                    variant="outline"
                    onPress={() => void discardDraft()}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Continue"
                    icon="arrow-right"
                    onPress={() => navigation.navigate('NewProject')}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : null}

            {projects && projects.length > 0 ? (
              <Text style={styles.sectionTitle}>Your projects · {stats.total}</Text>
            ) : null}
          </FadeInUp>
        }
        ListEmptyComponent={
          projects == null ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.accent} />
          ) : draft ? (
            <Text style={styles.draftOnly}>
              No published projects yet — finish your draft when you&apos;re ready.
            </Text>
          ) : (
            <FadeInUp delay={80}>
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Feather name="folder-plus" size={26} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptyCopy}>
                  Post a project with the guided brief — we&apos;ll match you to a vetted surveyor.
                </Text>
                <Button
                  label="Post a project"
                  icon="plus"
                  onPress={() => navigation.navigate('NewProject')}
                  style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
                />
              </View>
            </FadeInUp>
          )
        }
        renderItem={({ item, index }) => {
          const { headline } = clientProjectHeadline(item.status);
          const services = item.services.slice(0, 2).map((s) => SURVEY_SERVICE_LABELS[s]);
          const extra = item.services.length - services.length;
          return (
            <FadeInUp delay={60 + Math.min(index, 6) * 55}>
              <PressCard
                style={styles.card}
                onPress={() => navigation.navigate('ProjectDetail', { id: item.id })}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <Feather name="home" size={18} color={colors.accent} />
                  </View>
                  <Badge label={item.status} tone={statusTone(item.status)} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={2}>
                  {headline}
                </Text>

                {(item.locationText || services.length > 0) && (
                  <View style={styles.facts}>
                    {item.locationText ? (
                      <View style={styles.fact}>
                        <Feather name="map-pin" size={13} color={colors.faint} />
                        <Text style={styles.factText}>{item.locationText}</Text>
                      </View>
                    ) : null}
                    {services.length > 0 ? (
                      <Text style={styles.services}>
                        {services.join(' · ')}
                        {extra > 0 ? ` +${extra}` : ''}
                      </Text>
                    ) : null}
                  </View>
                )}

                <View style={styles.cardFoot}>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                  <View style={styles.openRow}>
                    <Text style={styles.open}>Open</Text>
                    <Feather name="arrow-right" size={14} color={colors.accent} />
                  </View>
                </View>
              </PressCard>
            </FadeInUp>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  list: { padding: spacing.xl, paddingTop: spacing.lg },
  intro: {
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  introTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  postBtn: { paddingHorizontal: 14, minWidth: 96 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  statLabel: { fontSize: 11.5, fontWeight: '700', color: colors.muted },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  draftCard: { borderStyle: 'dashed', borderColor: colors.borderStrong },
  draftActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  draftOnly: { color: colors.muted, fontSize: 13.5, textAlign: 'center', marginTop: spacing.sm },
  sectionTitle: { fontSize: 15.5, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  cardMeta: { color: colors.muted, marginTop: 5, fontSize: 13.5, lineHeight: 19 },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factText: { color: colors.muted, fontSize: 13 },
  services: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  date: { color: colors.faint, fontSize: 12.5 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  open: { color: colors.accent, fontSize: 13.5, fontWeight: '800' },
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
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyCopy: {
    color: colors.muted,
    marginTop: 8,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 14,
  },
});
