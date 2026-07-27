import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  SURVEY_SERVICE_LABELS,
  type ClientSurveyorSort,
  type ClientSurveyorSummary,
  type ProjectDetail,
  type SurveyService,
} from '@surveylink/types';
import { api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, BackButton, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectSurveyors'>;

const PAGE_SIZE = 12;
const RATING_OPTIONS = [
  { value: '', label: 'Any', stars: 0 },
  { value: '3', label: '3+', stars: 3 },
  { value: '4', label: '4+', stars: 4 },
  { value: '4.5', label: '4.5+', stars: 5 },
] as const;

type Filters = {
  q: string;
  minRating: string;
  bldVerified: boolean;
  radiusKm: string;
  minDayRate: string;
  maxDayRate: string;
  sort: ClientSurveyorSort;
};

function formatRate(cents: number | null): string {
  if (cents == null) return 'Rate on request';
  return `$${Math.round(cents / 100)}/day`;
}

function label(s: SurveyService): string {
  return SURVEY_SERVICE_LABELS[s] ?? s.replaceAll('_', ' ');
}

export function ProjectSurveyorsScreen({ route, navigation }: Props) {
  const projectId = route.params.id;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [items, setItems] = useState<ClientSurveyorSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>('0');
  const [filters, setFilters] = useState<Filters | null>(null);
  const [applied, setApplied] = useState<Filters | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProject(projectId)
      .then((p) => {
        setProject(p);
        const base: Filters = {
          q: '',
          minRating: '',
          bldVerified: false,
          radiusKm: '100',
          minDayRate: '',
          maxDayRate: '',
          sort: 'relevance',
        };
        setFilters(base);
        setApplied(base);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  const loadPage = useCallback(
    async (nextCursor: string | null, reset: boolean, active: Filters) => {
      if (nextCursor == null && !reset) return;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const page = await api.browseProjectSurveyors(projectId, {
          cursor: nextCursor ?? 0,
          limit: PAGE_SIZE,
          q: active.q || undefined,
          minRating: active.minRating ? Number(active.minRating) : undefined,
          bldVerified: active.bldVerified || undefined,
          radiusKm: active.radiusKm ? Number(active.radiusKm) : undefined,
          minDayRateCents: active.minDayRate
            ? Math.round(Number(active.minDayRate) * 100)
            : undefined,
          maxDayRateCents: active.maxDayRate
            ? Math.round(Number(active.maxDayRate) * 100)
            : undefined,
          sort: active.sort,
          services: project?.services?.length ? project.services : undefined,
        });
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
        setCursor(page.nextCursor);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId, project?.services],
  );

  useEffect(() => {
    if (!applied) return;
    void loadPage('0', true, applied);
  }, [applied, loadPage]);

  const header = useMemo(
    () => (
      <FadeInUp delay={20}>
        <View style={styles.intro}>
          <Text style={styles.title}>Find surveyors</Text>
          <Text style={styles.sub}>
            {project
              ? `Relevant to “${project.title}”. Scroll for more · tap Filters to refine.`
              : 'Loading…'}
          </Text>
          <Text style={styles.count}>{total} matches</Text>
          <Button
            label="Filters"
            icon="sliders"
            variant="outline"
            onPress={() => setFiltersOpen(true)}
            style={{ marginTop: spacing.md }}
          />
        </View>
        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <AlertBox message={error} />
          </View>
        ) : null}
      </FadeInUp>
    ),
    [project, total, error],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader />
      <View style={styles.topbar}>
        <BackButton label="Project" onPress={() => navigation.goBack()} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.profileId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (cursor && applied && !loading && !loadingMore) {
            void loadPage(cursor, false, applied);
          }
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No surveyors match</Text>
              <Text style={styles.emptyCopy}>Widen distance, budget, or services.</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} color={colors.accent} /> : null
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={40 + Math.min(index, 5) * 40}>
            <View style={styles.card}>
              <View style={styles.rowTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.fullName.slice(0, 1)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.fullName}</Text>
                    {item.bldVerified ? <Feather name="check-circle" size={16} color="#2563eb" /> : null}
                  </View>
                  <Text style={styles.meta}>
                    {[item.baseCity, item.distanceKm != null ? `${item.distanceKm} km` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Location TBD'}
                  </Text>
                </View>
                <View style={styles.rating}>
                  <Feather name="star" size={13} color={colors.warn} />
                  <Text style={styles.ratingText}>
                    {item.ratingAvg != null ? item.ratingAvg.toFixed(1) : '—'}
                  </Text>
                </View>
              </View>
              {item.bio ? (
                <Text style={styles.bio} numberOfLines={2}>
                  {item.bio}
                </Text>
              ) : null}
              <Text style={styles.services} numberOfLines={2}>
                {item.services.map(label).join(' · ')}
              </Text>
              <View style={styles.foot}>
                <Text style={styles.rate}>{formatRate(item.dayRateCents)}</Text>
                <Text style={styles.score}>Match {item.relevanceScore}%</Text>
              </View>
            </View>
          </FadeInUp>
        )}
      />

      <Modal visible={filtersOpen} animationType="slide" transparent>
        <Pressable style={styles.modalDim} onPress={() => setFiltersOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Filters</Text>
            {filters ? (
              <ScrollView>
                <Text style={styles.label}>Search</Text>
                <View style={styles.searchBox}>
                  <Feather name="search" size={17} color={colors.faint} />
                  <TextInput
                    style={styles.searchInput}
                    value={filters.q}
                    onChangeText={(q) => setFilters((f) => (f ? { ...f, q } : f))}
                    placeholder="Search by name, city, or bio"
                    placeholderTextColor={colors.faint}
                  />
                </View>

                <Text style={styles.label}>Minimum rating</Text>
                <View style={styles.chipRow}>
                  {RATING_OPTIONS.map((opt) => {
                    const on = filters.minRating === opt.value;
                    return (
                      <Pressable
                        key={opt.value || 'any'}
                        style={[styles.ratingChip, on && styles.ratingChipOn]}
                        onPress={() => setFilters((f) => (f ? { ...f, minRating: opt.value } : f))}
                      >
                        {opt.stars === 0 ? (
                          <Text style={styles.chipText}>Any</Text>
                        ) : (
                          <>
                            <View style={styles.starsRow}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Feather
                                  key={i}
                                  name="star"
                                  size={12}
                                  color={i < opt.stars ? colors.warn : colors.borderStrong}
                                />
                              ))}
                            </View>
                            <Text style={styles.chipText}>{opt.label}</Text>
                          </>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Distance (km)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={filters.radiusKm}
                  onChangeText={(radiusKm) => setFilters((f) => (f ? { ...f, radiusKm } : f))}
                />

                <Text style={styles.label}>Sort</Text>
                <View style={styles.chipRow}>
                  {(
                    [
                      ['relevance', 'Best match'],
                      ['distance', 'Nearest'],
                      ['rating', 'Rating'],
                      ['price_asc', 'Budget ↑'],
                      ['price_desc', 'Budget ↓'],
                    ] as const
                  ).map(([value, text]) => (
                    <Pressable
                      key={value}
                      style={[styles.chip, filters.sort === value && styles.chipOn]}
                      onPress={() => setFilters((f) => (f ? { ...f, sort: value } : f))}
                    >
                      <Text style={styles.chipText}>{text}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Day rate ($)</Text>
                <View style={styles.rateRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    keyboardType="numeric"
                    placeholder="Min"
                    placeholderTextColor={colors.faint}
                    value={filters.minDayRate}
                    onChangeText={(minDayRate) => setFilters((f) => (f ? { ...f, minDayRate } : f))}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    keyboardType="numeric"
                    placeholder="Max"
                    placeholderTextColor={colors.faint}
                    value={filters.maxDayRate}
                    onChangeText={(maxDayRate) => setFilters((f) => (f ? { ...f, maxDayRate } : f))}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>BLD verified only</Text>
                  <Switch
                    value={filters.bldVerified}
                    onValueChange={(bldVerified) =>
                      setFilters((f) => (f ? { ...f, bldVerified } : f))
                    }
                  />
                </View>

                <View style={styles.actions}>
                  <Button
                    label="Apply"
                    onPress={() => {
                      if (filters) setApplied({ ...filters });
                      setFiltersOpen(false);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Reset"
                    variant="outline"
                    onPress={() => {
                      const base: Filters = {
                        q: '',
                        minRating: '',
                        bldVerified: false,
                        radiusKm: '100',
                        minDayRate: '',
                        maxDayRate: '',
                        sort: 'relevance',
                      };
                      setFilters(base);
                      setApplied(base);
                      setFiltersOpen(false);
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  topbar: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 48 },
  intro: {
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, marginTop: 6, fontSize: 14, lineHeight: 20 },
  count: { marginTop: 10, fontWeight: '700', color: colors.accent },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: 8,
    ...shadows.sm,
  },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', color: colors.accent, fontSize: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { color: colors.muted, marginTop: 3, fontSize: 13 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  bio: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  services: { color: colors.text, fontSize: 12.5, fontWeight: '600' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rate: { fontWeight: '700', color: colors.text },
  score: { color: colors.muted, fontSize: 13 },
  empty: {
    marginTop: 24,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyTitle: { fontWeight: '800', fontSize: 16, color: colors.text },
  emptyCopy: { color: colors.muted, marginTop: 6, textAlign: 'center' },
  modalDim: { flex: 1, backgroundColor: 'rgba(11,18,32,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    maxHeight: '85%',
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6, marginTop: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 48,
    backgroundColor: colors.page,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    backgroundColor: colors.page,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.page,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.page,
  },
  ratingChipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  starsRow: { flexDirection: 'row', gap: 1 },
  rateRow: { flexDirection: 'row', gap: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 4,
  },
  switchLabel: { fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 12 },
});
