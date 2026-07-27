import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  SURVEY_SERVICE_LABELS,
  clientProjectHeadline,
  type ProjectDetail,
  type ProjectStatus,
} from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, BackButton, Badge, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;
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

export function ProjectDetailScreen({ route, navigation }: Props) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProject(route.params.id)
      .then(setProject)
      .catch((err) => setError(errorMessage(err)));
  }, [route.params.id]);

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

      {project ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <FadeInUp delay={30}>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Feather name="home" size={22} color={colors.accent} />
              </View>
              <Badge label={project.status} tone={statusTone(project.status)} />
              <Text style={styles.title}>{project.title}</Text>
              <Text style={styles.headline}>{clientProjectHeadline(project.status).headline}</Text>
              {(project.status === 'submitted' || project.status === 'matching') ? (
                <Button
                  label="Browse matching surveyors"
                  icon="search"
                  onPress={() => navigation.navigate('ProjectSurveyors', { id: project.id })}
                  style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
                />
              ) : null}
            </View>
          </FadeInUp>

          <FadeInUp delay={90}>
            <View style={styles.card}>
              {project.locationText ? (
                <View style={styles.row}>
                  <Feather name="map-pin" size={16} color={colors.faint} />
                  <Text style={styles.rowText}>{project.locationText}</Text>
                </View>
              ) : null}
              <View style={styles.row}>
                <Feather name="layers" size={16} color={colors.faint} />
                <Text style={styles.rowText}>
                  {project.services.map((s) => SURVEY_SERVICE_LABELS[s]).join(' · ')}
                </Text>
              </View>
            </View>
          </FadeInUp>

          {project.notes ? (
            <FadeInUp delay={150}>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Notes</Text>
                <Text style={styles.blockCopy}>{project.notes}</Text>
              </View>
            </FadeInUp>
          ) : null}

          {project.matches?.[0] ? (
            <FadeInUp delay={200}>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Your match</Text>
                <View style={styles.matchRow}>
                  <View style={styles.matchAvatar}>
                    <Feather name="user-check" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchName}>
                      {project.matches[0].surveyorBaseCity ?? 'Surveyor assigned'}
                    </Text>
                    <Text style={styles.matchStatus}>{project.matches[0].status}</Text>
                  </View>
                </View>
              </View>
            </FadeInUp>
          ) : null}
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
    marginBottom: spacing.lg,
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, marginTop: spacing.md, letterSpacing: -0.5 },
  headline: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { color: colors.text, fontSize: 14.5, flex: 1 },
  block: {
    marginTop: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  blockTitle: { fontWeight: '800', color: colors.text, marginBottom: 8, fontSize: 15 },
  blockCopy: { color: colors.muted, lineHeight: 21, fontSize: 14 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  matchAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  matchStatus: { color: colors.muted, fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
});
