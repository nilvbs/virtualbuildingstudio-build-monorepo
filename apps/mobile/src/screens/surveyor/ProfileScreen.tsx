import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  SURVEY_SERVICES,
  SURVEY_SERVICE_LABELS,
  type SurveyService,
  type SurveyorProfile,
} from '@surveylink/types';
import { ApiError, api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, Button, Field } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';

export function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  const [bio, setBio] = useState('');
  const [baseCity, setBaseCity] = useState('');
  const [services, setServices] = useState<SurveyService[]>([]);
  const [equipment, setEquipment] = useState('');
  const [radiusKm, setRadiusKm] = useState('');
  const [dayRate, setDayRate] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isMatchable, setIsMatchable] = useState(false);

  const hydrate = useCallback((p: SurveyorProfile | null) => {
    if (!p) {
      setHasProfile(false);
      return;
    }
    setHasProfile(true);
    setBio(p.bio ?? '');
    setBaseCity(p.baseCity ?? '');
    setServices(p.services ?? []);
    setEquipment((p.equipment ?? []).join(', '));
    setRadiusKm(p.radiusKm != null ? String(p.radiusKm) : '');
    setDayRate(p.dayRateCents != null ? String(Math.round(p.dayRateCents / 100)) : '');
    setLat(p.location?.lat != null ? String(p.location.lat) : '');
    setLng(p.location?.lng != null ? String(p.location.lng) : '');
    setIsMatchable(p.isMatchable ?? false);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const profile = await api.getSurveyorProfile().catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      });
      hydrate(profile);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function toggleService(s: SurveyService) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function buildBody(extra: { isMatchable?: boolean } = {}) {
    const latN = lat.trim() ? Number(lat) : NaN;
    const lngN = lng.trim() ? Number(lng) : NaN;
    const hasLocation = Number.isFinite(latN) && Number.isFinite(lngN);
    return {
      bio: bio.trim() || undefined,
      baseCity: baseCity.trim() || undefined,
      services,
      equipment: equipment
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      dayRateCents: dayRate ? Math.round(Number(dayRate) * 100) : undefined,
      location: hasLocation ? { lat: latN, lng: lngN } : undefined,
      isMatchable: extra.isMatchable ?? isMatchable,
    };
  }

  async function persist(body: ReturnType<typeof buildBody>) {
    if (hasProfile) {
      return api.updateSurveyorProfile(body);
    }
    try {
      return await api.updateSurveyorProfile(body);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        const created = await api.createSurveyorProfile({ ...body, services: body.services });
        setHasProfile(true);
        return created;
      }
      throw err;
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const saved = await persist(buildBody());
      hydrate(saved);
      setInfo('Profile saved to the database.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /** Persist Matchable immediately so Dashboard / DB stay in sync. */
  async function onMatchableChange(next: boolean) {
    const prev = isMatchable;
    setIsMatchable(next);
    setToggling(true);
    setError(null);
    setInfo(null);
    try {
      const saved = await persist(buildBody({ isMatchable: next }));
      hydrate(saved);
      setInfo(
        next
          ? 'Matchable saved on. Matching goes live once your profile is 100% complete.'
          : 'Matchable saved off.',
      );
    } catch (err) {
      setIsMatchable(prev);
      setError(errorMessage(err));
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <AppHeader />
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      </SafeAreaView>
    );
  }

  const hasMapLocation = Boolean(lat.trim() && lng.trim());

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text style={styles.title}>Your profile</Text>
            <Text style={styles.lede}>
              Keep your coverage current so the ops team can match you.
            </Text>
          </View>

          {error ? <AlertBox message={error} /> : null}
          {info ? <AlertBox tone="success" message={info} /> : null}

          <View style={styles.matchRow}>
            <View style={styles.matchIcon}>
              <Feather name="radio" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.matchTitle}>Matchable</Text>
              <Text style={styles.matchCopy}>
                {toggling ? 'Saving to database…' : 'Saved to your profile. Live only at 100% complete.'}
              </Text>
            </View>
            <Switch
              value={isMatchable}
              onValueChange={(v) => void onMatchableChange(v)}
              disabled={toggling || saving}
              trackColor={{ true: colors.accent, false: colors.accent2 }}
              thumbColor={colors.ice}
            />
          </View>

          {!hasMapLocation ? (
            <AlertBox
              tone="info"
              message="Map location is required for profile completion (the missing piece at ~83%). Add latitude & longitude below, then Save."
            />
          ) : null}

          <Text style={styles.section}>Services</Text>
          <View style={styles.chips}>
            {SURVEY_SERVICES.map((s) => {
              const on = services.includes(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => toggleService(s)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {SURVEY_SERVICE_LABELS[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 18 }}>
            <Field
              label="Base city"
              icon="map-pin"
              value={baseCity}
              onChangeText={setBaseCity}
              autoCapitalize="words"
            />
            <Field
              label="Map latitude"
              icon="navigation"
              value={lat}
              onChangeText={setLat}
              keyboardType="decimal-pad"
              placeholder="30.2672"
            />
            <Field
              label="Map longitude"
              icon="navigation"
              value={lng}
              onChangeText={setLng}
              keyboardType="decimal-pad"
              placeholder="-97.7431"
            />
            <Field
              label="Coverage radius (km)"
              icon="target"
              value={radiusKm}
              onChangeText={setRadiusKm}
              keyboardType="number-pad"
            />
            <Field
              label="Day rate (whole currency)"
              icon="dollar-sign"
              value={dayRate}
              onChangeText={setDayRate}
              keyboardType="number-pad"
            />
            <Field
              label="Equipment (comma separated)"
              icon="tool"
              value={equipment}
              onChangeText={setEquipment}
              placeholder="Leica RTC360, DJI Mavic 3"
            />
            <Field
              label="Bio"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              style={styles.bio}
            />
          </View>

          <Button
            label={saving ? 'Saving…' : 'Save profile'}
            busy={saving}
            onPress={() => void save()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: 20, paddingBottom: 48 },
  intro: {
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 2 },
  lede: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
    ...shadows.sm,
  },
  matchIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  matchCopy: { color: colors.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.ice },
  bio: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
});
