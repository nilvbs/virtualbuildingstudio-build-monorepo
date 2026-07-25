import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
  EQUIPMENT_GROUPS,
  EQUIPMENT_LABELS,
  INDUSTRIES_SERVED,
  INDUSTRY_LABELS,
  PORTFOLIO_LANGUAGE_LABELS,
  PORTFOLIO_LANGUAGES,
  SURVEY_SERVICE_GROUPS,
  SURVEY_SERVICE_LABELS,
  emptyPortfolioDetails,
  normalizePortfolioDetails,
  surveyorProfileCompletion,
  type AccountType,
  type AvailabilityOption,
  type CompanyIdentity,
  type EquipmentId,
  type IndividualIdentity,
  type IndustryServed,
  type PortfolioLanguage,
  type SurveyService,
  type SurveyorPortfolioDetails,
  type SurveyorProfile,
} from '@surveylink/types';
import { ApiError, api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, Button, Field } from '../../components/ui';
import { AppHeader } from '../../components/AppHeader';

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function ChipGrid<T extends string>({
  options,
  labels,
  selected,
  onToggle,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => onToggle(option)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{labels[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [tab, setTab] = useState<'core' | 'identity'>('core');
  const [accountType, setAccountType] = useState<AccountType>('individual');

  const [services, setServices] = useState<SurveyService[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [baseCity, setBaseCity] = useState('');
  const [radiusKm, setRadiusKm] = useState('250');
  const [dayRate, setDayRate] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isMatchable, setIsMatchable] = useState(false);
  const [details, setDetails] = useState<SurveyorPortfolioDetails>(emptyPortfolioDetails());
  const [mediaBusy, setMediaBusy] = useState<string | null>(null);

  const hydrate = useCallback((p: SurveyorProfile | null, type: AccountType) => {
    if (!p) {
      setHasProfile(false);
      setDetails(emptyPortfolioDetails(type));
      return;
    }
    setHasProfile(true);
    setServices(p.services ?? []);
    setEquipment(p.equipment ?? []);
    setBaseCity(p.baseCity ?? '');
    setRadiusKm(p.radiusKm != null ? String(p.radiusKm) : '250');
    setDayRate(p.dayRateCents != null ? String(Math.round(p.dayRateCents / 100)) : '');
    setHourlyRate(
      p.details?.hourlyRateCents != null
        ? String(Math.round(p.details.hourlyRateCents / 100))
        : '',
    );
    setLat(p.location?.lat != null ? String(p.location.lat) : '');
    setLng(p.location?.lng != null ? String(p.location.lng) : '');
    setIsMatchable(p.isMatchable ?? false);
    const next = normalizePortfolioDetails(p.details, type);
    if (!next.identity || next.identity.kind !== type) {
      next.identity = emptyPortfolioDetails(type).identity;
    }
    setDetails(next);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [user, profile] = await Promise.all([
        api.me().catch(() => null),
        api.getSurveyorProfile().catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
      ]);
      const type = (user?.accountType as AccountType | undefined) ?? 'individual';
      setAccountType(type);
      hydrate(profile, type);
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

  const liveCompletion = useMemo(() => {
    const latN = lat.trim() ? Number(lat) : NaN;
    const lngN = lng.trim() ? Number(lng) : NaN;
    const location =
      Number.isFinite(latN) && Number.isFinite(lngN) ? { lat: latN, lng: lngN } : null;
    return surveyorProfileCompletion({
      services,
      equipment,
      baseCity,
      location,
      dayRateCents: dayRate ? Math.round(Number(dayRate) * 100) : null,
      details: {
        ...details,
        hourlyRateCents: hourlyRate ? Math.round(Number(hourlyRate) * 100) : null,
      },
    });
  }, [services, equipment, baseCity, lat, lng, dayRate, hourlyRate, details]);

  function patchDetails(patch: Partial<SurveyorPortfolioDetails>) {
    setDetails((current) => ({ ...current, ...patch }));
  }

  function patchIndividual(patch: Partial<IndividualIdentity>) {
    setDetails((current) => {
      const identity =
        current.identity?.kind === 'individual'
          ? current.identity
          : (emptyPortfolioDetails('individual').identity as IndividualIdentity);
      return { ...current, identity: { ...identity, ...patch, kind: 'individual' } };
    });
  }

  function patchCompany(patch: Partial<CompanyIdentity>) {
    setDetails((current) => {
      const identity =
        current.identity?.kind === 'company'
          ? current.identity
          : (emptyPortfolioDetails('company').identity as CompanyIdentity);
      return { ...current, identity: { ...identity, ...patch, kind: 'company' } };
    });
  }

  function buildBody(extra: { isMatchable?: boolean } = {}) {
    const latN = lat.trim() ? Number(lat) : NaN;
    const lngN = lng.trim() ? Number(lng) : NaN;
    const hasLocation = Number.isFinite(latN) && Number.isFinite(lngN);
    const nextDetails: SurveyorPortfolioDetails = {
      ...details,
      hourlyRateCents: hourlyRate ? Math.round(Number(hourlyRate) * 100) : null,
    };
    const identity = nextDetails.identity;
    const bio =
      identity?.kind === 'individual'
        ? identity.aboutMe.trim() || identity.headline.trim()
        : identity?.kind === 'company'
          ? identity.aboutCompany.trim() || identity.tagline.trim()
          : '';

    return {
      bio: bio || undefined,
      baseCity: baseCity.trim() || undefined,
      services,
      equipment,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      dayRateCents: dayRate ? Math.round(Number(dayRate) * 100) : undefined,
      location: hasLocation ? { lat: latN, lng: lngN } : undefined,
      details: nextDetails,
      isMatchable: extra.isMatchable ?? isMatchable,
    };
  }

  async function persist(body: ReturnType<typeof buildBody>) {
    if (hasProfile) return api.updateSurveyorProfile(body);
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
      hydrate(saved, accountType);
      setInfo('Portfolio saved.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onMatchableChange(next: boolean) {
    const prev = isMatchable;
    setIsMatchable(next);
    setToggling(true);
    setError(null);
    try {
      const saved = await persist(buildBody({ isMatchable: next }));
      hydrate(saved, accountType);
    } catch (err) {
      setIsMatchable(prev);
      setError(errorMessage(err));
    } finally {
      setToggling(false);
    }
  }

  async function uploadImage(
    kind: 'logo' | 'cover' | 'portfolio' | 'document',
    onUrl: (url: string) => void,
  ) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to upload images to S3.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setMediaBusy(kind);
    setError(null);
    try {
      const stored = await api.uploadMedia(
        {
          uri: asset.uri,
          name: asset.fileName ?? `${kind}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        },
        kind,
        asset.fileName ?? `${kind}.jpg`,
      );
      onUrl(stored.url);
      setInfo('Uploaded to S3.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setMediaBusy(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <AppHeader showAccountMenu />
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      </SafeAreaView>
    );
  }

  const individual =
    details.identity?.kind === 'individual' ? details.identity : null;
  const company = details.identity?.kind === 'company' ? details.identity : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader showAccountMenu />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text style={styles.title}>Your portfolio</Text>
            <Text style={styles.lede}>
              Core info is shared. Identity adapts for {accountType} accounts. Completion:{' '}
              {liveCompletion.percent}%.
            </Text>
          </View>

          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, tab === 'core' && styles.tabOn]}
              onPress={() => setTab('core')}
            >
              <Text style={[styles.tabText, tab === 'core' && styles.tabTextOn]}>Core</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === 'identity' && styles.tabOn]}
              onPress={() => setTab('identity')}
            >
              <Text style={[styles.tabText, tab === 'identity' && styles.tabTextOn]}>
                {accountType === 'company' ? 'Company' : 'Professional'}
              </Text>
            </Pressable>
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
                {liveCompletion.complete
                  ? 'Ready for matching when enabled.'
                  : `Finish portfolio (${liveCompletion.percent}%) to go live.`}
              </Text>
            </View>
            <Switch
              value={isMatchable}
              onValueChange={(v) => void onMatchableChange(v)}
              disabled={toggling || saving || !liveCompletion.complete}
              trackColor={{ true: colors.accent, false: colors.accent2 }}
              thumbColor={colors.ice}
            />
          </View>

          {tab === 'core' ? (
            <>
              {SURVEY_SERVICE_GROUPS.map((group) => (
                <View key={group.id}>
                  <Text style={styles.section}>{group.label}</Text>
                  <ChipGrid
                    options={group.services}
                    labels={SURVEY_SERVICE_LABELS}
                    selected={services}
                    onToggle={(s) => setServices((prev) => toggleInList(prev, s))}
                  />
                </View>
              ))}

              <Text style={styles.section}>Coverage</Text>
              <Field label="Base location" icon="map-pin" value={baseCity} onChangeText={setBaseCity} />
              <Field
                label="Coverage radius (km)"
                icon="target"
                value={radiusKm}
                onChangeText={setRadiusKm}
                keyboardType="number-pad"
              />
              <Field
                label="Latitude"
                icon="navigation"
                value={lat}
                onChangeText={setLat}
                keyboardType="decimal-pad"
              />
              <Field
                label="Longitude"
                icon="navigation"
                value={lng}
                onChangeText={setLng}
                keyboardType="decimal-pad"
              />
              <View style={styles.checkRow}>
                {(
                  [
                    ['travelNationwide', 'Travel nationwide'],
                    ['internationalProjects', 'International projects'],
                    ['remoteServices', 'Remote services'],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    style={styles.checkItem}
                    onPress={() => patchDetails({ [key]: !details[key] })}
                  >
                    <Feather
                      name={details[key] ? 'check-square' : 'square'}
                      size={18}
                      color={details[key] ? colors.accent : colors.muted}
                    />
                    <Text style={styles.checkLabel}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.section}>Availability</Text>
              <ChipGrid
                options={AVAILABILITY_OPTIONS}
                labels={AVAILABILITY_LABELS}
                selected={details.availability ? [details.availability] : []}
                onToggle={(option) =>
                  patchDetails({ availability: option as AvailabilityOption })
                }
              />
              {details.availability === 'busy_until' ? (
                <Field
                  label="Busy until (YYYY-MM-DD)"
                  value={details.busyUntil ?? ''}
                  onChangeText={(busyUntil) => patchDetails({ busyUntil: busyUntil || null })}
                />
              ) : null}

              <Text style={styles.section}>Pricing</Text>
              <Field
                label="Currency"
                value={details.currency}
                onChangeText={(currency) => patchDetails({ currency: currency.toUpperCase() })}
              />
              <Field
                label="Hourly rate"
                icon="dollar-sign"
                value={hourlyRate}
                onChangeText={setHourlyRate}
                keyboardType="number-pad"
              />
              <Field
                label="Daily rate"
                icon="dollar-sign"
                value={dayRate}
                onChangeText={setDayRate}
                keyboardType="number-pad"
              />

              {EQUIPMENT_GROUPS.map((group) => (
                <View key={group.id}>
                  <Text style={styles.section}>{group.label}</Text>
                  <ChipGrid
                    options={group.items}
                    labels={EQUIPMENT_LABELS}
                    selected={equipment as EquipmentId[]}
                    onToggle={(id) => setEquipment((prev) => toggleInList(prev, id))}
                  />
                </View>
              ))}

              <Text style={styles.section}>Languages</Text>
              <ChipGrid
                options={PORTFOLIO_LANGUAGES}
                labels={PORTFOLIO_LANGUAGE_LABELS}
                selected={details.languages}
                onToggle={(lang) =>
                  patchDetails({
                    languages: toggleInList(details.languages, lang as PortfolioLanguage),
                  })
                }
              />

              <Text style={styles.section}>Industries served</Text>
              <ChipGrid
                options={INDUSTRIES_SERVED}
                labels={INDUSTRY_LABELS}
                selected={details.industries}
                onToggle={(industry) =>
                  patchDetails({
                    industries: toggleInList(details.industries, industry as IndustryServed),
                  })
                }
              />
            </>
          ) : (
            <>
              {accountType === 'individual' && individual ? (
                <>
                  <Text style={styles.section}>Professional profile</Text>
                  <Field
                    label="Professional title"
                    value={individual.professionalTitle}
                    onChangeText={(professionalTitle) => patchIndividual({ professionalTitle })}
                  />
                  <Field
                    label="Headline"
                    value={individual.headline}
                    onChangeText={(headline) => patchIndividual({ headline })}
                  />
                  <Field
                    label="Years of experience"
                    value={
                      individual.yearsExperience != null
                        ? String(individual.yearsExperience)
                        : ''
                    }
                    onChangeText={(v) =>
                      patchIndividual({ yearsExperience: v ? Number(v) : null })
                    }
                    keyboardType="number-pad"
                  />
                  <Field
                    label="Current company"
                    value={individual.currentCompany}
                    onChangeText={(currentCompany) => patchIndividual({ currentCompany })}
                  />
                  <Field
                    label="About me"
                    value={individual.aboutMe}
                    onChangeText={(aboutMe) => patchIndividual({ aboutMe })}
                    multiline
                    numberOfLines={5}
                    style={styles.bio}
                  />
                  <Field
                    label="Skills (comma-separated)"
                    value={individual.skills.join(', ')}
                    onChangeText={(v) =>
                      patchIndividual({
                        skills: v
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </>
              ) : null}

              {accountType === 'company' && company ? (
                <>
                  <Text style={styles.section}>Company profile</Text>
                  <View style={styles.mediaBlock}>
                    {company.logoKey ? (
                      <Image source={{ uri: company.logoKey }} style={styles.logoPreview} />
                    ) : null}
                    <Button
                      label={mediaBusy === 'logo' ? 'Uploading to S3…' : 'Upload logo to S3'}
                      variant="outline"
                      busy={mediaBusy === 'logo'}
                      onPress={() =>
                        void uploadImage('logo', (url) => patchCompany({ logoKey: url }))
                      }
                    />
                    {company.coverImageKey ? (
                      <Image source={{ uri: company.coverImageKey }} style={styles.coverPreview} />
                    ) : null}
                    <Button
                      label={mediaBusy === 'cover' ? 'Uploading to S3…' : 'Upload cover to S3'}
                      variant="outline"
                      busy={mediaBusy === 'cover'}
                      onPress={() =>
                        void uploadImage('cover', (url) => patchCompany({ coverImageKey: url }))
                      }
                    />
                  </View>
                  <Field
                    label="Company name"
                    value={company.companyName}
                    onChangeText={(companyName) => patchCompany({ companyName })}
                  />
                  <Field
                    label="Tagline"
                    value={company.tagline}
                    onChangeText={(tagline) => patchCompany({ tagline })}
                  />
                  <Field
                    label="Website"
                    value={company.website}
                    onChangeText={(website) => patchCompany({ website })}
                  />
                  <Field
                    label="Registration number"
                    value={company.registrationNumber}
                    onChangeText={(registrationNumber) => patchCompany({ registrationNumber })}
                  />
                  <Field
                    label="Founded year"
                    value={company.foundedYear}
                    onChangeText={(foundedYear) => patchCompany({ foundedYear })}
                  />
                  <Field
                    label="Employees"
                    value={company.employeeCount != null ? String(company.employeeCount) : ''}
                    onChangeText={(v) =>
                      patchCompany({ employeeCount: v ? Number(v) : null })
                    }
                    keyboardType="number-pad"
                  />
                  <Field
                    label="About company"
                    value={company.aboutCompany}
                    onChangeText={(aboutCompany) => patchCompany({ aboutCompany })}
                    multiline
                    numberOfLines={5}
                    style={styles.bio}
                  />
                  <Field
                    label="Head office address"
                    value={company.headOfficeAddress}
                    onChangeText={(headOfficeAddress) => patchCompany({ headOfficeAddress })}
                    multiline
                  />
                </>
              ) : null}
            </>
          )}

          <Button
            label={saving ? 'Saving…' : 'Save portfolio'}
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
    marginBottom: spacing.md,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 2 },
  lede: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,36,107,0.06)',
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: '#fff' },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: colors.text },
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
  checkRow: { gap: 10, marginTop: 8, marginBottom: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkLabel: { color: colors.text, fontWeight: '600', fontSize: 14 },
  bio: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  mediaBlock: { gap: 10, marginBottom: 8 },
  logoPreview: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coverPreview: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
