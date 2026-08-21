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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SURVEY_SERVICE_LABELS,
  clientProjectHeadline,
  type Project,
  type ProjectStatus,
} from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
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

export function ProjectsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProjects(await api.getProjects());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const count = projects?.length ?? 0;

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
                  <Text style={styles.title}>Your projects</Text>
                  <Text style={styles.sub}>
                    {projects == null
                      ? 'Loading…'
                      : count === 0
                        ? 'No projects yet'
                        : `${count} active ${count === 1 ? 'project' : 'projects'}`}
                  </Text>
                </View>
                <Button
                  label="Post"
                  icon="plus"
                  onPress={() => navigation.navigate('NewProject')}
                  style={styles.postBtn}
                />
              </View>
            </View>
            {error ? (
              <View style={{ marginTop: spacing.md }}>
                <AlertBox message={error} />
              </View>
            ) : null}
          </FadeInUp>
        }
        ListEmptyComponent={
          projects == null ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.accent} />
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
  title: { fontSize: 27, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4 },
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
