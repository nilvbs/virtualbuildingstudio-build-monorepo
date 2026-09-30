import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
  deliverableGroupsForServices,
  deliverablesForServices,
  emptyProjectDetails,
  estimateProjectPrice,
  floorOptionLabel,
  formatEstimateRange,
  PROJECT_ACCURACY,
  PROJECT_ACCURACY_LABELS,
  PROJECT_BIM_SOFTWARE,
  PROJECT_BIM_SOFTWARE_LABELS,
  PROJECT_BUILDING_STATUS_LABELS,
  PROJECT_COMM_CHANNEL_LABELS,
  PROJECT_COMM_CHANNELS,
  PROJECT_DESCRIPTION_MIN,
  PROJECT_FLOOR_OPTIONS,
  PROJECT_LOD,
  PROJECT_LOD_LABELS,
  PROJECT_POST_BUILDING_STATUSES,
  PROJECT_POST_STEPS,
  PROJECT_POST_TIMELINES,
  PROJECT_PROPERTY_TYPE_LABELS,
  PROJECT_PROPERTY_TYPES,
  PROJECT_SCAN_TYPE_LABELS,
  PROJECT_SCAN_TYPES,
  PROJECT_SCOPE_DELIVERABLE_LABELS,
  PROJECT_TIMELINE_LABELS,
  SURVEY_SERVICE_GROUPS,
  SURVEY_SERVICE_LABELS,
  projectNeedsBimDetails,
  projectNeedsLaserDetails,
  projectPostProgress,
  suggestProjectTitle,
  type ProjectDetails,
  type ProjectFileRef,
  type SurveyService,
} from '@surveylink/types';
import type { CreateProjectBody } from '@surveylink/api-client';
import { api, errorMessage } from '../../lib/api';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { AlertBox, BackButton, Button } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewProject'>;

const DRAFT_KEY = 'bld.mobile.projectPostDraft.v1';
/** Bump when PROJECT_POST_STEPS changes so saved step indexes are not misapplied. */
const DRAFT_LAYOUT = 3;
const STEPS = PROJECT_POST_STEPS;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function freshDetails(): ProjectDetails {
  return { ...emptyProjectDetails(), locationKnown: 'yes' };
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function completionDateOk(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)) && value >= todayIso();
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
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
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

function SelectField({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable style={[styles.input, styles.selectBox]} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !selected && { color: colors.faint }]}>
          {selected?.label ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  style={styles.modalOption}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, o.value === value && styles.choiceTextOn]}>
                    {o.label}
                  </Text>
                  {o.value === value ? <Feather name="check" size={16} color={colors.accent} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

type SelectSection = { id: string; title?: string; items: Array<{ value: string; label: string }> };

function MultiSelectField({
  value,
  placeholder,
  sections,
  onChange,
}: {
  value: readonly string[];
  placeholder: string;
  sections: SelectSection[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const labelOf = new Map(sections.flatMap((s) => s.items.map((i) => [i.value, i.label] as const)));
  const summary = value.map((v) => labelOf.get(v) ?? v).join(', ');
  return (
    <>
      <Pressable style={[styles.input, styles.selectBox]} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !summary && { color: colors.faint }]} numberOfLines={2}>
          {summary || placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <ScrollView>
              {sections.map((section) => (
                <View key={section.id}>
                  {section.title ? <Text style={styles.modalSection}>{section.title}</Text> : null}
                  {section.items.map((o) => {
                    const on = value.includes(o.value);
                    return (
                      <Pressable
                        key={o.value}
                        style={styles.modalOption}
                        onPress={() => onChange(toggleIn([...value], o.value))}
                      >
                        <Text style={[styles.modalOptionText, on && styles.choiceTextOn]}>{o.label}</Text>
                        <Feather
                          name={on ? 'check-square' : 'square'}
                          size={18}
                          color={on ? colors.accent : colors.faint}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.modalDone} onPress={() => setOpen(false)}>
              <Text style={styles.link}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

type ServiceGroupId = (typeof SURVEY_SERVICE_GROUPS)[number]['id'];
const SERVICE_GROUPS = SURVEY_SERVICE_GROUPS.map((g) => ({
  id: g.id as ServiceGroupId,
  label: g.label as string,
  services: g.services as readonly SurveyService[],
}));

const SERVICE_GROUP_META: Record<
  ServiceGroupId,
  { icon: 'map' | 'crosshair' | 'navigation' | 'box'; blurb: string }
> = {
  survey_services: { icon: 'map', blurb: 'Measured, topo, boundary, as-built' },
  laser_reality: { icon: 'crosshair', blurb: 'Laser scanning, LiDAR, point clouds' },
  drone: { icon: 'navigation', blurb: 'Aerial survey, orthomosaics, thermal' },
  bim_cad: { icon: 'box', blurb: 'Scan-to-BIM, Revit, CAD drafting' },
};

function groupsWithServices(services: readonly SurveyService[]): ServiceGroupId[] {
  return SERVICE_GROUPS.filter((g) => g.services.some((s) => services.includes(s))).map((g) => g.id);
}

const FLOOR_SELECT_OPTIONS = [
  { value: '', label: 'Not sure' },
  ...PROJECT_FLOOR_OPTIONS.map((n) => ({ value: String(n), label: floorOptionLabel(n) })),
];

export function NewProjectScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const [title, setTitle] = useState('');
  const [services, setServices] = useState<SurveyService[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroupId[]>([]);
  const [buildingType, setBuildingType] = useState('');
  const [floors, setFloors] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const [neededWithin, setNeededWithin] = useState('');
  const [details, setDetails] = useState<ProjectDetails>(freshDetails);
  /** Last title derived from the address; a manual edit stops auto-fill. */
  const autoTitleRef = useRef('');

  const current = STEPS[step]!;
  const isLast = current.id === 'review';
  const needsLaser = projectNeedsLaserDetails(services);
  const needsBim = projectNeedsBimDetails(services);
  const deliverableGroups = useMemo(() => deliverableGroupsForServices(services), [services]);
  const descLen = details.description.trim().length;
  const locationText = [details.address, details.city, details.state, details.zip]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');

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

  const estimate = useMemo(
    () =>
      estimateProjectPrice({
        services,
        areaSqft: areaSqft ? Number(areaSqft) : null,
        floors: floors ? Number(floors) : null,
        buildingType,
        buildingStatus: details.buildingStatus,
        scanTypes: details.scanTypes,
        accuracy: details.accuracy,
        lod: details.lod,
        deliverables: details.scopeDeliverables,
        timeline: details.timeline,
      }),
    [services, areaSqft, floors, buildingType, details],
  );

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (typeof parsed.title === 'string') setTitle(parsed.title);
          if (typeof parsed.autoTitle === 'string') autoTitleRef.current = parsed.autoTitle;
          if (Array.isArray(parsed.services)) {
            setServices(parsed.services as SurveyService[]);
            setServiceGroups(groupsWithServices(parsed.services as SurveyService[]));
          }
          if (typeof parsed.buildingType === 'string') setBuildingType(parsed.buildingType);
          if (typeof parsed.floors === 'string') setFloors(parsed.floors);
          if (typeof parsed.areaSqft === 'string') setAreaSqft(parsed.areaSqft);
          if (typeof parsed.neededWithin === 'string') setNeededWithin(parsed.neededWithin);
          if (parsed.details && typeof parsed.details === 'object') {
            const saved = parsed.details as ProjectDetails;
            setDetails({ ...freshDetails(), ...saved, locationKnown: 'yes' });
          }
          if (parsed.layout === DRAFT_LAYOUT && typeof parsed.step === 'number') {
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
        layout: DRAFT_LAYOUT,
        step,
        title,
        autoTitle: autoTitleRef.current,
        services,
        buildingType,
        floors,
        areaSqft,
        neededWithin,
        details,
      }),
    );
  }, [draftReady, step, title, services, buildingType, floors, areaSqft, neededWithin, details]);

  const patchDetails = useCallback((partial: Partial<ProjectDetails>) => {
    setDetails((prev) => ({ ...prev, ...partial }));
  }, []);

  /** Update an address field and keep the title in sync until the client renames it. */
  function patchAddress(partial: Partial<Pick<ProjectDetails, 'address' | 'city' | 'state' | 'zip' | 'country'>>) {
    const next = { ...details, ...partial };
    setDetails(next);
    const suggestion = suggestProjectTitle({ line1: next.address, city: next.city, state: next.state });
    if (!title.trim() || title === autoTitleRef.current) {
      autoTitleRef.current = suggestion;
      setTitle(suggestion);
    }
  }

  function editTitle(next: string) {
    autoTitleRef.current = '';
    setTitle(next);
  }

  function applyServices(next: SurveyService[]) {
    setServices(next);
    const allowed = new Set(deliverablesForServices(next));
    setDetails((prev) => ({
      ...prev,
      scopeDeliverables: prev.scopeDeliverables.filter((d) => allowed.has(d)),
    }));
  }

  function toggleServiceGroup(id: ServiceGroupId) {
    if (serviceGroups.includes(id)) {
      setServiceGroups(serviceGroups.filter((g) => g !== id));
      const group = SERVICE_GROUPS.find((g) => g.id === id);
      if (group) applyServices(services.filter((s) => !group.services.includes(s)));
    } else {
      setServiceGroups([...serviceGroups, id]);
    }
  }

  function setGroupServices(groupServices: readonly SurveyService[], picked: SurveyService[]) {
    applyServices([...services.filter((s) => !groupServices.includes(s)), ...picked]);
  }

  const stepValid = useMemo(() => {
    const id = current.id;
    if (id === 'location') {
      const addressOk = Boolean(details.country.trim() && details.state.trim() && details.city.trim());
      return (
        addressOk &&
        title.trim().length > 0 &&
        descLen >= PROJECT_DESCRIPTION_MIN &&
        Boolean(buildingType) &&
        Number(areaSqft) > 0
      );
    }
    if (id === 'services') return services.length > 0 && details.scopeDeliverables.length > 0;
    if (id === 'budget') {
      if (!details.timeline) return false;
      return details.timeline !== 'specific_date' || completionDateOk(details.completionDate);
    }
    return true;
  }, [current.id, title, services, details, descLen, buildingType, areaSqft]);

  const stepHint: Record<string, string> = {
    location: `Add city & state, a title, a ${PROJECT_DESCRIPTION_MIN}+ character description, property type and size.`,
    services: 'Pick at least one service and one deliverable.',
    budget: 'Choose when you need the work completed (dates as YYYY-MM-DD, today or later).',
  };

  function goNext() {
    setError(null);
    if (!stepValid) {
      setError(stepHint[current.id] ?? 'Complete the required fields on this step before continuing.');
      return;
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
        const res = await api.uploadMedia({ uri: asset.uri, name, type }, 'document', name);
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
    const firstIncomplete = STEPS.findIndex(
      (s) => s.id !== 'review' && s.id !== 'services' && progress.steps[s.id] !== 'complete',
    );
    if (firstIncomplete >= 0 || services.length === 0) {
      const target = services.length === 0 ? STEPS.findIndex((s) => s.id === 'services') : firstIncomplete;
      setError(`Finish ${STEPS[target]?.label ?? 'the earlier steps'} before publishing.`);
      return;
    }
    setBusy(true);
    setError(null);
    const finalDetails: ProjectDetails = {
      ...details,
      pricingMode: details.budgetFixedCents ? 'fixed' : 'open',
      estimateMinCents: estimate?.minCents ?? null,
      estimateMaxCents: estimate?.maxCents ?? null,
    };
    const body: CreateProjectBody = {
      title: title.trim(),
      services,
      details: finalDetails as unknown as Record<string, unknown>,
    };
    if (locationText) body.locationText = locationText;
    if (buildingType) body.buildingType = buildingType;
    if (floors.trim()) body.floors = Number(floors);
    if (areaSqft.trim()) body.areaSqft = Math.round(Number(areaSqft));
    const timeline = details.timeline;
    if (timeline) {
      body.neededWithin = timeline === 'specific_date' ? details.completionDate || timeline : timeline;
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
    autoTitleRef.current = '';
    setServices([]);
    setServiceGroups([]);
    setBuildingType('');
    setFloors('');
    setAreaSqft('');
    setNeededWithin('');
    setDetails(freshDetails());
    setStep(0);
    setError(null);
  }

  const stepPercent = ((step + 1) / STEPS.length) * 100;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <BackButton label="Projects" onPress={() => navigation.goBack()} />
        <Text style={styles.pct}>
          Step {step + 1} of {STEPS.length}
        </Text>
      </View>
      <View style={styles.meter}>
        <View style={[styles.meterFill, { width: `${stepPercent}%` }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Post a project</Text>

        <View style={styles.card}>
          <Text style={styles.stepTitle}>{current.label}</Text>
          <Text style={styles.stepBlurb}>{current.blurb}</Text>

          {error ? (
            <View style={{ marginBottom: spacing.md }}>
              <AlertBox message={error} />
            </View>
          ) : null}

          {current.id === 'location' && (
            <View style={styles.panel}>
                <>
                  <Text style={styles.label}>Street address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1200 Main St"
                    placeholderTextColor={colors.faint}
                    value={details.address}
                    onChangeText={(t) => patchAddress({ address: t })}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>City *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Houston"
                    placeholderTextColor={colors.faint}
                    value={details.city}
                    onChangeText={(t) => patchAddress({ city: t })}
                  />
                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { marginTop: spacing.md }]}>State *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="TX"
                        placeholderTextColor={colors.faint}
                        value={details.state}
                        onChangeText={(t) => patchAddress({ state: t })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { marginTop: spacing.md }]}>ZIP</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="77001"
                        keyboardType="number-pad"
                        placeholderTextColor={colors.faint}
                        value={details.zip}
                        onChangeText={(t) => patchAddress({ zip: t })}
                      />
                    </View>
                  </View>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Country *</Text>
                  <TextInput
                    style={styles.input}
                    value={details.country}
                    onChangeText={(t) => patchAddress({ country: t })}
                    placeholderTextColor={colors.faint}
                  />
                </>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Project title *</Text>
              <TextInput
                style={styles.input}
                placeholder="1200 Main St, Houston, TX"
                placeholderTextColor={colors.faint}
                value={title}
                onChangeText={editTitle}
              />
              {autoTitleRef.current && title === autoTitleRef.current ? (
                <Text style={styles.hint}>Named after the site address — rename it anytime.</Text>
              ) : null}

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Short description *</Text>
              <TextInput
                style={[styles.input, styles.textareaSm]}
                multiline
                placeholder="e.g. Existing-condition survey and laser scan of a 3-storey office"
                placeholderTextColor={colors.faint}
                value={details.description}
                onChangeText={(t) => patchDetails({ description: t })}
              />
              <Text style={[styles.hint, descLen >= PROJECT_DESCRIPTION_MIN && { color: colors.ok }]}>
                {descLen}/{PROJECT_DESCRIPTION_MIN} characters minimum
              </Text>

              <View style={styles.divider} />
              <Text style={styles.label}>Property type *</Text>
              <SelectField
                value={buildingType}
                placeholder="Select type"
                options={PROJECT_PROPERTY_TYPES.map((t) => ({ value: t, label: PROJECT_PROPERTY_TYPE_LABELS[t] }))}
                onChange={setBuildingType}
              />

              <Text style={[styles.label, { marginTop: spacing.md }]}>Building status</Text>
              <ChoiceRow
                value={details.buildingStatus}
                onChange={(v) => patchDetails({ buildingStatus: v as ProjectDetails['buildingStatus'] })}
                options={PROJECT_POST_BUILDING_STATUSES.map((s) => ({
                  value: s,
                  label: PROJECT_BUILDING_STATUS_LABELS[s],
                }))}
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Size (sq ft) *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="25000"
                    placeholderTextColor={colors.faint}
                    value={areaSqft}
                    onChangeText={(t) => setAreaSqft(t.replace(/[^0-9]/g, ''))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Floors</Text>
                  <SelectField
                    value={floors}
                    placeholder="Select"
                    options={FLOOR_SELECT_OPTIONS}
                    onChange={setFloors}
                  />
                </View>
              </View>
            </View>
          )}

          {current.id === 'services' && (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>What do you need? *</Text>
              <Text style={styles.hint}>Pick one or more categories, then choose the service types.</Text>
              <View style={styles.tileGrid}>
                {SERVICE_GROUPS.map((g) => {
                  const on = serviceGroups.includes(g.id);
                  const count = services.filter((s) => g.services.includes(s)).length;
                  const meta = SERVICE_GROUP_META[g.id];
                  return (
                    <Pressable
                      key={g.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => toggleServiceGroup(g.id)}
                      style={[styles.tile, on && styles.tileOn]}
                    >
                      <View style={[styles.tileIcon, on && styles.tileIconOn]}>
                        <Feather name={meta.icon} size={16} color={on ? colors.ice : colors.accent} />
                      </View>
                      <Text style={styles.tileTitle} numberOfLines={2}>
                        {g.label}
                      </Text>
                      <Text style={styles.tileBlurb} numberOfLines={2}>
                        {meta.blurb}
                      </Text>
                      {on && count > 0 ? (
                        <View style={styles.tileCount}>
                          <Text style={styles.tileCountText}>{count}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {SERVICE_GROUPS.filter((g) => serviceGroups.includes(g.id)).map((g) => (
                <View key={g.id} style={{ marginTop: spacing.md }}>
                  <Text style={styles.label}>{g.label} — service types *</Text>
                  <MultiSelectField
                    placeholder="Select service types"
                    sections={[
                      { id: g.id, items: g.services.map((s) => ({ value: s, label: SURVEY_SERVICE_LABELS[s] })) },
                    ]}
                    value={services.filter((s) => g.services.includes(s))}
                    onChange={(next) => setGroupServices(g.services, next as SurveyService[])}
                  />
                </View>
              ))}

              {services.length > 0 ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Deliverables *</Text>
                    <Pressable
                      onPress={() => patchDetails({ scopeDeliverables: deliverablesForServices(services) })}
                    >
                      <Text style={styles.link}>Select all</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.hint}>Only deliverables that fit your selected service types.</Text>
                  <View style={{ marginTop: spacing.sm }}>
                    <MultiSelectField
                      placeholder="Select deliverables"
                      sections={deliverableGroups.map((group) => ({
                        id: group.id,
                        title: group.label,
                        items: group.items.map((d) => ({ value: d, label: PROJECT_SCOPE_DELIVERABLE_LABELS[d] })),
                      }))}
                      value={details.scopeDeliverables}
                      onChange={(next) =>
                        patchDetails({ scopeDeliverables: next as ProjectDetails['scopeDeliverables'] })
                      }
                    />
                  </View>
                </>
              ) : null}

              {needsLaser || needsBim ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Preferences</Text>
                  <Text style={styles.hint}>Optional — helps us recommend a price.</Text>
                </>
              ) : null}
              {needsLaser ? (
                <>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Survey / scan type</Text>
                  <MultiSelectField
                    placeholder="No preference"
                    sections={[
                      {
                        id: 'scan',
                        items: PROJECT_SCAN_TYPES.map((t) => ({ value: t, label: PROJECT_SCAN_TYPE_LABELS[t] })),
                      },
                    ]}
                    value={details.scanTypes}
                    onChange={(next) => patchDetails({ scanTypes: next as ProjectDetails['scanTypes'] })}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Accuracy</Text>
                  <SelectField
                    value={details.accuracy ?? ''}
                    placeholder="No preference"
                    options={[
                      { value: '', label: 'No preference' },
                      ...PROJECT_ACCURACY.map((a) => ({ value: a, label: PROJECT_ACCURACY_LABELS[a] })),
                    ]}
                    onChange={(v) => patchDetails({ accuracy: (v || null) as ProjectDetails['accuracy'] })}
                  />
                </>
              ) : null}
              {needsBim ? (
                <>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Level of detail (LOD)</Text>
                  <SelectField
                    value={details.lod ?? ''}
                    placeholder="No preference"
                    options={[
                      { value: '', label: 'No preference' },
                      ...PROJECT_LOD.map((l) => ({ value: l, label: PROJECT_LOD_LABELS[l] })),
                    ]}
                    onChange={(v) => patchDetails({ lod: (v || null) as ProjectDetails['lod'] })}
                  />
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Software</Text>
                  <SelectField
                    value={details.bimSoftware ?? ''}
                    placeholder="No preference"
                    options={[
                      { value: '', label: 'No preference' },
                      ...PROJECT_BIM_SOFTWARE.map((s) => ({ value: s, label: PROJECT_BIM_SOFTWARE_LABELS[s] })),
                    ]}
                    onChange={(v) => patchDetails({ bimSoftware: (v || null) as ProjectDetails['bimSoftware'] })}
                  />
                </>
              ) : null}
            </View>
          )}

          {current.id === 'budget' && (
            <View style={styles.panel}>
              <Text style={styles.label}>When do you need the work completed? *</Text>
              <ChoiceRow
                value={details.timeline}
                onChange={(v) => {
                  const timeline = v as (typeof PROJECT_POST_TIMELINES)[number];
                  patchDetails({
                    timeline,
                    ...(timeline === 'specific_date' ? {} : { completionDate: '' }),
                  });
                  setNeededWithin(timeline === 'specific_date' ? details.completionDate : timeline);
                }}
                options={PROJECT_POST_TIMELINES.map((t) => ({ value: t, label: PROJECT_TIMELINE_LABELS[t] }))}
              />
              {details.timeline === 'specific_date' ? (
                <>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Completion date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.faint}
                    value={details.completionDate}
                    onChangeText={(t) => {
                      patchDetails({ completionDate: t });
                      setNeededWithin(t);
                    }}
                  />
                  {details.completionDate && !completionDateOk(details.completionDate) ? (
                    <Text style={[styles.hint, { color: colors.danger }]}>
                      Use YYYY-MM-DD, today or later.
                    </Text>
                  ) : null}
                </>
              ) : null}

              <View style={styles.buildiCard}>
                <View style={styles.buildiHead}>
                  <View style={styles.buildiBadge}>
                    <Feather name="zap" size={11} color="#fff" />
                    <Text style={styles.buildiBadgeText}>BUILDI AI</Text>
                  </View>
                  <Text style={styles.buildiKicker}>Price recommendation</Text>
                </View>
                {estimate ? (
                  <>
                    <Text style={styles.buildiRange}>
                      {formatEstimateRange(estimate.minCents, estimate.maxCents)}
                    </Text>
                    <View style={styles.buildiFactors}>
                      {estimate.factors.map((f) => (
                        <View key={f} style={styles.buildiFactor}>
                          <Text style={styles.buildiFactorText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.buildiNote}>
                      BUILDI analysed your scope against typical marketplace rates. Verified surveyors still send
                      their own quotes after you publish.
                    </Text>
                  </>
                ) : (
                  <Text style={styles.buildiNote}>
                    Add your services and the approximate building size — BUILDI will recommend a price.
                  </Text>
                )}
              </View>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Your budget (USD)</Text>
              <View style={styles.row2}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="number-pad"
                  placeholder={
                    estimate ? String(Math.round((estimate.minCents + estimate.maxCents) / 200)) : '5000'
                  }
                  placeholderTextColor={colors.faint}
                  value={details.budgetFixedCents ? String(Math.round(details.budgetFixedCents / 100)) : ''}
                  onChangeText={(t) => {
                    const n = Number(t.replace(/[^0-9]/g, ''));
                    patchDetails({ budgetFixedCents: n > 0 ? n * 100 : null });
                  }}
                />
                {estimate ? (
                  <Pressable
                    style={styles.buildiUse}
                    onPress={() =>
                      patchDetails({
                        budgetFixedCents: Math.round((estimate.minCents + estimate.maxCents) / 200) * 100,
                      })
                    }
                  >
                    <Feather name="zap" size={13} color={colors.accent} />
                    <Text style={styles.link}>Use BUILDI&apos;s</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.hint}>Optional — surveyors see it next to BUILDI&apos;s recommendation.</Text>
            </View>
          )}

          {current.id === 'review' && (
            <View style={styles.panel}>
              <Text style={styles.reviewTitle}>{title.trim() || 'Untitled project'}</Text>
              <Text style={styles.hint}>
                {[details.city, details.state].filter(Boolean).join(', ') ||
                  'Location TBD'}
              </Text>

              <View style={styles.reviewGrid}>
                <Text style={styles.reviewDt}>Services</Text>
                <Text style={styles.reviewDd}>
                  {services.map((s) => SURVEY_SERVICE_LABELS[s]).join(', ') || '—'}
                </Text>
                <Text style={styles.reviewDt}>Deliverables</Text>
                <Text style={styles.reviewDd}>
                  {details.scopeDeliverables.map((d) => PROJECT_SCOPE_DELIVERABLE_LABELS[d]).join(', ') || '—'}
                </Text>
                <Text style={styles.reviewDt}>Property</Text>
                <Text style={styles.reviewDd}>
                  {[
                    buildingType
                      ? (PROJECT_PROPERTY_TYPE_LABELS[buildingType as (typeof PROJECT_PROPERTY_TYPES)[number]] ??
                        buildingType)
                      : '',
                    details.buildingStatus ? PROJECT_BUILDING_STATUS_LABELS[details.buildingStatus] : '',
                    areaSqft ? `${Number(areaSqft).toLocaleString()} sq ft` : '',
                    floors ? floorOptionLabel(Number(floors)) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Text>
                <Text style={styles.reviewDt}>Completion</Text>
                <Text style={styles.reviewDd}>
                  {details.timeline === 'specific_date' && details.completionDate
                    ? `By ${details.completionDate}`
                    : details.timeline
                      ? PROJECT_TIMELINE_LABELS[details.timeline]
                      : '—'}
                </Text>
                <Text style={styles.reviewDt}>BUILDI recommendation</Text>
                <Text style={styles.reviewDd}>
                  {estimate ? formatEstimateRange(estimate.minCents, estimate.maxCents) : '—'}
                </Text>
                <Text style={styles.reviewDt}>Your budget</Text>
                <Text style={styles.reviewDd}>
                  {details.budgetFixedCents
                    ? `$${Math.round(details.budgetFixedCents / 100).toLocaleString()}`
                    : 'Open to quotes'}
                </Text>
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Anything else?</Text>
              <Text style={styles.hint}>Optional — photos or notes that help surveyors quote.</Text>
              <View style={{ marginTop: spacing.md }}>
                <Button
                  label={uploading ? 'Uploading…' : 'Add photos from library'}
                  variant="outline"
                  icon="image"
                  busy={uploading}
                  onPress={() => void pickPhotos()}
                />
              </View>
              {details.files.map((f) => (
                <View key={f.key} style={styles.fileRow}>
                  <Feather name="paperclip" size={14} color={colors.muted} />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {f.fileName}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setDetails((prev) => ({ ...prev, files: prev.files.filter((x) => x.key !== f.key) }))
                    }
                  >
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Notes for surveyors</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                multiline
                placeholder="Occupied building, after-hours access…"
                placeholderTextColor={colors.faint}
                value={details.specialRequirements}
                onChangeText={(t) => patchDetails({ specialRequirements: t })}
              />
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Preferred communication</Text>
              <View style={styles.chipGrid}>
                {PROJECT_COMM_CHANNELS.map((c) => (
                  <Chip
                    key={c}
                    label={PROJECT_COMM_CHANNEL_LABELS[c]}
                    selected={details.communication.includes(c)}
                    onPress={() => patchDetails({ communication: toggleIn(details.communication, c) })}
                  />
                ))}
              </View>

              <View style={styles.divider} />
              {STEPS.filter((s) => s.id !== 'review').map((s, i) => {
                const st = progress.steps[s.id];
                return (
                  <Pressable key={s.id} style={styles.reviewStep} onPress={() => setStep(i)}>
                    <Feather
                      name={st === 'complete' ? 'check-circle' : 'circle'}
                      size={16}
                      color={st === 'complete' ? colors.ok : st === 'partial' ? colors.warn : colors.faint}
                    />
                    <Text style={styles.reviewStepLabel}>
                      Step {i + 1} · {s.label}
                    </Text>
                    <Text style={styles.reviewStepStatus}>
                      {st === 'complete' ? 'Done' : st === 'partial' ? 'Needs attention' : 'Pending'}
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
          <Button label="Continue" disabled={!stepValid} onPress={goNext} style={{ flex: 1.4 }} />
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
  pct: { fontWeight: '800', color: colors.accent, fontSize: 14 },
  meter: {
    height: 4,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: 2,
    backgroundColor: colors.accentSoft2,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  scroll: { padding: spacing.xl, paddingBottom: 120 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: spacing.md,
  },
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
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  row2: { flexDirection: 'row', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
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
  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontSize: 15, color: colors.text },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 40, 0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  modalOptionText: { fontSize: 15, color: colors.text, flex: 1, paddingRight: 8 },
  modalSection: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 4,
  },
  modalDone: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  textareaSm: { minHeight: 64, textAlignVertical: 'top' },
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
    alignSelf: 'flex-start',
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
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.md },
  tile: {
    width: '48%',
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  tileOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft2,
    marginBottom: 8,
  },
  tileIconOn: { backgroundColor: colors.accent },
  tileTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  tileBlurb: { fontSize: 11.5, color: colors.muted, marginTop: 2, lineHeight: 15 },
  tileCount: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  tileCountText: { color: colors.ice, fontSize: 11, fontWeight: '800' },
  buildiCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: '#312e81',
    borderWidth: 1,
    borderColor: '#5b21b6',
    ...shadows.sm,
  },
  buildiHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buildiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  buildiBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  buildiKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '600' },
  buildiRange: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 10, letterSpacing: -0.5 },
  buildiFactors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  buildiFactor: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  buildiFactorText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  buildiNote: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 17, marginTop: 10 },
  buildiUse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
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
