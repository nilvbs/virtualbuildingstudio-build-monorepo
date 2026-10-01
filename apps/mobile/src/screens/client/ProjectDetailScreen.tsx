import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  PROJECT_OCCUPANCY_SHORT_LABELS,
  SURVEY_SERVICE_LABELS,
  clientProjectHeadline,
  type ProjectDetail,
  type ProjectStatus,
  type SurveyService,
} from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { openStreetView } from '../../lib/street-view';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, BackButton, Badge, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';
import { FeedbackForm } from '../../components/FeedbackForm';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;
type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

const FINDING = new Set<ProjectStatus>(['submitted', 'matching']);

const STEPS: Array<{ status: ProjectStatus; title: string; desc: string }> = [
  { status: 'submitted', title: 'Project submitted', desc: 'We received your request.' },
  { status: 'matching', title: 'Notifying surveyors', desc: 'Nearby experts have a few working hours to respond.' },
  { status: 'matched', title: 'Surveyor matched', desc: 'Someone accepted your project.' },
  { status: 'confirmed', title: 'Visit confirmed', desc: 'Timing and details will be locked in.' },
  { status: 'completed', title: 'Survey complete', desc: 'Your deliverables will be on the way.' },
];

const TIMELINE_LABELS: Record<string, string> = {
  asap: 'As soon as possible',
  within_3_days: 'Within 3 days',
  '2_weeks': 'Within 2 weeks',
  '1_month': 'Within a month',
  flexible: 'Flexible',
};

function progressIndex(status: ProjectStatus): number {
  if (status === 'submitted' || status === 'matching') return 1;
  return STEPS.findIndex((s) => s.status === status);
}

function serviceLabel(service: string): string {
  return SURVEY_SERVICE_LABELS[service as SurveyService] ?? service.replaceAll('_', ' ');
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'completed':
    case 'confirmed':
    case 'accepted':
      return 'success';
    case 'cancelled':
    case 'declined':
      return 'danger';
    case 'matched':
    case 'proposed':
      return 'accent';
    default:
      return 'neutral';
  }
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={styles.detailValue}>{children}</Text>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </View>
  );
}

export function ProjectDetailScreen({ route, navigation }: Props) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setProject(await api.getProject(route.params.id));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [route.params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const headline = project ? clientProjectHeadline(project.status) : null;
  const searching = project ? FINDING.has(project.status) : false;
  const cancelled = project?.status === 'cancelled';
  const currentIndex = project ? progressIndex(project.status) : 0;
  const timelineLabel = project?.neededWithin
    ? (TIMELINE_LABELS[project.neededWithin] ?? project.neededWithin.replaceAll('_', ' '))
    : null;
  const visibleMatches = (project?.matches ?? []).filter((m) =>
    ['proposed', 'accepted', 'completed'].includes(m.status),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader />
      <View style={styles.topbar}>
        <BackButton label="Projects" onPress={() => navigation.goBack()} />
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.xl }}>
          <AlertBox message={error} />
        </View>
      ) : null}
      {!project && !error ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.accent} /> : null}

      {project && headline ? (
        <ScrollView
          contentContainerStyle={styles.content}
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
        >
          <FadeInUp delay={30}>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <Text style={styles.kicker}>Project</Text>
                <Badge label={project.status} tone={statusTone(project.status)} />
              </View>
              <Text style={styles.title}>{project.title}</Text>
              {project.locationText ? (
                <View style={styles.heroLoc}>
                  <Feather name="map-pin" size={14} color={colors.muted} />
                  <Text style={styles.heroLocText}>{project.locationText}</Text>
                </View>
              ) : null}
              {project.services.length > 0 ? (
                <View style={styles.tags}>
                  {project.services.map((s) => (
                    <View key={s} style={styles.tag}>
                      <Text style={styles.tagText}>{serviceLabel(s)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </FadeInUp>

          <FadeInUp delay={70}>
            <View style={[styles.panel, styles.statusPanel]}>
              <View style={[styles.statusIcon, !searching && styles.statusIconOk]}>
                <Feather
                  name={searching ? 'zap' : 'check'}
                  size={20}
                  color={searching ? colors.accent : colors.ok}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>{headline.headline}</Text>
                <Text style={styles.statusSub}>{headline.subtext}</Text>
                {searching ? (
                  <Button
                    label="Browse matching surveyors"
                    icon="search"
                    onPress={() => navigation.navigate('ProjectSurveyors', { id: project.id })}
                    style={{ marginTop: spacing.md }}
                  />
                ) : null}
              </View>
            </View>
          </FadeInUp>

          {!cancelled ? (
            <FadeInUp delay={110}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Progress</Text>
                {STEPS.map((step, i) => {
                  const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
                  const last = i === STEPS.length - 1;
                  return (
                    <View key={step.status} style={styles.tlStep}>
                      <View style={styles.tlRail}>
                        <View
                          style={[
                            styles.tlDot,
                            state === 'done' && styles.tlDotDone,
                            state === 'current' && styles.tlDotCurrent,
                          ]}
                        >
                          {state === 'done' ? (
                            <Feather name="check" size={12} color={colors.ice} />
                          ) : (
                            <Text style={[styles.tlNum, state === 'current' && { color: colors.ice }]}>
                              {i + 1}
                            </Text>
                          )}
                        </View>
                        {!last ? <View style={[styles.tlLine, state === 'done' && styles.tlLineDone]} /> : null}
                      </View>
                      <View style={[styles.tlCopy, !last && { paddingBottom: spacing.md }]}>
                        <Text style={[styles.tlTitle, state === 'todo' && { color: colors.muted }]}>
                          {step.title}
                        </Text>
                        <Text style={styles.tlDesc}>{step.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </FadeInUp>
          ) : null}

          {visibleMatches.length > 0 ? (
            <FadeInUp delay={150}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Matches</Text>
                <View style={{ gap: spacing.sm }}>
                  {visibleMatches.map((m) => (
                    <View key={m.matchId} style={styles.match}>
                      <View style={styles.matchIcon}>
                        <Feather name="user-check" size={16} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.matchName}>
                          {m.surveyorUsername ? `@${m.surveyorUsername}` : 'Surveyor'}
                        </Text>
                        <Text style={styles.matchMeta}>
                          {m.surveyorBaseCity || 'Location pending'} · {new Date(m.createdAt).toLocaleDateString()}
                        </Text>
                        {m.feedbackSubmitted ? <Text style={styles.matchDone}>Feedback submitted</Text> : null}
                      </View>
                      <Badge label={m.status} tone={statusTone(m.status)} />
                    </View>
                  ))}
                </View>
              </View>
            </FadeInUp>
          ) : null}

          {visibleMatches
            .filter((m) => m.canLeaveFeedback)
            .map((m) => (
              <FeedbackForm
                key={`fb-${m.matchId}`}
                matchId={m.matchId}
                projectTitle={project.title}
                role="client"
                onSubmitted={() => void load()}
              />
            ))}

          <FadeInUp delay={190}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Project details</Text>
              <Detail label="Services">
                {project.services.length > 0 ? (
                  <View style={styles.tags}>
                    {project.services.map((s) => (
                      <View key={s} style={styles.chip}>
                        <Text style={styles.chipText}>{serviceLabel(s)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Detail>
              <Detail label="Location">{project.locationText}</Detail>
              <Detail label="Building type">
                {project.buildingType ? project.buildingType.replaceAll('_', ' ') : null}
              </Detail>
              <Detail label="Building age">{project.buildingAge}</Detail>
              <Detail label="Floors">{project.floors}</Detail>
              <Detail label="Area (sq ft)">
                {project.areaSqft != null ? project.areaSqft.toLocaleString() : null}
              </Detail>
              <Detail label="Occupied">
                {project.details?.occupancy ? PROJECT_OCCUPANCY_SHORT_LABELS[project.details.occupancy] : null}
              </Detail>
              <Detail label="Needed within">{timelineLabel}</Detail>
              <Detail label="Notes">{project.notes}</Detail>
              {project.location ? (
                <Button
                  label="Street View"
                  icon="eye"
                  variant="outline"
                  onPress={() => openStreetView(project.location)}
                  style={{ marginTop: spacing.md }}
                />
              ) : null}
            </View>
          </FadeInUp>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  topbar: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  content: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  hero: {
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 25, fontWeight: '800', color: colors.text, marginTop: spacing.sm, letterSpacing: -0.5 },
  heroLoc: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  heroLocText: { color: colors.muted, fontSize: 14, flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: { fontSize: 12, fontWeight: '700', color: colors.text },
  panel: {
    marginTop: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  panelTitle: { fontWeight: '800', color: colors.text, marginBottom: spacing.md, fontSize: 15.5 },
  statusPanel: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconOk: { backgroundColor: colors.okSoft },
  statusTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  statusSub: { color: colors.muted, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  tlStep: { flexDirection: 'row', gap: spacing.md },
  tlRail: { alignItems: 'center', width: 26 },
  tlDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlDotDone: { backgroundColor: colors.ok, borderColor: colors.ok },
  tlDotCurrent: { backgroundColor: colors.accent, borderColor: colors.accent },
  tlNum: { fontSize: 11.5, fontWeight: '800', color: colors.muted },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  tlLineDone: { backgroundColor: colors.ok },
  tlCopy: { flex: 1, paddingTop: 3 },
  tlTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  tlDesc: { fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchName: { color: colors.text, fontWeight: '700', fontSize: 14.5 },
  matchMeta: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  matchDone: { color: colors.ok, fontSize: 12, fontWeight: '700', marginTop: 3 },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailLabel: { width: 108, color: colors.muted, fontSize: 13, fontWeight: '600' },
  detailValue: { flex: 1, color: colors.text, fontSize: 14, textTransform: 'none' },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.text },
});
