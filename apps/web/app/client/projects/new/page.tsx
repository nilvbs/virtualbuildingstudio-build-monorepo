'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Boxes,
  Check,
  PackageCheck,
  Plane,
  Ruler,
  ScanLine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
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
  PROJECT_OCCUPANCY,
  PROJECT_OCCUPANCY_LABELS,
  PROJECT_OCCUPANCY_SHORT_LABELS,
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
  projectAsksOccupancy,
  projectNeedsBimDetails,
  projectNeedsLaserDetails,
  projectPostProgress,
  suggestProjectTitle,
  type ProjectDetails,
  type ProjectFileRef,
  type ProjectOccupancy,
  type ProjectPropertyType,
  type ProjectTimeline,
  type SurveyService,
} from '@surveylink/types';
import type { CreateProjectBody } from '@surveylink/api-client';
import { api, errorMessage } from '../../../../lib/api';
import { toastSuccess } from '../../../../lib/action-toast';
import {
  clearProjectPostDraft,
  readProjectPostDraft,
  writeProjectPostDraft,
} from '../../../../lib/project-post-draft';
import { reverseGeocodeAddress, type AddressSuggestion } from '../../../../lib/geocode';
import { BldMuiProvider } from '../../../../lib/bld-mui-theme';
import {
  ChoicePills,
  FieldLabel,
  MENU_PROPS,
  MultiPills,
  MultiSelectField,
  OptionCards,
  SelectField,
} from '../../../../components/project-post-fields';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const LocationMapPicker = dynamic(
  () => import('../../../../components/location-map-picker').then((m) => m.LocationMapPicker),
  {
    ssr: false,
    loading: () => <div className="location-map location-map--loading">Loading map…</div>,
  },
);

const LocationPlaceSearch = dynamic(
  () => import('../../../../components/location-place-search').then((m) => m.LocationPlaceSearch),
  { ssr: false },
);

const STEPS = PROJECT_POST_STEPS;

type ServiceGroupId = (typeof SURVEY_SERVICE_GROUPS)[number]['id'];
const SERVICE_GROUPS = SURVEY_SERVICE_GROUPS.map((g) => ({
  id: g.id as ServiceGroupId,
  label: g.label as string,
  services: g.services as readonly SurveyService[],
}));
const SERVICE_GROUP_META: Record<ServiceGroupId, { icon: LucideIcon; blurb: string }> = {
  survey_services: { icon: Ruler, blurb: 'Measured, topo, boundary, as-built' },
  laser_reality: { icon: ScanLine, blurb: 'Laser scanning, LiDAR, point clouds' },
  drone: { icon: Plane, blurb: 'Aerial survey, orthomosaics, thermal' },
  bim_cad: { icon: Boxes, blurb: 'Scan-to-BIM, Revit, CAD drafting' },
};

function dollarsToCents(raw: string): number | null {
  const n = Number(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return '';
  return String(Math.round(cents / 100));
}

function groupsWithServices(services: readonly SurveyService[]): ServiceGroupId[] {
  return SERVICE_GROUPS.filter((g) => g.services.some((s) => services.includes(s))).map((g) => g.id);
}

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function freshDetails(): ProjectDetails {
  return { ...emptyProjectDetails(), locationKnown: 'yes' };
}

function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
        {children}
      </Typography>
      {hint ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {hint}
        </Typography>
      ) : null}
    </div>
  );
}

function ReviewFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 0.75,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      {children}
    </Grid>
  );
}

function ReviewChips({ items, empty = '—' }: { items: string[]; empty?: string }) {
  if (!items.length) {
    return (
      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
        {empty}
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {items.map((item) => (
        <Chip key={item} label={item} size="small" variant="outlined" />
      ))}
    </Stack>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeDraft = searchParams.get('continue') === '1' || searchParams.get('draft') === '1';
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [resuming, setResuming] = useState(false);

  const [title, setTitle] = useState('');
  const [services, setServices] = useState<SurveyService[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroupId[]>([]);
  const [locationText, setLocationText] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [floors, setFloors] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const [neededWithin, setNeededWithin] = useState('');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState<ProjectDetails>(freshDetails);
  const [locating, setLocating] = useState(false);
  /** Last title we filled from an address; a manual edit stops auto-fill. */
  const autoTitleRef = useRef('');

  const current = STEPS[step]!;
  const isLast = current.id === 'review';
  const needsLaser = projectNeedsLaserDetails(services);
  const needsBim = projectNeedsBimDetails(services);
  const deliverableGroups = useMemo(() => deliverableGroupsForServices(services), [services]);
  const descLen = details.description.trim().length;

  const progress = useMemo(
    () =>
      projectPostProgress({
        title,
        services,
        locationText,
        location: lat && lng ? { lat: Number(lat), lng: Number(lng) } : null,
        buildingType,
        floors: floors ? Number(floors) : null,
        areaSqft: areaSqft ? Number(areaSqft) : null,
        neededWithin,
        notes,
        details,
      }),
    [title, services, locationText, lat, lng, buildingType, floors, areaSqft, neededWithin, notes, details],
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

  // New project = blank form. Only restore when continuing a saved draft.
  useEffect(() => {
    if (!resumeDraft) {
      setHydrated(true);
      return;
    }
    const parsed = readProjectPostDraft();
    if (!parsed) {
      setHydrated(true);
      return;
    }
    setTitle(parsed.title);
    setServices(parsed.services);
    setServiceGroups(groupsWithServices(parsed.services));
    setLocationText(parsed.locationText);
    setLat(parsed.lat);
    setLng(parsed.lng);
    setBuildingType(parsed.buildingType);
    setFloors(parsed.floors);
    setAreaSqft(parsed.areaSqft);
    setNeededWithin(parsed.neededWithin);
    setNotes(parsed.notes);
    setDetails({
      ...freshDetails(),
      ...parsed.details,
      locationKnown: 'yes',
    });
    setStep(Math.min(Math.max(parsed.step, 0), STEPS.length - 1));
    setResuming(true);
    setHydrated(true);
  }, [resumeDraft]);

  const patchDetails = useCallback((partial: Partial<ProjectDetails>) => {
    setDetails((prev) => ({ ...prev, ...partial }));
  }, []);

  function resetFormFields() {
    setTitle('');
    autoTitleRef.current = '';
    setServices([]);
    setServiceGroups([]);
    setLocationText('');
    setLat('');
    setLng('');
    setBuildingType('');
    setFloors('');
    setAreaSqft('');
    setNeededWithin('');
    setNotes('');
    setDetails(freshDetails());
    setStep(0);
    setError(null);
  }

  function saveDraft() {
    writeProjectPostDraft({
      step,
      title,
      services,
      locationText,
      lat,
      lng,
      buildingType,
      buildingAge: '',
      floors,
      areaSqft,
      neededWithin,
      notes,
      details,
    });
    setResuming(true);
    if (!resumeDraft) {
      router.replace('/client/projects/new?continue=1');
    }
    toastSuccess(
      'Draft saved',
      `Saved at ${STEPS[step]?.label ?? 'this step'}. Continue it anytime from Your projects.`,
    );
  }

  function resetForm() {
    resetFormFields();
    setResuming(false);
  }

  function discardDraft() {
    clearProjectPostDraft();
    resetFormFields();
    setResuming(false);
    toastSuccess('Draft discarded', 'Your saved draft was removed.');
    if (resumeDraft) router.replace('/client/projects/new');
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
        Number(areaSqft) > 0 &&
        (!projectAsksOccupancy(details.buildingStatus) || Boolean(details.occupancy))
      );
    }
    if (id === 'services') return services.length > 0 && details.scopeDeliverables.length > 0;
    if (id === 'budget') {
      if (!details.timeline) return false;
      return details.timeline !== 'specific_date' || Boolean(details.completionDate);
    }
    return true;
  }, [current.id, title, services, details, descLen, buildingType, areaSqft]);

  const stepHint: Record<string, string> = {
    location: `Add city & state, a title, a ${PROJECT_DESCRIPTION_MIN}+ character description, property type, building size and whether it is occupied`,
    services: 'Pick at least one service and one deliverable',
    budget: 'Choose when you need the work completed',
  };

  function goNext() {
    setError(null);
    if (!stepValid) {
      setError(stepHint[current.id] ?? 'Complete the required fields on this step before continuing.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function jumpTo(i: number) {
    setError(null);
    setStep(i);
  }

  function editTitle(next: string) {
    autoTitleRef.current = '';
    setTitle(next);
  }

  /** Fill address fields from a geocoded place and suggest a title unless the client typed one. */
  function applyAddress(place: AddressSuggestion) {
    if (place.label) setLocationText(place.label);
    patchDetails({
      ...(place.country ? { country: place.country } : {}),
      state: place.state,
      city: place.city,
      zip: place.postalCode,
      address: place.line1 || place.label || '',
    });
    const suggestion = suggestProjectTitle(place);
    if (!suggestion) return;
    setTitle((prev) => {
      if (prev.trim() && prev !== autoTitleRef.current) return prev;
      autoTitleRef.current = suggestion;
      return suggestion;
    });
  }

  async function pinAndFill(nextLat: number, nextLng: number) {
    setLat(nextLat.toFixed(6));
    setLng(nextLng.toFixed(6));
    try {
      const place = await reverseGeocodeAddress(nextLat, nextLng);
      if (place) applyAddress(place);
    } catch {
      // keep pin
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        patchDetails({ locationKnown: 'yes' });
        try {
          await pinAndFill(pos.coords.latitude, pos.coords.longitude);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setError(err.message || 'Could not read your current location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
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

  function selectAllDeliverables() {
    patchDetails({ scopeDeliverables: deliverablesForServices(services) });
  }

  function chooseTimeline(t: ProjectTimeline) {
    patchDetails({ timeline: t, ...(t === 'specific_date' ? {} : { completionDate: '' }) });
    setNeededWithin(t === 'specific_date' ? details.completionDate : t);
  }

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: ProjectFileRef[] = [];
      for (const file of Array.from(fileList)) {
        const res = await api.uploadMedia(file, 'document', file.name);
        uploaded.push({
          key: res.key,
          url: res.url,
          fileName: res.fileName || file.name,
          contentType: res.contentType,
          sizeBytes: file.size,
        });
      }
      setDetails((prev) => ({ ...prev, files: [...prev.files, ...uploaded] }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLast) goNext();
  }

  async function publishProject() {
    if (!isLast || busy) return;
    const firstIncomplete = STEPS.findIndex(
      (s) => s.id !== 'review' && s.id !== 'services' && progress.steps[s.id] !== 'complete',
    );
    if (firstIncomplete >= 0 || services.length === 0) {
      const target = services.length === 0 ? STEPS.findIndex((s) => s.id === 'services') : firstIncomplete;
      setError(`Finish ${STEPS[target]?.label ?? 'the earlier steps'} before publishing.`);
      return;
    }
    setError(null);
    setBusy(true);

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
    if (locationText.trim()) body.locationText = locationText.trim();
    if (lat.trim() && lng.trim()) body.location = { lat: Number(lat), lng: Number(lng) };
    if (buildingType) body.buildingType = buildingType;
    if (floors.trim()) body.floors = Number(floors);
    if (areaSqft.trim()) body.areaSqft = Math.round(Number(areaSqft));
    const timeline = details.timeline;
    if (timeline) body.neededWithin = timeline === 'specific_date' ? details.completionDate || timeline : timeline;
    const noteParts = [notes.trim(), details.specialRequirements.trim()].filter(Boolean);
    if (noteParts.length) body.notes = noteParts.join('\n\n');

    try {
      const project = await api.createProject(body);
      clearProjectPostDraft();
      toastSuccess(
        "We're finding the best surveyor",
        `"${project.title}" is live — we'll match you with a strong fit nearby.`,
      );
      router.push(`/client/projects/${project.id}/surveyors`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated) {
    return (
      <BldMuiProvider>
        <div className="project-post">
          <div className="skeleton sk-line" style={{ width: 180, height: 28 }} />
          <div className="skeleton" style={{ marginTop: 16, minHeight: 240, borderRadius: 14 }} />
        </div>
      </BldMuiProvider>
    );
  }

  const titleField = (
    <TextField
      fullWidth
      required
      label="Project title"
      placeholder="1200 Main St, Houston, TX"
      value={title}
      onChange={(e) => editTitle(e.target.value)}
      helperText={
        autoTitleRef.current && title === autoTitleRef.current
          ? 'Named after the site address — rename it anytime'
          : undefined
      }
    />
  );

  const descriptionField = (
    <TextField
      fullWidth
      required
      multiline
      minRows={2}
      maxRows={5}
      label="Short description"
      placeholder="e.g. Existing-condition survey and laser scan of a 3-storey office"
      value={details.description}
      onChange={(e) => patchDetails({ description: e.target.value })}
      helperText={
        descLen >= PROJECT_DESCRIPTION_MIN
          ? `${descLen} characters`
          : `${descLen}/${PROJECT_DESCRIPTION_MIN} characters minimum`
      }
      color={descLen >= PROJECT_DESCRIPTION_MIN ? 'success' : 'primary'}
      slotProps={{
        formHelperText: {
          sx: { color: descLen >= PROJECT_DESCRIPTION_MIN ? 'success.main' : 'text.secondary' },
        },
      }}
    />
  );

  const stepPercent = Math.round(((step + 1) / STEPS.length) * 100);
  const locationSummary =
    [details.city, details.state].filter(Boolean).join(', ') || locationText.trim() || 'Location TBD';

  return (
    <BldMuiProvider>
    <div className="project-post">
      <div className="project-post-top">
        <Link href="/client" className="project-post-back plain">
          <ArrowLeft size={15} /> Your projects
        </Link>
        <p className="project-post-sub">
          A clear brief gets you matched with surveyors who show up — scope, timing, and trust in one place.
        </p>
        <p className="project-post-meter" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          <span className="project-post-meter-bar" aria-hidden>
            <span style={{ width: `${stepPercent}%` }} />
          </span>
          <strong>
            {step + 1}/{STEPS.length}
          </strong>
        </p>
      </div>
      {resuming ? (
        <p className="project-post-draft-banner" role="status">
          Continuing your draft · {STEPS[step]?.label} (step {step + 1} of {STEPS.length})
        </p>
      ) : null}

      <form className="project-post-card" onSubmit={onFormSubmit} noValidate>
        <div className="project-post-card-head">
          <div>
            <h2 className="project-post-card-title">{current.label}</h2>
            <p className="project-post-card-blurb">{current.blurb}</p>
          </div>
        </div>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {current.id === 'location' && (
          <div className="wizard-panel wizard-panel--location" key="location">
                <div className="location-split">
                  <Stack className="location-split-fields" spacing={2.25}>
                    <LocationPlaceSearch
                      placeholder="Search site address…"
                      autoFocus
                      onSelect={(place) => {
                        setLat(place.lat.toFixed(6));
                        setLng(place.lng.toFixed(6));
                        applyAddress(place);
                      }}
                    />

                    <Button
                      type="button"
                      variant="outlined"
                      fullWidth
                      startIcon={<MyLocationIcon />}
                      onClick={useMyLocation}
                      disabled={locating}
                    >
                      {locating ? 'Finding…' : 'Use my current location'}
                    </Button>

                    <TextField
                      fullWidth
                      label="Street address"
                      value={details.address}
                      onChange={(e) => patchDetails({ address: e.target.value })}
                    />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          required
                          label="City"
                          value={details.city}
                          onChange={(e) => patchDetails({ city: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          required
                          label="State"
                          value={details.state}
                          onChange={(e) => patchDetails({ state: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="ZIP"
                          value={details.zip}
                          onChange={(e) => patchDetails({ zip: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          required
                          label="Country"
                          value={details.country}
                          onChange={(e) => patchDetails({ country: e.target.value })}
                        />
                      </Grid>
                    </Grid>

                    {descriptionField}

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <SelectField
                          id="property-type"
                          required
                          label="Property type"
                          emptyLabel="Select type"
                          options={PROJECT_PROPERTY_TYPES}
                          labels={PROJECT_PROPERTY_TYPE_LABELS}
                          value={(buildingType || null) as ProjectPropertyType | null}
                          onChange={(v) => setBuildingType(v ?? '')}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <SelectField
                          id="building-status"
                          label="Building status"
                          emptyLabel="Not sure"
                          options={PROJECT_POST_BUILDING_STATUSES}
                          labels={PROJECT_BUILDING_STATUS_LABELS}
                          value={details.buildingStatus}
                          onChange={(s) =>
                            patchDetails(
                              projectAsksOccupancy(s)
                                ? { buildingStatus: s }
                                : { buildingStatus: s, occupancy: null },
                            )
                          }
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          required
                          type="number"
                          label="Approx. building size (sq ft)"
                          placeholder="25000"
                          value={areaSqft}
                          onChange={(e) => setAreaSqft(e.target.value)}
                          error={areaSqft !== '' && !(Number(areaSqft) > 0)}
                          helperText={
                            areaSqft !== '' && !(Number(areaSqft) > 0) ? 'Enter a size greater than 0' : undefined
                          }
                          slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth>
                          <InputLabel id="floors-label">Number of floors</InputLabel>
                          <Select
                            labelId="floors-label"
                            label="Number of floors"
                            value={floors}
                            onChange={(e) => setFloors(String(e.target.value))}
                            MenuProps={MENU_PROPS}
                          >
                            <MenuItem value="">
                              <em>Not sure</em>
                            </MenuItem>
                            {PROJECT_FLOOR_OPTIONS.map((n) => (
                              <MenuItem key={n} value={String(n)}>
                                {floorOptionLabel(n)}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      {projectAsksOccupancy(details.buildingStatus) ? (
                        <Grid size={12}>
                          <FormControl required>
                            <FormLabel id="occupancy-label" sx={{ fontWeight: 700, fontSize: 14, color: 'text.primary' }}>
                              Is the Building Occupied?
                            </FormLabel>
                            <RadioGroup
                              row
                              aria-labelledby="occupancy-label"
                              value={details.occupancy ?? ''}
                              onChange={(_e, v) => patchDetails({ occupancy: v as ProjectOccupancy })}
                            >
                              {PROJECT_OCCUPANCY.map((o) => (
                                <FormControlLabel
                                  key={o}
                                  value={o}
                                  control={<Radio size="small" />}
                                  label={PROJECT_OCCUPANCY_LABELS[o]}
                                />
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </Grid>
                      ) : null}
                    </Grid>
                  </Stack>
                  <div className="location-split-map">
                    {titleField}
                    <LocationMapPicker
                      lat={lat}
                      lng={lng}
                      label={locationText.trim() || null}
                      onPick={(nextLat, nextLng) => pinAndFill(nextLat, nextLng)}
                    />
                  </div>
                </div>
          </div>
        )}

        {current.id === 'services' && (
          <Stack className="wizard-panel" key="services" spacing={2}>
            <SectionTitle hint="Pick one or more categories, then choose the exact service types.">
              What do you need? *
            </SectionTitle>
            <div className="svc-tiles" role="group" aria-label="Service categories">
              {SERVICE_GROUPS.map((group) => {
                const meta = SERVICE_GROUP_META[group.id];
                const Icon = meta.icon;
                const on = serviceGroups.includes(group.id);
                const count = services.filter((s) => group.services.includes(s)).length;
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`svc-tile${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleServiceGroup(group.id)}
                  >
                    <span className="svc-tile-icon" aria-hidden>
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <span className="svc-tile-text">
                      <strong>{group.label}</strong>
                      <small>{meta.blurb}</small>
                    </span>
                    <span className="svc-tile-state" aria-hidden>
                      {on ? count > 0 ? count : <Check size={12} strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {SERVICE_GROUPS.filter((g) => serviceGroups.includes(g.id)).map((group) => {
              const Icon = SERVICE_GROUP_META[group.id].icon;
              return (
                <div key={group.id} className="svc-panel">
                  <div className="svc-panel-head">
                    <Icon size={15} strokeWidth={2.2} aria-hidden />
                    <span>{group.label}</span>
                  </div>
                  <MultiSelectField
                    id={`svc-${group.id}`}
                    required
                    chips
                    label="Service types"
                    options={group.services}
                    labels={SURVEY_SERVICE_LABELS}
                    value={services.filter((s) => group.services.includes(s))}
                    onChange={(next) => setGroupServices(group.services, next)}
                  />
                </div>
              );
            })}

            {services.length > 0 && (
              <div className="svc-panel svc-panel--accent">
                <div className="svc-panel-head">
                  <PackageCheck size={15} strokeWidth={2.2} aria-hidden />
                  <span>Deliverables</span>
                  <Button
                    type="button"
                    size="small"
                    onClick={selectAllDeliverables}
                    sx={{ ml: 'auto', minWidth: 0, py: 0 }}
                  >
                    Select all
                  </Button>
                </div>
                <MultiSelectField
                  id="deliverables"
                  required
                  chips
                  label="Deliverables"
                  options={deliverablesForServices(services)}
                  groups={deliverableGroups}
                  labels={PROJECT_SCOPE_DELIVERABLE_LABELS}
                  value={details.scopeDeliverables}
                  onChange={(next) => patchDetails({ scopeDeliverables: next })}
                  helperText="Only deliverables that fit your selected service types are listed."
                />
              </div>
            )}

            {(needsLaser || needsBim) && (
              <Stack spacing={1.5} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <SectionTitle hint="Optional — sharpens BUILDI's price recommendation.">Preferences</SectionTitle>
                <Grid container spacing={2}>
                  {needsLaser && (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <MultiSelectField
                          id="scan-types"
                          label="Survey / scan type"
                          options={PROJECT_SCAN_TYPES}
                          labels={PROJECT_SCAN_TYPE_LABELS}
                          value={details.scanTypes}
                          onChange={(next) => patchDetails({ scanTypes: next })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <SelectField
                          id="accuracy"
                          label="Accuracy"
                          options={PROJECT_ACCURACY}
                          labels={PROJECT_ACCURACY_LABELS}
                          value={details.accuracy}
                          onChange={(a) => patchDetails({ accuracy: a })}
                        />
                      </Grid>
                    </>
                  )}
                  {needsBim && (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <SelectField
                          id="lod"
                          label="Level of detail (LOD)"
                          options={PROJECT_LOD}
                          labels={PROJECT_LOD_LABELS}
                          value={details.lod}
                          onChange={(l) => patchDetails({ lod: l })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <SelectField
                          id="bim-software"
                          label="Software"
                          options={PROJECT_BIM_SOFTWARE}
                          labels={PROJECT_BIM_SOFTWARE_LABELS}
                          value={details.bimSoftware}
                          onChange={(s) => patchDetails({ bimSoftware: s })}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </Stack>
            )}
          </Stack>
        )}

        {current.id === 'budget' && (
          <Stack className="wizard-panel" key="budget" spacing={2}>
            <div>
              <FieldLabel required>When do you need the work completed?</FieldLabel>
              <ChoicePills
                options={PROJECT_POST_TIMELINES}
                labels={PROJECT_TIMELINE_LABELS}
                value={details.timeline}
                onChange={chooseTimeline}
              />
              {details.timeline === 'specific_date' && (
                <TextField
                  sx={{ mt: 2, maxWidth: 320 }}
                  fullWidth
                  required
                  type="date"
                  label="Completion date"
                  value={details.completionDate}
                  onChange={(e) => {
                    patchDetails({ completionDate: e.target.value });
                    setNeededWithin(e.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: todayIso() } }}
                />
              )}
            </div>

            <section className="buildi-card" aria-label="BUILDI price recommendation">
              <div className="buildi-card-head">
                <span className="buildi-badge">
                  <Sparkles size={13} strokeWidth={2.4} aria-hidden /> BUILDI AI
                </span>
                <span className="buildi-card-kicker">Price recommendation</span>
              </div>
              {estimate ? (
                <>
                  <p className="buildi-card-range">{formatEstimateRange(estimate.minCents, estimate.maxCents)}</p>
                  <div className="buildi-factors">
                    {estimate.factors.map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                  <p className="buildi-card-note">
                    BUILDI analysed your scope against typical marketplace rates. Verified surveyors still send
                    their own quotes after you publish.
                  </p>
                </>
              ) : (
                <p className="buildi-card-note">
                  Add your services and the approximate building size — BUILDI will recommend a price.
                </p>
              )}
            </section>

            <div>
              <FieldLabel hint="Optional — share what you'd like to pay. Surveyors see it next to BUILDI's recommendation.">
                Your budget
              </FieldLabel>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
                <TextField
                  sx={{ maxWidth: { sm: 260 } }}
                  fullWidth
                  label="Budget (USD)"
                  placeholder={estimate ? String(Math.round((estimate.minCents + estimate.maxCents) / 200)) : '5000'}
                  value={centsToDollars(details.budgetFixedCents)}
                  onChange={(e) => patchDetails({ budgetFixedCents: dollarsToCents(e.target.value) })}
                  slotProps={{
                    htmlInput: { inputMode: 'numeric' },
                    input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                  }}
                />
                {estimate && (
                  <Button
                    type="button"
                    variant="text"
                    startIcon={<Sparkles size={15} />}
                    onClick={() =>
                      patchDetails({
                        budgetFixedCents: Math.round((estimate.minCents + estimate.maxCents) / 200) * 100,
                      })
                    }
                  >
                    Use BUILDI&apos;s price
                  </Button>
                )}
              </Stack>
            </div>
          </Stack>
        )}

        {current.id === 'review' && (
          <Stack className="wizard-panel" key="review" spacing={2}>
            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
              <Stack spacing={0.5} sx={{ mb: 1.75 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {title.trim() || 'Untitled project'}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <PlaceOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2">{locationSummary}</Typography>
                </Stack>
              </Stack>

              <Grid container spacing={2.5}>
                <ReviewFact label="Services">
                  <ReviewChips items={services.map((s) => SURVEY_SERVICE_LABELS[s])} />
                </ReviewFact>
                <ReviewFact label="Deliverables">
                  <ReviewChips
                    items={details.scopeDeliverables.map((d) => PROJECT_SCOPE_DELIVERABLE_LABELS[d])}
                  />
                </ReviewFact>
                <ReviewFact label="Property">
                  <ReviewChips
                    items={[
                      buildingType
                        ? (PROJECT_PROPERTY_TYPE_LABELS[
                            buildingType as (typeof PROJECT_PROPERTY_TYPES)[number]
                          ] ?? buildingType)
                        : '',
                      details.buildingStatus ? PROJECT_BUILDING_STATUS_LABELS[details.buildingStatus] : '',
                      details.occupancy ? PROJECT_OCCUPANCY_SHORT_LABELS[details.occupancy] : '',
                      areaSqft ? `${Number(areaSqft).toLocaleString()} sq ft` : '',
                      floors ? floorOptionLabel(Number(floors)) : '',
                    ].filter(Boolean)}
                  />
                </ReviewFact>
                <ReviewFact label="Completion">
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {details.timeline === 'specific_date' && details.completionDate
                      ? `By ${new Date(`${details.completionDate}T00:00:00`).toLocaleDateString()}`
                      : details.timeline
                        ? PROJECT_TIMELINE_LABELS[details.timeline]
                        : '—'}
                  </Typography>
                </ReviewFact>
                <ReviewFact label="BUILDI recommendation">
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {estimate ? formatEstimateRange(estimate.minCents, estimate.maxCents) : '—'}
                  </Typography>
                </ReviewFact>
                <ReviewFact label="Your budget">
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {details.budgetFixedCents
                      ? `$${Math.round(details.budgetFixedCents / 100).toLocaleString()}`
                      : 'Open to quotes'}
                  </Typography>
                </ReviewFact>
              </Grid>
            </Paper>

            <Stack spacing={2}>
              <SectionTitle hint="Optional — drawings, photos, or notes that help surveyors quote.">
                Anything else?
              </SectionTitle>
              <div>
                <Button
                  component="label"
                  variant="outlined"
                  fullWidth
                  startIcon={<UploadFileIcon />}
                  disabled={uploading}
                  sx={{ justifyContent: 'flex-start', py: 1.5 }}
                >
                  {uploading ? 'Uploading…' : 'Attach files — PDF, DWG, RVT, E57, LAS, images, ZIP'}
                  <input
                    type="file"
                    hidden
                    multiple
                    disabled={uploading}
                    accept=".pdf,.dwg,.dxf,.rvt,.rcs,.rcp,.e57,.las,.laz,.jpg,.jpeg,.png,.zip"
                    onChange={(e) => {
                      void onFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </Button>
                {details.files.length > 0 && (
                  <List dense sx={{ mt: 1 }}>
                    {details.files.map((f) => (
                      <ListItem
                        key={f.key}
                        secondaryAction={
                          <IconButton
                            edge="end"
                            aria-label={`Remove ${f.fileName}`}
                            onClick={() =>
                              setDetails((prev) => ({
                                ...prev,
                                files: prev.files.filter((x) => x.key !== f.key),
                              }))
                            }
                          >
                            <CloseIcon />
                          </IconButton>
                        }
                      >
                        <ListItemText primary={f.fileName} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </div>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Notes for surveyors"
                placeholder="Building is occupied — scanning outside business hours…"
                value={details.specialRequirements}
                onChange={(e) => patchDetails({ specialRequirements: e.target.value })}
              />
              <div>
                <FieldLabel>Preferred communication</FieldLabel>
                <MultiPills
                  options={PROJECT_COMM_CHANNELS}
                  labels={PROJECT_COMM_CHANNEL_LABELS}
                  value={details.communication}
                  onToggle={(c) => patchDetails({ communication: toggleIn(details.communication, c) })}
                />
              </div>
            </Stack>

            <div>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                Step status
              </Typography>
              <Grid container spacing={1.25}>
                {STEPS.filter((s) => s.id !== 'review').map((s) => {
                  const st = progress.steps[s.id];
                  const complete = st === 'complete';
                  const partial = st === 'partial';
                  const idx = STEPS.findIndex((x) => x.id === s.id);
                  return (
                    <Grid key={s.id} size={{ xs: 12, sm: 6 }}>
                      <Paper
                        component="button"
                        type="button"
                        variant="outlined"
                        onClick={() => jumpTo(idx)}
                        sx={{
                          appearance: 'none',
                          font: 'inherit',
                          color: 'inherit',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          px: 1.5,
                          py: 1.25,
                          textAlign: 'left',
                          cursor: 'pointer',
                          bgcolor: complete ? 'rgba(113, 104, 246, 0.06)' : 'background.paper',
                          borderColor: complete ? 'primary.main' : partial ? 'warning.main' : 'divider',
                          '&:hover': { bgcolor: 'rgba(113, 104, 246, 0.08)' },
                        }}
                      >
                        {complete ? (
                          <CheckCircleIcon color="primary" fontSize="small" />
                        ) : (
                          <RadioButtonUncheckedIcon
                            fontSize="small"
                            sx={{ color: partial ? 'warning.main' : 'text.secondary' }}
                          />
                        )}
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 700, color: 'text.primary' }}>
                          Step {idx + 1} · {s.label}
                        </Typography>
                        <Chip
                          size="small"
                          label={complete ? 'Done' : partial ? 'Needs attention' : 'Pending'}
                          color={complete ? 'primary' : partial ? 'warning' : 'default'}
                          variant={complete ? 'filled' : 'outlined'}
                        />
                        <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </div>
          </Stack>
        )}

        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            mt: 2,
            pt: 1.75,
            borderTop: 1,
            borderColor: 'divider',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
          useFlexGap
        >
          <Stack direction="row" spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={goBack}
              disabled={step === 0 || busy}
            >
              Back
            </Button>
            <Button type="button" variant="outlined" onClick={saveDraft} disabled={busy}>
              Save draft
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={resuming || resumeDraft ? discardDraft : resetForm}
              disabled={busy}
              sx={{ color: 'text.secondary' }}
            >
              {resuming || resumeDraft ? 'Discard draft' : 'Reset form'}
            </Button>
          </Stack>
          {isLast ? (
            <Button variant="contained" type="button" onClick={publishProject} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish project'}
            </Button>
          ) : (
            <Button
              variant="contained"
              type="button"
              onClick={goNext}
              disabled={!stepValid}
              endIcon={<ArrowForwardIcon />}
              title={!stepValid ? stepHint[current.id] : undefined}
            >
              Continue
            </Button>
          )}
        </Stack>
      </form>
    </div>
    </BldMuiProvider>
  );
}
