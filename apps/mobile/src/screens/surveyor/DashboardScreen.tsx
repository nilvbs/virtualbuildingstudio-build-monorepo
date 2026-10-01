import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import {
  COVERAGE_COUNTRY_LABELS,
  SURVEYOR_PROFILE_COMPLETION_CHECKS,
  surveyorProfileCompletion,
  type CoverageCountryId,
  type SurveyorProfile,
  type SurveyorProfileCompletionKey,
  type SurveyorStatus,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, Button } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';
import { FadeInUp } from '../../components/motion';
import type { RootStackParamList, SurveyorTabParamList } from '../../navigation/types';

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<SurveyorTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const PORTFOLIO_GATES: {
  id: string;
  label: string;
  blurb: string;
  keys: SurveyorProfileCompletionKey[];
}[] = [
  { id: 'services', label: 'Services', blurb: 'What you deliver on site', keys: ['services'] },
  { id: 'coverage', label: 'Coverage', blurb: 'ZIP codes and counties you cover', keys: ['baseCity', 'location'] },
  {
    id: 'commercial',
    label: 'Rates & kit',
    blurb: 'Pricing, gear, and availability',
    keys: ['equipment', 'availability', 'pricing'],
  },
  {
    id: 'work',
    label: 'Showcase',
    blurb: 'Experience, sectors, insurance',
    keys: ['yearsRealityCapture', 'industries', 'generalLiabilityInsurance'],
  },
];

const CHECK_LABEL = Object.fromEntries(
  SURVEYOR_PROFILE_COMPLETION_CHECKS.map((c) => [c.key, c.label]),
) as Record<SurveyorProfileCompletionKey, string>;

function CompletionRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const size = 96;
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <View style={styles.ring} accessibilityLabel={`Portfolio ${clamped}% complete`}>
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.sky} />
            <Stop offset="1" stopColor={colors.navy} />
          </LinearGradient>
        </Defs>
        <Circle cx="48" cy="48" r={r} stroke={colors.accentSoft2} strokeWidth={9} fill="none" />
        <Circle
          cx="48"
          cy="48"
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={styles.ringPct}>{clamped}%</Text>
        <Text style={styles.ringSub}>{clamped >= 100 ? 'Ready' : 'Filled'}</Text>
      </View>
    </View>
  );
}

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNav>();
  const [status, setStatus] = useState<SurveyorStatus | null>(null);
  const [profile, setProfile] = useState<SurveyorProfile | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextStatus, nextProfile] = await Promise.all([
        api.getSurveyorStatus(),
        api.getSurveyorProfile().catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
      ]);
      setStatus(nextStatus);
      setProfile(nextProfile);
      if (nextStatus.profileComplete) {
        const rows = await api.getSurveyorRequests().catch(() => []);
        setRequestCount(rows.length);
      } else {
        setRequestCount(0);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => {
        void Promise.all([api.getSurveyorStatus(), api.getSurveyorRequests().catch(() => [])])
          .then(([nextStatus, rows]) => {
            setStatus(nextStatus);
            if (nextStatus.profileComplete) setRequestCount(rows.length);
          })
          .catch(() => undefined);
      }, 20_000);
      return () => clearInterval(id);
    }, [load]),
  );

  const gates = useMemo(() => {
    const completion = surveyorProfileCompletion(
      profile
        ? {
            services: profile.services,
            equipment: profile.equipment,
            baseCity: profile.baseCity,
            location: profile.location,
            dayRateCents: profile.dayRateCents,
            details: profile.details,
          }
        : null,
    );
    const missing = new Set(completion.missing);
    return PORTFOLIO_GATES.map((gate) => {
      const pendingKeys = gate.keys.filter((k) => missing.has(k));
      return { ...gate, complete: pendingKeys.length === 0, pending: pendingKeys.map((k) => CHECK_LABEL[k]) };
    });
  }, [profile]);

  const coverageCounties = useMemo(
    () => (profile?.details?.coverageCounties ?? []).filter((c) => c.selected !== false),
    [profile],
  );

  const coverageAreas = useMemo(() => {
    if (coverageCounties.length > 0) {
      return coverageCounties.map((c) => {
        const name = c.county.replace(/\s+County$/i, '');
        return c.state ? `${name} County, ${c.state}` : `${name} County`;
      });
    }
    const chips: string[] = [];
    const regions = profile?.details?.coverageRegions ?? {};
    for (const country of profile?.details?.coverageCountries ?? []) {
      const id = country as CoverageCountryId;
      const selected = regions[id] ?? [];
      if (selected.length > 0) chips.push(...selected);
      else chips.push(COVERAGE_COUNTRY_LABELS[id] ?? id);
    }
    return chips;
  }, [profile, coverageCounties]);

  const coverageStates = useMemo(
    () => Array.from(new Set(coverageCounties.map((c) => c.state))).filter(Boolean),
    [coverageCounties],
  );

  const acceptedMatches = (status?.matches ?? []).filter(
    (m) => m.status === 'accepted' || m.status === 'completed',
  ).length;

  const pendingGates = gates.filter((g) => !g.complete);
  const doneGates = gates.filter((g) => g.complete);
  const incomplete = status ? !status.profileComplete : false;

  const lede = !status
    ? ''
    : incomplete
      ? `${pendingGates.length} stage${pendingGates.length === 1 ? '' : 's'} still need details before matching unlocks.`
      : coverageCounties.length > 0
        ? `Covering ${coverageCounties.length} count${coverageCounties.length === 1 ? 'y' : 'ies'}${
            coverageStates.length
              ? ` across ${coverageStates.length} state${coverageStates.length === 1 ? '' : 's'}`
              : ''
          }. Open Requests when a project fits.`
        : status.subtext;

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
        {error ? <AlertBox message={error} /> : null}
        {!status && !error ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} /> : null}

        {status ? (
          <>
            <FadeInUp delay={30}>
              <View style={[styles.hero, incomplete ? styles.heroPending : styles.heroLive]}>
                <View style={styles.heroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kicker}>{incomplete ? 'Almost there' : 'Live workspace'}</Text>
                    <Text style={styles.heroTitle}>{incomplete ? 'Finish your portfolio' : status.headline}</Text>
                    {!incomplete ? (
                      <View style={[styles.pill, status.isMatchable ? styles.pillOk : styles.pillWarn]}>
                        <Feather
                          name={status.isMatchable ? 'radio' : 'pause-circle'}
                          size={12}
                          color={status.isMatchable ? colors.ok : colors.warn}
                        />
                        <Text style={[styles.pillText, { color: status.isMatchable ? colors.ok : colors.warn }]}>
                          {status.isMatchable ? 'Open' : 'Paused'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <CompletionRing percent={status.completionPercent} />
                </View>
                <Text style={styles.lede}>{lede}</Text>

                <View style={styles.facts}>
                  {([
                    ['Portfolio', `${status.completionPercent}%`],
                    ['Counties', coverageCounties.length > 0 ? String(coverageCounties.length) : '—'],
                    ['Requests', incomplete ? 'Locked' : String(requestCount)],
                    ['Matches', incomplete ? 'Locked' : String(acceptedMatches)],
                  ] as const).map(([label, value]) => (
                    <View key={label} style={styles.fact}>
                      <Text style={styles.factLabel}>{label}</Text>
                      <Text style={styles.factValue}>{value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.heroActions}>
                  <Button
                    label={incomplete ? 'Continue portfolio' : 'Edit portfolio'}
                    icon="arrow-right"
                    onPress={() => navigation.navigate('Portfolio')}
                    style={{ flex: 1 }}
                  />
                  {!incomplete ? (
                    <Button
                      label="Requests"
                      icon="inbox"
                      variant="outline"
                      onPress={() => navigation.navigate('Requests')}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                </View>
              </View>
            </FadeInUp>

            {coverageAreas.length > 0 ? (
              <FadeInUp delay={80}>
                <View style={styles.panel}>
                  <View style={styles.panelHead}>
                    <Feather name="map-pin" size={16} color={colors.accent} />
                    <Text style={styles.panelTitle}>Coverage</Text>
                    {profile?.baseCity ? <Text style={styles.panelMeta}>Base: {profile.baseCity}</Text> : null}
                  </View>
                  <View style={styles.chips}>
                    {coverageAreas.slice(0, 12).map((area) => (
                      <View key={area} style={styles.chip}>
                        <Text style={styles.chipText}>{area}</Text>
                      </View>
                    ))}
                    {coverageAreas.length > 12 ? (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>+{coverageAreas.length - 12} more</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </FadeInUp>
            ) : null}

            {incomplete ? (
              <FadeInUp delay={120}>
                <View style={styles.panel}>
                  <View style={styles.panelHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kicker}>Still needed</Text>
                      <Text style={styles.panelTitle}>Pending portfolio items</Text>
                    </View>
                    <View style={styles.count}>
                      <Text style={styles.countText}>{pendingGates.length}</Text>
                    </View>
                  </View>

                  {doneGates.length > 0 ? (
                    <View style={[styles.chips, { marginBottom: spacing.md }]}>
                      {doneGates.map((g) => (
                        <View key={g.id} style={[styles.chip, styles.chipDone]}>
                          <Feather name="check" size={12} color={colors.ok} />
                          <Text style={[styles.chipText, { color: colors.ok }]}>{g.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={{ gap: spacing.sm }}>
                    {pendingGates.map((gate) => (
                      <View key={gate.id} style={styles.gate}>
                        <View style={styles.gateTop}>
                          <View style={styles.gateIcon}>
                            <Feather name="alert-triangle" size={13} color={colors.warn} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.gateTitle}>{gate.label}</Text>
                            <Text style={styles.gateBlurb}>{gate.blurb}</Text>
                          </View>
                          <Button
                            label="Fill"
                            onPress={() => navigation.navigate('Portfolio')}
                            style={styles.fillBtn}
                          />
                        </View>
                        {gate.pending.map((item) => (
                          <Text key={item} style={styles.missing}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              </FadeInUp>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  hero: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md, ...shadows.sm },
  heroPending: { backgroundColor: colors.accentSoft2, borderColor: colors.border },
  heroLive: { backgroundColor: colors.okSoft, borderColor: 'rgba(5,150,105,0.2)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kicker: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4, marginTop: 4 },
  lede: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  pillOk: { backgroundColor: 'rgba(5,150,105,0.15)' },
  pillWarn: { backgroundColor: colors.warnSoft },
  pillText: { fontSize: 12, fontWeight: '800' },
  ring: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center' },
  ringPct: { fontSize: 18, fontWeight: '800', color: colors.text },
  ringSub: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  factLabel: { fontSize: 11.5, fontWeight: '700', color: colors.muted },
  factValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  panel: {
    marginTop: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  panelTitle: { fontSize: 15.5, fontWeight: '800', color: colors.text },
  panelMeta: { marginLeft: 'auto', color: colors.muted, fontSize: 12.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  chipDone: { backgroundColor: colors.okSoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.text },
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
  gate: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  gateTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gateIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.warnSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  gateBlurb: { fontSize: 12.5, color: colors.muted, marginTop: 1 },
  fillBtn: { minHeight: 36, paddingHorizontal: 14 },
  missing: { color: colors.muted, fontSize: 12.5, marginLeft: 40 },
});
