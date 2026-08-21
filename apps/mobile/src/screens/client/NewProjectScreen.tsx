import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  emptyProjectDetails,
  PROJECT_ACCURACY,
  PROJECT_ACCURACY_LABELS,
  PROJECT_BIM_DELIVERABLE_LABELS,
  PROJECT_BIM_DELIVERABLES,
  PROJECT_BIM_ELEMENT_LABELS,
  PROJECT_BIM_ELEMENTS,
  PROJECT_BIM_SOFTWARE,
  PROJECT_BIM_SOFTWARE_LABELS,
  PROJECT_BUILDING_STATUS_LABELS,
  PROJECT_BUILDING_STATUSES,
  PROJECT_COMM_CHANNEL_LABELS,
  PROJECT_COMM_CHANNELS,
  PROJECT_EXISTING_ASSET_LABELS,
  PROJECT_EXISTING_ASSETS,
  PROJECT_EXPERIENCE,
  PROJECT_EXPERIENCE_LABELS,
  PROJECT_LOD,
  PROJECT_LOD_LABELS,
  PROJECT_MIN_RATING_LABELS,
  PROJECT_MIN_RATINGS,
  PROJECT_POST_STEPS,
  PROJECT_PRICING_MODE_LABELS,
  PROJECT_PRICING_MODES,
  PROJECT_PRIORITY_LABELS,
  PROJECT_PRIORITIES,
  PROJECT_PROPERTY_TYPE_LABELS,
  PROJECT_PROPERTY_TYPES,
  PROJECT_PROVIDER_TYPE_LABELS,
  PROJECT_PROVIDER_TYPES,
  PROJECT_SCAN_OUTPUT_LABELS,
  PROJECT_SCAN_OUTPUTS,
  PROJECT_SCAN_TYPE_LABELS,
  PROJECT_SCAN_TYPES,
  PROJECT_SCOPE_DELIVERABLE_LABELS,
  PROJECT_SCOPE_GROUPS,
  PROJECT_SITE_ACCESS_WINDOW_LABELS,
  PROJECT_SITE_ACCESS_WINDOWS,
  PROJECT_TIMELINE_LABELS,
  PROJECT_TIMELINES,
  SURVEY_SERVICE_GROUPS,
  SURVEY_SERVICE_LABELS,
  projectNeedsBimDetails,
  projectNeedsLaserDetails,
  projectPostProgress,
  type ProjectDetails,
  type ProjectFileRef,
  type ProjectStepStatus,
  type SurveyService,
} from '@surveylink/types';
import type { CreateProjectBody } from '@surveylink/api-client';
import { api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, BackButton, Button } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewProject'>;

const DRAFT_KEY = 'bld.mobile.projectPostDraft.v1';
const STEPS = PROJECT_POST_STEPS;

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function dollarsToCents(raw: string): number | null {
  const n = Number(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return '';
  return String(Math.round(cents / 100));
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      {selected ? <Feather name="check" size={13} color={colors.accent} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.choiceBtn, value === o.value && styles.choiceBtnOn]}
        >
          <Text style={[styles.choiceText, value === o.value && styles.choiceTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function statusTone(s: ProjectStepStatus): 'success' | 'warn' | 'neutral' {
  if (s === 'complete') return 'success';
  if (s === 'partial') return 'warn';
  return 'neutral';
}

export function NewProjectScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const [title, setTitle] = useState('');
  const [services, setServices] = useState<SurveyService[]>([]);
  const [locationText, setLocationText] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [buildingAge, setBuildingAge] = useState('');
  const [floors, setFloors] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const [neededWithin, setNeededWithin] = useState('');
  const [details, setDetails] = useState<ProjectDetails>(() => emptyProjectDetails());

  const current = STEPS[step]!;
  const isLast = current.id === 'review';
  const needsLaser = projectNeedsLaserDetails(services);
  const needsBim = projectNeedsBimDetails(services);

  const progress = useMemo(
    () =>
      projectPostProgress({
        title,
        services,
        locationText,
        buildingType,
        floors: floors ? Number(floors) : null,
        areaSqft: areaSqft ? Number(areaSqft) : null,
        neededWithin,
        details,
      }),
    [title, services, locationText, buildingType, floors, areaSqft, neededWithin, details],
  );

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (typeof parsed.title === 'string') setTitle(parsed.title);
          if (Array.isArray(parsed.services)) setServices(parsed.services as SurveyService[]);
          if (typeof parsed.locationText === 'string') setLocationText(parsed.locationText);
          if (typeof parsed.buildingType === 'string') setBuildingType(parsed.buildingType);
          if (typeof parsed.buildingAge === 'string') setBuildingAge(parsed.buildingAge);
          if (typeof parsed.floors === 'string') setFloors(parsed.floors);
          if (typeof parsed.areaSqft === 'string') setAreaSqft(parsed.areaSqft);
          if (typeof parsed.neededWithin === 'string') setNeededWithin(parsed.neededWithin);
          if (parsed.details && typeof parsed.details === 'object') {
            setDetails({ ...emptyProjectDetails(), ...(parsed.details as ProjectDetails) });
          }
          if (typeof parsed.step === 'number') {
            setStep(Math.min(Math.max(parsed.step, 0), STEPS.length - 1));
          }
        }
      } catch {
        // ignore
      } finally {
        setDraftReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    void AsyncStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        step,
        title,
        services,
        locationText,
        buildingType,
        buildingAge,
        floors,
        areaSqft,
        neededWithin,
        details,
      }),
    );
  }, [
    draftReady,
    step,
    title,
    services,
    locationText,
    buildingType,
    buildingAge,
    floors,
    areaSqft,
    neededWithin,
    details,
  ]);

  const patchDetails = useCallback((partial: Partial<ProjectDetails>) => {
    setDetails((prev) => ({ ...prev, ...partial }));
  }, []);

  const stepValid = useMemo(() => {
    const id = current.id;
    if (id === 'overview') {
      return title.trim().length > 0 && services.length > 0 && details.description.trim().length >= 50;
    }
    if (id === 'location') {
      if (details.locationKnown === 'not_yet') return true;
      if (details.locationKnown === 'yes') {
        return Boolean(details.country.trim() && details.state.trim() && details.city.trim());
      }
      return false;
    }
    if (id === 'property') return Boolean(buildingType);
    if (id === 'services') return services.length > 0;
    if (id === 'budget') {
      if (!details.timeline || !details.pricingMode) return false;
      if (details.pricingMode === 'fixed') return (details.budgetFixedCents ?? 0) > 0;
      if (details.pricingMode === 'range') {
        return (
          (details.budgetMinCents ?? 0) > 0 &&
          (details.budgetMaxCents ?? 0) >= (details.budgetMinCents ?? 0)
        );
      }
      return true;
    }
    return true;
  }, [current.id, title, services, details, buildingType]);

  function goNext() {
    setError(null);
    if (!stepValid) {
      setError('Complete the required fields on this step before continuing.');
      return;
    }
    if (details.timeline && details.timeline !== 'specific_date') {
      setNeededWithin(details.timeline);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function pickPhotos() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required to attach files.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.85,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets.length) return;

    setUploading(true);
    try {
      const uploaded: ProjectFileRef[] = [];
      for (const asset of result.assets) {
        const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
        const type = asset.mimeType ?? 'image/jpeg';
        const res = await api.uploadMedia(
          { uri: asset.uri, name, type },
          'document',
          name,
        );
        uploaded.push({
          key: res.key,
          url: res.url,
          fileName: res.fileName || name,
          contentType: res.contentType,
        });
      }
      setDetails((prev) => ({ ...prev, files: [...prev.files, ...uploaded] }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (busy) return;
    if (progress.steps.overview !== 'complete' || progress.steps.property !== 'complete') {
      setError('Finish Overview and Property before publishing.');
      return;
    }
    setBusy(true);
    setError(null);
    const body: CreateProjectBody = {
      title: title.trim(),
      services,
      details: details as unknown as Record<string, unknown>,
    };
    if (locationText.trim()) body.locationText = locationText.trim();
    if (buildingType) body.buildingType = buildingType;
    if (buildingAge.trim()) body.buildingAge = buildingAge.trim();
    if (floors.trim()) body.floors = Number(floors);
    if (areaSqft.trim()) body.areaSqft = Number(areaSqft);
    const timeline = details.timeline;
    if (timeline) {
      body.neededWithin =
        timeline === 'specific_date' ? details.completionDate || timeline : timeline;
    }
    if (details.specialRequirements.trim()) body.notes = details.specialRequirements.trim();

    try {
      const project = await api.createProject(body);
      await AsyncStorage.removeItem(DRAFT_KEY);
      navigation.replace('ProjectSurveyors', { id: project.id });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function clearDraft() {
    await AsyncStorage.removeItem(DRAFT_KEY);
    setTitle('');
    setServices([]);
    setLocationText('');
    setBuildingType('');
    setBuildingAge('');
    setFloors('');
    setAreaSqft('');
    setNeededWithin('');
    setDetails(emptyProjectDetails());
    setStep(0);
    setError(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <BackButton label="Projects" onPress={() => navigation.goBack()} />
        <Text style={styles.pct}>{progress.percent}%</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Post a project</Text>
        <Text style={styles.sub}>
          Same guided brief as web — green steps are saved, open steps are pending.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {STEPS.map((s, i) => {
            const st = progress.steps[s.id];
            const active = i === step;
            const tone = statusTone(st);
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  setError(null);
                  setStep(i);
                }}
                style={[
                  styles.railItem,
                  active && styles.railItemActive,
                  tone === 'success' && styles.railComplete,
                  tone === 'warn' && styles.railPartial,
                ]}
              >
                <View
                  style={[
                    styles.railMark,
                    tone === 'success' && styles.railMarkOk,
                    tone === 'warn' && styles.railMarkWarn,
                  ]}
                >
                  {st === 'complete' ? (
                    <Feather name="check" size={12} color={colors.ice} />
                  ) : (
                    <Text style={styles.railMarkText}>{i + 1}</Text>
                  )}
                </View>
                <View>
                  <Text style={styles.railLabel}>{s.label}</Text>
                  <Text style={styles.railStatus}>
                    {st === 'complete' ? 'Saved' : st === 'partial' ? 'In progress' : 'Pending'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.card}>
          <Text style={styles.stepKicker}>
            Step {step + 1} of {STEPS.length}
          </Text>
          <Text style={styles.stepTitle}>{current.label}</Text>
          <Text style={styles.stepBlurb}>{current.blurb}</Text>

          {error ? (
            <View style={{ marginBottom: spacing.md }}>
              <AlertBox message={error} />
            </View>
          ) : null}

          {current.id === 'overview' && (
            <View style={styles.panel}>
              <Text style={styles.label}>Project title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Commercial Building Laser Scan – Houston"
                placeholderTextColor={colors.faint}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.label, { marginTop: spacing.lg }]}>What do you need? *</Text>
              {SURVEY_SERVICE_GROUPS.map((group) => (
                <View key={group.id} style={styles.groupBox}>
                  <Text style={styles.groupTitle}>{group.label}</Text>
                  <View style={styles.chipGrid}>
                    {group.services.map((s) => (
                      <Chip
                        key={s}
                        label={SURVEY_SERVICE_LABELS[s]}
                        selected={services.includes(s)}
                        onPress={() => setServices((prev) => toggleIn(prev, s))}
                      />
                    ))}
                  </View>
                </View>
              ))}

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                multiline
                placeholder="Describe the site, deliverables, and constraints…"
                placeholderTextColor={colors.faint}
                value={details.description}
                onChangeText={(t) => patchDetails({ description: t })}
              />
              <Text
                style={[
                  styles.hint,
                  details.description.trim().length >= 50 && { color: colors.ok },
                ]}
              >
                {details.description.trim().length}/50 minimum
              </Text>
            </View>
          )}

          {current.id === 'location' && (
            <View style={styles.panel}>
              <Text style={styles.label}>Location known? *</Text>
              <ChoiceRow
                value={details.locationKnown}
                onChange={(v) =>
                  patchDetails({ locationKnown: v as ProjectDetails['locationKnown'] })
                }
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'not_yet', label: 'Not yet' },
                ]}
              />

              {details.locationKnown === 'yes' && (
                <>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Country *</Text>
                  <TextInput
                    style={styles.input}
                    value={details.country}
                    onChangeText={(t) => patchDetails({ country: t })}
                    placeholderTextColor={colors.faint}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>State *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Texas"
                    placeholderTextColor={colors.faint}
                    value={details.state}
                    onChangeText={(t) => patchDetails({ state: t })}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>City *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Houston"
                    placeholderTextColor={colors.faint}
                    value={details.city}
                    onChangeText={(t) => patchDetails({ city: t })}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>ZIP</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="77001"
                    placeholderTextColor={colors.faint}
                    value={details.zip}
                    onChangeText={(t) => patchDetails({ zip: t })}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Optional site address"
                    placeholderTextColor={colors.faint}
                    value={locationText}
                    onChangeText={setLocationText}
                  />

                  <Text style={[styles.label, { marginTop: spacing.lg }]}>Site access required?</Text>
                  <ChoiceRow
                    value={details.siteAccessRequired}
                    onChange={(v) =>
                      patchDetails({
                        siteAccessRequired: v as ProjectDetails['siteAccessRequired'],
                      })
                    }
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                      { value: 'not_sure', label: 'Not sure' },
                    ]}
                  />
                  {details.siteAccessRequired === 'yes' && (
                    <View style={[styles.chipGrid, { marginTop: spacing.md }]}>
                      {PROJECT_SITE_ACCESS_WINDOWS.map((w) => (
                        <Chip
                          key={w}
                          label={PROJECT_SITE_ACCESS_WINDOW_LABELS[w]}
                          selected={details.siteAccessWindows.includes(w)}
                          onPress={() =>
                            patchDetails({
                              siteAccessWindows: toggleIn(details.siteAccessWindows, w),
                            })
                          }
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {current.id === 'property' && (
            <View style={styles.panel}>
              <Text style={styles.label}>Property type *</Text>
              <View style={styles.chipGrid}>
                {PROJECT_PROPERTY_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={PROJECT_PROPERTY_TYPE_LABELS[t]}
                    selected={buildingType === t}
                    onPress={() => setBuildingType(t)}
                  />
                ))}
              </View>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Building status</Text>
              <View style={styles.chipGrid}>
                {PROJECT_BUILDING_STATUSES.map((s) => (
                  <Chip
                    key={s}
                    label={PROJECT_BUILDING_STATUS_LABELS[s]}
                    selected={details.buildingStatus === s}
                    onPress={() => patchDetails({ buildingStatus: s })}
                  />
                ))}
              </View>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Area (sq ft)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="50000"
                placeholderTextColor={colors.faint}
                value={areaSqft}
                onChangeText={setAreaSqft}
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>Floors</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="3"
                placeholderTextColor={colors.faint}
                value={floors}
                onChangeText={setFloors}
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>Year built</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor={colors.faint}
                value={details.yearBuilt}
                onChangeText={(t) => patchDetails({ yearBuilt: t })}
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>Building age notes</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1990s"
                placeholderTextColor={colors.faint}
                value={buildingAge}
                onChangeText={setBuildingAge}
              />
            </View>
          )}

          {current.id === 'services' && (
            <View style={styles.panel}>
              <Text style={styles.hint}>
                Selected:{' '}
                {services.map((s) => SURVEY_SERVICE_LABELS[s]).join(', ') || 'none yet'}
              </Text>

              {needsLaser ? (
                <>
                  <Text style={[styles.groupTitle, { marginTop: spacing.lg }]}>Laser scanning</Text>
                  <Text style={styles.label}>Scanning type</Text>
                  <View style={styles.chipGrid}>
                    {PROJECT_SCAN_TYPES.map((t) => (
                      <Chip
                        key={t}
                        label={PROJECT_SCAN_TYPE_LABELS[t]}
                        selected={details.scanTypes.includes(t)}
                        onPress={() =>
                          patchDetails({ scanTypes: toggleIn(details.scanTypes, t) })
                        }
                      />
                    ))}
                  </View>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Output</Text>
                  <View style={styles.chipGrid}>
                    {PROJECT_SCAN_OUTPUTS.map((o) => (
                      <Chip
                        key={o}
                        label={PROJECT_SCAN_OUTPUT_LABELS[o]}
                        selected={details.scanOutputs.includes(o)}
                        onPress={() =>
                          patchDetails({ scanOutputs: toggleIn(details.scanOutputs, o) })
                        }
                      />
                    ))}
                  </View>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Accuracy</Text>
                  <ChoiceRow
                    value={details.accuracy}
                    onChange={(v) =>
                      patchDetails({ accuracy: v as ProjectDetails['accuracy'] })
                    }
                    options={PROJECT_ACCURACY.map((a) => ({
                      value: a,
                      label: PROJECT_ACCURACY_LABELS[a],
                    }))}
                  />
                </>
              ) : null}

              {needsBim ? (
                <>
                  <Text style={[styles.groupTitle, { marginTop: spacing.xl }]}>BIM</Text>
                  <Text style={styles.label}>Software</Text>
                  <ChoiceRow
                    value={details.bimSoftware}
                    onChange={(v) =>
                      patchDetails({ bimSoftware: v as ProjectDetails['bimSoftware'] })
                    }
                    options={PROJECT_BIM_SOFTWARE.map((s) => ({
                      value: s,
                      label: PROJECT_BIM_SOFTWARE_LABELS[s],
                    }))}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>LOD</Text>
                  <ChoiceRow
                    value={details.lod}
                    onChange={(v) => patchDetails({ lod: v as ProjectDetails['lod'] })}
                    options={PROJECT_LOD.map((l) => ({
                      value: l,
                      label: PROJECT_LOD_LABELS[l],
                    }))}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Elements</Text>
                  <View style={styles.chipGrid}>
                    {PROJECT_BIM_ELEMENTS.map((el) => (
                      <Chip
                        key={el}
                        label={PROJECT_BIM_ELEMENT_LABELS[el]}
                        selected={details.bimElements.includes(el)}
                        onPress={() =>
                          patchDetails({ bimElements: toggleIn(details.bimElements, el) })
                        }
                      />
                    ))}
                  </View>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>BIM deliverables</Text>
                  <View style={styles.chipGrid}>
                    {PROJECT_BIM_DELIVERABLES.map((d) => (
                      <Chip
                        key={d}
                        label={PROJECT_BIM_DELIVERABLE_LABELS[d]}
                        selected={details.bimDeliverables.includes(d)}
                        onPress={() =>
                          patchDetails({
                            bimDeliverables: toggleIn(details.bimDeliverables, d),
                          })
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {!needsLaser && !needsBim ? (
                <Text style={[styles.hint, { marginTop: spacing.lg }]}>
                  Add laser or BIM services in Overview to unlock detailed requirements — or continue.
                </Text>
              ) : null}
            </View>
          )}

          {current.id === 'scope' && (
            <View style={styles.panel}>
              {PROJECT_SCOPE_GROUPS.map((group) => (
                <View key={group.id} style={styles.groupBox}>
                  <Text style={styles.groupTitle}>{group.label}</Text>
                  <View style={styles.chipGrid}>
                    {group.items.map((item) => (
                      <Chip
                        key={item}
                        label={PROJECT_SCOPE_DELIVERABLE_LABELS[item]}
                        selected={details.scopeDeliverables.includes(item)}
                        onPress={() =>
                          patchDetails({
                            scopeDeliverables: toggleIn(details.scopeDeliverables, item),
                          })
                        }
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {current.id === 'budget' && (
            <View style={styles.panel}>
              <Text style={styles.label}>Timeline *</Text>
              <ChoiceRow
                value={details.timeline}
                onChange={(v) => {
                  const timeline = v as ProjectDetails['timeline'];
                  patchDetails({ timeline });
                  if (timeline && timeline !== 'specific_date') setNeededWithin(timeline);
                }}
                options={PROJECT_TIMELINES.map((t) => ({
                  value: t,
                  label: PROJECT_TIMELINE_LABELS[t],
                }))}
              />
              {details.timeline === 'specific_date' ? (
                <>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Completion date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.faint}
                    value={details.completionDate}
                    onChangeText={(t) => patchDetails({ completionDate: t })}
                  />
                </>
              ) : null}

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Priority</Text>
              <ChoiceRow
                value={details.priority}
                onChange={(v) => patchDetails({ priority: v as ProjectDetails['priority'] })}
                options={PROJECT_PRIORITIES.map((p) => ({
                  value: p,
                  label: PROJECT_PRIORITY_LABELS[p],
                }))}
              />

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Pricing *</Text>
              <ChoiceRow
                value={details.pricingMode}
                onChange={(v) =>
                  patchDetails({ pricingMode: v as ProjectDetails['pricingMode'] })
                }
                options={PROJECT_PRICING_MODES.map((m) => ({
                  value: m,
                  label: PROJECT_PRICING_MODE_LABELS[m],
                }))}
              />
              {details.pricingMode === 'fixed' ? (
                <>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Budget (USD)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="5000"
                    placeholderTextColor={colors.faint}
                    value={centsToDollars(details.budgetFixedCents)}
                    onChangeText={(t) => patchDetails({ budgetFixedCents: dollarsToCents(t) })}
                  />
                </>
              ) : null}
              {details.pricingMode === 'range' ? (
                <>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Min (USD)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="5000"
                    placeholderTextColor={colors.faint}
                    value={centsToDollars(details.budgetMinCents)}
                    onChangeText={(t) => patchDetails({ budgetMinCents: dollarsToCents(t) })}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Max (USD)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="10000"
                    placeholderTextColor={colors.faint}
                    value={centsToDollars(details.budgetMaxCents)}
                    onChangeText={(t) => patchDetails({ budgetMaxCents: dollarsToCents(t) })}
                  />
                </>
              ) : null}
            </View>
          )}

          {current.id === 'files' && (
            <View style={styles.panel}>
              <Text style={styles.label}>Existing project data?</Text>
              <ChoiceRow
                value={details.existingData}
                onChange={(v) =>
                  patchDetails({ existingData: v as ProjectDetails['existingData'] })
                }
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                  { value: 'not_sure', label: 'Not sure' },
                ]}
              />
              {details.existingData === 'yes' ? (
                <View style={[styles.chipGrid, { marginTop: spacing.md }]}>
                  {PROJECT_EXISTING_ASSETS.map((a) => (
                    <Chip
                      key={a}
                      label={PROJECT_EXISTING_ASSET_LABELS[a]}
                      selected={details.existingAssets.includes(a)}
                      onPress={() =>
                        patchDetails({
                          existingAssets: toggleIn(details.existingAssets, a),
                        })
                      }
                    />
                  ))}
                </View>
              ) : null}

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Photos / files</Text>
              <Button
                label={uploading ? 'Uploading…' : 'Add photos from library'}
                variant="outline"
                icon="image"
                busy={uploading}
                onPress={() => void pickPhotos()}
              />
              {details.files.map((f) => (
                <View key={f.key} style={styles.fileRow}>
                  <Feather name="paperclip" size={14} color={colors.muted} />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {f.fileName}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setDetails((prev) => ({
                        ...prev,
                        files: prev.files.filter((x) => x.key !== f.key),
                      }))
                    }
                  >
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              ))}

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Provider type</Text>
              <View style={styles.chipGrid}>
                {PROJECT_PROVIDER_TYPES.map((p) => (
                  <Chip
                    key={p}
                    label={PROJECT_PROVIDER_TYPE_LABELS[p]}
                    selected={details.providerTypes.includes(p)}
                    onPress={() =>
                      patchDetails({ providerTypes: toggleIn(details.providerTypes, p) })
                    }
                  />
                ))}
              </View>
              <Chip
                label="Verified providers only"
                selected={details.verifiedOnly}
                onPress={() => patchDetails({ verifiedOnly: !details.verifiedOnly })}
              />

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Experience</Text>
              <ChoiceRow
                value={details.experience}
                onChange={(v) =>
                  patchDetails({ experience: v as ProjectDetails['experience'] })
                }
                options={PROJECT_EXPERIENCE.map((x) => ({
                  value: x,
                  label: PROJECT_EXPERIENCE_LABELS[x],
                }))}
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>Min rating</Text>
              <ChoiceRow
                value={details.minRating}
                onChange={(v) =>
                  patchDetails({ minRating: v as ProjectDetails['minRating'] })
                }
                options={PROJECT_MIN_RATINGS.map((r) => ({
                  value: r,
                  label: PROJECT_MIN_RATING_LABELS[r],
                }))}
              />

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Special requirements</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                multiline
                placeholder="Occupied building, after-hours access…"
                placeholderTextColor={colors.faint}
                value={details.specialRequirements}
                onChangeText={(t) => patchDetails({ specialRequirements: t })}
              />

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Communication</Text>
              <View style={styles.chipGrid}>
                {PROJECT_COMM_CHANNELS.map((c) => (
                  <Chip
                    key={c}
                    label={PROJECT_COMM_CHANNEL_LABELS[c]}
                    selected={details.communication.includes(c)}
                    onPress={() =>
                      patchDetails({ communication: toggleIn(details.communication, c) })
                    }
                  />
                ))}
              </View>
            </View>
          )}

          {current.id === 'review' && (
            <View style={styles.panel}>
              <Text style={styles.reviewTitle}>{title.trim() || 'Untitled project'}</Text>
              <Text style={styles.hint}>
                {[details.city, details.state].filter(Boolean).join(', ') ||
                  locationText.trim() ||
                  'Location TBD'}
              </Text>

              <View style={styles.reviewGrid}>
                <Text style={styles.reviewDt}>Services</Text>
                <Text style={styles.reviewDd}>
                  {services.map((s) => SURVEY_SERVICE_LABELS[s]).join(', ') || '—'}
                </Text>
                <Text style={styles.reviewDt}>Property</Text>
                <Text style={styles.reviewDd}>
                  {buildingType
                    ? PROJECT_PROPERTY_TYPE_LABELS[
                        buildingType as (typeof PROJECT_PROPERTY_TYPES)[number]
                      ] ?? buildingType
                    : '—'}
                  {areaSqft ? ` · ${areaSqft} sq ft` : ''}
                </Text>
                <Text style={styles.reviewDt}>Timeline</Text>
                <Text style={styles.reviewDd}>
                  {details.timeline ? PROJECT_TIMELINE_LABELS[details.timeline] : '—'}
                </Text>
                <Text style={styles.reviewDt}>Budget</Text>
                <Text style={styles.reviewDd}>
                  {details.pricingMode === 'fixed' && details.budgetFixedCents
                    ? `$${(details.budgetFixedCents / 100).toLocaleString()}`
                    : details.pricingMode === 'range' &&
                        details.budgetMinCents &&
                        details.budgetMaxCents
                      ? `$${(details.budgetMinCents / 100).toLocaleString()} – $${(details.budgetMaxCents / 100).toLocaleString()}`
                      : details.pricingMode === 'open'
                        ? 'Open for proposals'
                        : '—'}
                </Text>
                <Text style={styles.reviewDt}>Files</Text>
                <Text style={styles.reviewDd}>
                  {details.files.length
                    ? `${details.files.length} attachment${details.files.length === 1 ? '' : 's'}`
                    : 'None'}
                </Text>
              </View>

              {STEPS.filter((s) => s.id !== 'review').map((s, i) => {
                const st = progress.steps[s.id];
                return (
                  <Pressable
                    key={s.id}
                    style={styles.reviewStep}
                    onPress={() => setStep(i)}
                  >
                    <Feather
                      name={st === 'complete' ? 'check-circle' : 'circle'}
                      size={16}
                      color={st === 'complete' ? colors.ok : colors.faint}
                    />
                    <Text style={styles.reviewStepLabel}>{s.label}</Text>
                    <Text style={styles.reviewStepStatus}>
                      {st === 'complete' ? 'Saved' : st === 'partial' ? 'Needs attention' : 'Pending'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Back"
          variant="outline"
          disabled={step === 0 || busy}
          onPress={() => {
            setError(null);
            setStep((s) => Math.max(s - 1, 0));
          }}
          style={{ flex: 1 }}
        />
        <Pressable onPress={() => void clearDraft()} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
        {isLast ? (
          <Button
            label={busy ? 'Publishing…' : 'Publish'}
            busy={busy}
            onPress={() => void publish()}
            style={{ flex: 1.4 }}
          />
        ) : (
          <Button
            label="Continue"
            disabled={!stepValid}
            onPress={goNext}
            style={{ flex: 1.4 }}
          />
        )}
      </View>
      {uploading ? (
        <View style={styles.uploadBanner}>
          <ActivityIndicator color={colors.ice} />
          <Text style={styles.uploadText}>Uploading…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  pct: { fontWeight: '800', color: colors.accent, fontSize: 15 },
  scroll: { padding: spacing.xl, paddingBottom: 120 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  sub: { color: colors.muted, marginTop: 6, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  rail: { gap: 8, paddingBottom: spacing.md },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    marginRight: 8,
    minWidth: 132,
  },
  railItemActive: {
    borderColor: colors.accent2,
    ...shadows.sm,
  },
  railComplete: { borderColor: 'rgba(5,150,105,0.35)' },
  railPartial: { borderColor: 'rgba(183,121,31,0.4)' },
  railMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft2,
  },
  railMarkOk: { backgroundColor: colors.ok, borderColor: colors.ok },
  railMarkWarn: { backgroundColor: colors.warnSoft, borderColor: colors.warn },
  railMarkText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  railLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  railStatus: { fontSize: 11, color: colors.muted, marginTop: 1 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  stepKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
  stepBlurb: { color: colors.muted, marginTop: 4, marginBottom: spacing.lg, fontSize: 13.5 },
  panel: { gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.page,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  hint: { color: colors.muted, fontSize: 12.5, marginTop: 6 },
  groupBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft2,
  },
  groupTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: { fontSize: 12.5, color: colors.muted, fontWeight: '600' },
  chipTextOn: { color: colors.accent },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.panel,
  },
  choiceBtnOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  choiceText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  choiceTextOn: { color: colors.accent, fontWeight: '800' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  fileName: { flex: 1, color: colors.text, fontSize: 13 },
  remove: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  reviewTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  reviewGrid: { marginTop: spacing.lg, gap: 4 },
  reviewDt: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.muted,
    marginTop: 8,
  },
  reviewDd: { fontSize: 14, fontWeight: '700', color: colors.text },
  reviewStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewStepLabel: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 13.5 },
  reviewStepStatus: { color: colors.muted, fontSize: 12 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 10 },
  clearText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  uploadBanner: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  uploadText: { color: colors.ice, fontWeight: '700', fontSize: 13 },
});
