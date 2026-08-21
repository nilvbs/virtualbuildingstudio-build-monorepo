'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Circle, Sparkles } from 'lucide-react';
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
  PROJECT_EXISTING_DATA,
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
  type ProjectPostStepId,
  type ProjectStepStatus,
  type SurveyService,
} from '@surveylink/types';
import type { CreateProjectBody } from '@surveylink/api-client';
import { api, errorMessage } from '../../../../lib/api';
import { reverseGeocode } from '../../../../lib/geocode';
import { BldMuiProvider } from '../../../../lib/bld-mui-theme';
import {
  ChoicePills,
  FieldLabel,
  MultiPills,
  OptionCards,
} from '../../../../components/project-post-fields';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
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

const DRAFT_KEY = 'bld.projectPostDraft.v1';
const STEPS = PROJECT_POST_STEPS;
type StepId = ProjectPostStepId;

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

function statusClass(s: ProjectStepStatus): string {
  if (s === 'complete') return 'is-complete';
  if (s === 'partial') return 'is-partial';
  return 'is-pending';
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
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const [title, setTitle] = useState('');
  const [services, setServices] = useState<SurveyService[]>([]);
  const [locationText, setLocationText] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [buildingAge, setBuildingAge] = useState('');
  const [floors, setFloors] = useState('');
  const [areaSqft, setAreaSqft] = useState('');
  const [neededWithin, setNeededWithin] = useState('');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState<ProjectDetails>(() => emptyProjectDetails());
  const [locating, setLocating] = useState(false);

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

  // Restore draft once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        step?: number;
        title?: string;
        services?: SurveyService[];
        locationText?: string;
        lat?: string;
        lng?: string;
        buildingType?: string;
        buildingAge?: string;
        floors?: string;
        areaSqft?: string;
        neededWithin?: string;
        notes?: string;
        details?: ProjectDetails;
      };
      if (parsed.title) setTitle(parsed.title);
      if (parsed.services) setServices(parsed.services);
      if (parsed.locationText) setLocationText(parsed.locationText);
      if (parsed.lat) setLat(parsed.lat);
      if (parsed.lng) setLng(parsed.lng);
      if (parsed.buildingType) setBuildingType(parsed.buildingType);
      if (parsed.buildingAge) setBuildingAge(parsed.buildingAge);
      if (parsed.floors) setFloors(parsed.floors);
      if (parsed.areaSqft) setAreaSqft(parsed.areaSqft);
      if (parsed.neededWithin) setNeededWithin(parsed.neededWithin);
      if (parsed.notes) setNotes(parsed.notes);
      if (parsed.details) setDetails({ ...emptyProjectDetails(), ...parsed.details });
      if (typeof parsed.step === 'number') setStep(Math.min(Math.max(parsed.step, 0), STEPS.length - 1));
    } catch {
      // ignore corrupt draft
    } finally {
      setDraftReady(true);
    }
  }, []);

  // Persist draft.
  useEffect(() => {
    if (!draftReady) return;
    const payload = {
      step,
      title,
      services,
      locationText,
      lat,
      lng,
      buildingType,
      buildingAge,
      floors,
      areaSqft,
      neededWithin,
      notes,
      details,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  }, [
    draftReady,
    step,
    title,
    services,
    locationText,
    lat,
    lng,
    buildingType,
    buildingAge,
    floors,
    areaSqft,
    neededWithin,
    notes,
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
      if (!details.timeline) return false;
      if (!details.pricingMode) return false;
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
    // Keep neededWithin in sync with timeline for matching / legacy fields.
    if (details.timeline && details.timeline !== 'specific_date') {
      setNeededWithin(details.timeline);
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

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setLat(nextLat.toFixed(6));
        setLng(nextLng.toFixed(6));
        patchDetails({ locationKnown: 'yes' });
        try {
          const address = await reverseGeocode(nextLat, nextLng);
          if (address) setLocationText(address);
        } catch {
          // pin still set
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
    if (progress.steps.overview !== 'complete' || progress.steps.property !== 'complete') {
      setError('Finish Overview and Property before publishing.');
      return;
    }
    setError(null);
    setBusy(true);

    const body: CreateProjectBody = {
      title: title.trim(),
      services,
      details: details as unknown as Record<string, unknown>,
    };
    if (locationText.trim()) body.locationText = locationText.trim();
    if (lat.trim() && lng.trim()) body.location = { lat: Number(lat), lng: Number(lng) };
    if (buildingType) body.buildingType = buildingType;
    if (buildingAge.trim()) body.buildingAge = buildingAge.trim();
    if (floors.trim()) body.floors = Number(floors);
    if (areaSqft.trim()) body.areaSqft = Number(areaSqft);
    const timeline = details.timeline;
    if (timeline) body.neededWithin = timeline === 'specific_date' ? details.completionDate || timeline : timeline;
    const noteParts = [notes.trim(), details.specialRequirements.trim()].filter(Boolean);
    if (noteParts.length) body.notes = noteParts.join('\n\n');

    try {
      const project = await api.createProject(body);
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/client/projects/${project.id}/surveyors`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setTitle('');
    setServices([]);
    setLocationText('');
    setLat('');
    setLng('');
    setBuildingType('');
    setBuildingAge('');
    setFloors('');
    setAreaSqft('');
    setNeededWithin('');
    setNotes('');
    setDetails(emptyProjectDetails());
    setStep(0);
  }

  return (
    <BldMuiProvider>
    <div className="project-post">
      <Link href="/client" className="project-post-back plain">
        <ArrowLeft size={15} /> Your projects
      </Link>

      <header className="project-post-hero">
        <div>
          <p className="kicker">Client brief</p>
          <h1 className="page-title">Post a project</h1>
          <p className="page-sub">
            Guided brief with clear progress — saved fields stay green, pending stay open.
          </p>
        </div>
        <div className="project-post-ring" aria-label={`Brief ${progress.percent}% complete`}>
          <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="36" r="30" className="project-post-ring-track" />
            <circle
              cx="36"
              cy="36"
              r="30"
              className="project-post-ring-value"
              style={{ strokeDashoffset: `${188.4 - (188.4 * progress.percent) / 100}` }}
            />
          </svg>
          <strong>{progress.percent}%</strong>
          <span>complete</span>
        </div>
      </header>

      <ol className="project-post-rail" aria-label="Project steps">
        {STEPS.map((s, i) => {
          const st = progress.steps[s.id];
          const active = i === step;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`project-post-rail-item ${statusClass(st)} ${active ? 'is-active' : ''}`}
                onClick={() => jumpTo(i)}
              >
                <span className="project-post-rail-mark" aria-hidden>
                  {st === 'complete' ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                </span>
                <span className="project-post-rail-copy">
                  <strong>{s.label}</strong>
                  <span>
                    {st === 'complete' ? 'Saved' : st === 'partial' ? 'In progress' : 'Pending'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <form className="card card-pad-lg project-post-card" onSubmit={onFormSubmit} noValidate>
        <div className="wizard-panel-head">
          <p className="kicker">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="wizard-panel-title">{current.label}</h2>
          <p className="page-sub" style={{ margin: 0 }}>
            {current.blurb}
          </p>
        </div>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: 'wrap' }} useFlexGap>
          <Button
            type="button"
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={goBack}
            disabled={step === 0 || busy}
          >
            Back
          </Button>
          <Button type="button" variant="outlined" onClick={clearDraft} disabled={busy}>
            Clear draft
          </Button>
        </Stack>

        {current.id === 'overview' && (
          <Stack className="wizard-panel" key="overview" spacing={2.5}>
            <TextField
              fullWidth
              required
              autoFocus
              label="Project title"
              placeholder="Commercial Building Laser Scan & BIM Modeling – Houston"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div>
              <FieldLabel required hint="Pick one or more service groups, then refine.">
                What do you need?
              </FieldLabel>
              <Stack spacing={2}>
                {SURVEY_SERVICE_GROUPS.map((group) => (
                  <div key={group.id}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {group.label}
                    </Typography>
                    <OptionCards
                      options={group.services}
                      labels={SURVEY_SERVICE_LABELS}
                      value={services}
                      onToggle={(s) => setServices((prev) => toggleIn(prev, s))}
                    />
                  </div>
                ))}
              </Stack>
            </div>

            <TextField
              fullWidth
              required
              multiline
              minRows={5}
              label="Short project description"
              placeholder="We need an existing-condition survey and laser scan of a three-story commercial building…"
              value={details.description}
              onChange={(e) => patchDetails({ description: e.target.value })}
              helperText={`${details.description.trim().length}/50 minimum · recommended 100–500`}
              slotProps={{
                formHelperText: {
                  sx: { color: details.description.trim().length >= 50 ? 'success.main' : undefined },
                },
              }}
            />
          </Stack>
        )}

        {current.id === 'location' && (
          <div className="wizard-panel wizard-panel--location" key="location">
            <Stack spacing={2.5}>
              <div>
                <FieldLabel required>Is this project location known?</FieldLabel>
                <ChoicePills
                  options={['yes', 'not_yet'] as const}
                  labels={{ yes: 'Yes', not_yet: 'Not yet' }}
                  value={details.locationKnown}
                  onChange={(value) => patchDetails({ locationKnown: value })}
                />
              </div>

              {details.locationKnown === 'yes' && (
                <div className="location-split">
                  <Stack className="location-split-fields" spacing={2.25}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          required
                          label="Country"
                          value={details.country}
                          onChange={(e) => patchDetails({ country: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          required
                          label="State"
                          placeholder="Texas"
                          value={details.state}
                          onChange={(e) => patchDetails({ state: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          required
                          label="City"
                          placeholder="Houston"
                          value={details.city}
                          onChange={(e) => patchDetails({ city: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="ZIP"
                          placeholder="77001"
                          value={details.zip}
                          onChange={(e) => patchDetails({ zip: e.target.value })}
                        />
                      </Grid>
                    </Grid>

                    <LocationPlaceSearch
                      onSelect={(nextLat, nextLng, label) => {
                        setLat(nextLat.toFixed(6));
                        setLng(nextLng.toFixed(6));
                        setLocationText(label);
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Project address"
                      placeholder="Optional initially"
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
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

                    <div>
                      <FieldLabel>Is physical site access required?</FieldLabel>
                      <ChoicePills
                        options={['yes', 'no', 'not_sure'] as const}
                        labels={{ yes: 'Yes', no: 'No', not_sure: 'Not sure' }}
                        value={details.siteAccessRequired}
                        onChange={(value) => patchDetails({ siteAccessRequired: value })}
                      />
                    </div>

                    {details.siteAccessRequired === 'yes' && (
                      <div>
                        <FieldLabel>Site access availability</FieldLabel>
                        <MultiPills
                          options={PROJECT_SITE_ACCESS_WINDOWS}
                          labels={PROJECT_SITE_ACCESS_WINDOW_LABELS}
                          value={details.siteAccessWindows}
                          onToggle={(w) =>
                            patchDetails({ siteAccessWindows: toggleIn(details.siteAccessWindows, w) })
                          }
                        />
                      </div>
                    )}
                  </Stack>
                  <div className="location-split-map">
                    <LocationMapPicker
                      lat={lat}
                      lng={lng}
                      label={locationText.trim() || null}
                      onPick={async (nextLat, nextLng) => {
                        setLat(nextLat.toFixed(6));
                        setLng(nextLng.toFixed(6));
                        try {
                          const address = await reverseGeocode(nextLat, nextLng);
                          if (address) setLocationText(address);
                        } catch {
                          // keep pin
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {details.locationKnown === 'not_yet' && (
                <Typography variant="body2">
                  You can add the exact pin later — we&apos;ll still start matching on services and timing.
                </Typography>
              )}
            </Stack>
          </div>
        )}

        {current.id === 'property' && (
          <Stack className="wizard-panel" key="property" spacing={2.5}>
            <div>
              <FieldLabel required>Property type</FieldLabel>
              <OptionCards
                exclusive
                options={PROJECT_PROPERTY_TYPES}
                labels={PROJECT_PROPERTY_TYPE_LABELS}
                value={buildingType}
                onToggle={setBuildingType}
              />
            </div>

            <div>
              <FieldLabel>Building status</FieldLabel>
              <ChoicePills
                options={PROJECT_BUILDING_STATUSES}
                labels={PROJECT_BUILDING_STATUS_LABELS}
                value={details.buildingStatus}
                onChange={(s) => patchDetails({ buildingStatus: s })}
              />
            </div>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Approx. building size (sq ft)"
                  placeholder="50000"
                  value={areaSqft}
                  onChange={(e) => setAreaSqft(e.target.value)}
                  slotProps={{ htmlInput: { min: 0 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Number of floors"
                  placeholder="3"
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                  slotProps={{ htmlInput: { min: 0 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Site area"
                  placeholder="Optional"
                  value={details.siteArea}
                  onChange={(e) => patchDetails({ siteArea: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Year built"
                  placeholder="Optional"
                  value={details.yearBuilt}
                  onChange={(e) => patchDetails({ yearBuilt: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Building age notes"
                  placeholder="e.g. 1990s, pre-1950"
                  value={buildingAge}
                  onChange={(e) => setBuildingAge(e.target.value)}
                />
              </Grid>
            </Grid>
          </Stack>
        )}

        {current.id === 'services' && (
          <Stack className="wizard-panel" key="services" spacing={2.5}>
            <Typography variant="body2">
              Selected: {services.map((s) => SURVEY_SERVICE_LABELS[s]).join(', ') || 'none yet'}
            </Typography>

            {!needsLaser && !needsBim && (
              <Alert icon={<Sparkles size={18} />} severity="info">
                No laser or BIM services selected yet. Add them in Overview if you need scan or model
                requirements — or continue with a simpler scope.
              </Alert>
            )}

            {needsLaser && (
              <Stack spacing={2.5} sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">Laser scanning</Typography>
                <div>
                  <FieldLabel>Required scanning type</FieldLabel>
                  <OptionCards
                    options={PROJECT_SCAN_TYPES}
                    labels={PROJECT_SCAN_TYPE_LABELS}
                    value={details.scanTypes}
                    onToggle={(t) => patchDetails({ scanTypes: toggleIn(details.scanTypes, t) })}
                  />
                </div>
                <div>
                  <FieldLabel>Required output</FieldLabel>
                  <OptionCards
                    options={PROJECT_SCAN_OUTPUTS}
                    labels={PROJECT_SCAN_OUTPUT_LABELS}
                    value={details.scanOutputs}
                    onToggle={(o) => patchDetails({ scanOutputs: toggleIn(details.scanOutputs, o) })}
                  />
                </div>
                <div>
                  <FieldLabel>Accuracy requirement</FieldLabel>
                  <ChoicePills
                    options={PROJECT_ACCURACY}
                    labels={PROJECT_ACCURACY_LABELS}
                    value={details.accuracy}
                    onChange={(a) => patchDetails({ accuracy: a })}
                  />
                </div>
              </Stack>
            )}

            {needsBim && (
              <Stack spacing={2.5} sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">BIM requirements</Typography>
                <div>
                  <FieldLabel>Required BIM software</FieldLabel>
                  <ChoicePills
                    options={PROJECT_BIM_SOFTWARE}
                    labels={PROJECT_BIM_SOFTWARE_LABELS}
                    value={details.bimSoftware}
                    onChange={(s) => patchDetails({ bimSoftware: s })}
                  />
                </div>
                <div>
                  <FieldLabel>Required LOD</FieldLabel>
                  <ChoicePills
                    options={PROJECT_LOD}
                    labels={PROJECT_LOD_LABELS}
                    value={details.lod}
                    onChange={(l) => patchDetails({ lod: l })}
                  />
                </div>
                <div>
                  <FieldLabel>Required elements</FieldLabel>
                  <OptionCards
                    options={PROJECT_BIM_ELEMENTS}
                    labels={PROJECT_BIM_ELEMENT_LABELS}
                    value={details.bimElements}
                    onToggle={(el) => patchDetails({ bimElements: toggleIn(details.bimElements, el) })}
                  />
                </div>
                <div>
                  <FieldLabel>BIM deliverables</FieldLabel>
                  <OptionCards
                    options={PROJECT_BIM_DELIVERABLES}
                    labels={PROJECT_BIM_DELIVERABLE_LABELS}
                    value={details.bimDeliverables}
                    onToggle={(d) =>
                      patchDetails({ bimDeliverables: toggleIn(details.bimDeliverables, d) })
                    }
                  />
                </div>
              </Stack>
            )}
          </Stack>
        )}

        {current.id === 'scope' && (
          <Stack className="wizard-panel" key="scope" spacing={2.5}>
            <Typography variant="body2">What should the provider deliver?</Typography>
            {PROJECT_SCOPE_GROUPS.map((group) => (
              <div key={group.id}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {group.label}
                </Typography>
                <OptionCards
                  options={group.items}
                  labels={PROJECT_SCOPE_DELIVERABLE_LABELS}
                  value={details.scopeDeliverables}
                  onToggle={(item) =>
                    patchDetails({
                      scopeDeliverables: toggleIn(details.scopeDeliverables, item),
                    })
                  }
                />
              </div>
            ))}
          </Stack>
        )}

        {current.id === 'budget' && (
          <Stack className="wizard-panel" key="budget" spacing={2.5}>
            <div>
              <FieldLabel required>When do you need the work completed?</FieldLabel>
              <ChoicePills
                options={PROJECT_TIMELINES}
                labels={PROJECT_TIMELINE_LABELS}
                value={details.timeline}
                onChange={(t) => {
                  patchDetails({ timeline: t });
                  if (t !== 'specific_date') setNeededWithin(t);
                }}
              />
            </div>
            {details.timeline === 'specific_date' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Required completion date"
                    value={details.completionDate}
                    onChange={(e) => patchDetails({ completionDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Preferred start date"
                    value={details.preferredStartDate}
                    onChange={(e) => patchDetails({ preferredStartDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
            )}

            <div>
              <FieldLabel>Project priority</FieldLabel>
              <ChoicePills
                options={PROJECT_PRIORITIES}
                labels={PROJECT_PRIORITY_LABELS}
                value={details.priority}
                onChange={(p) => patchDetails({ priority: p })}
              />
            </div>

            <div>
              <FieldLabel required>How would you like to receive pricing?</FieldLabel>
              <ChoicePills
                options={PROJECT_PRICING_MODES}
                labels={PROJECT_PRICING_MODE_LABELS}
                value={details.pricingMode}
                onChange={(m) => patchDetails({ pricingMode: m })}
              />
            </div>

            {details.pricingMode === 'fixed' && (
              <TextField
                fullWidth
                label="Fixed budget (USD)"
                placeholder="5000"
                value={centsToDollars(details.budgetFixedCents)}
                onChange={(e) => patchDetails({ budgetFixedCents: dollarsToCents(e.target.value) })}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            )}
            {details.pricingMode === 'range' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Min (USD)"
                    placeholder="5000"
                    value={centsToDollars(details.budgetMinCents)}
                    onChange={(e) => patchDetails({ budgetMinCents: dollarsToCents(e.target.value) })}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Max (USD)"
                    placeholder="10000"
                    value={centsToDollars(details.budgetMaxCents)}
                    onChange={(e) => patchDetails({ budgetMaxCents: dollarsToCents(e.target.value) })}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                </Grid>
              </Grid>
            )}
            {details.pricingMode === 'open' && (
              <Typography variant="body2">
                Qualified providers will submit proposals for this brief.
              </Typography>
            )}
          </Stack>
        )}

        {current.id === 'files' && (
          <Stack className="wizard-panel" key="files" spacing={2.5}>
            <div>
              <FieldLabel>Do you already have project data?</FieldLabel>
              <ChoicePills
                options={PROJECT_EXISTING_DATA}
                labels={{ yes: 'Yes', no: 'No', not_sure: 'Not sure' }}
                value={details.existingData}
                onChange={(value) => patchDetails({ existingData: value })}
              />
            </div>

            {details.existingData === 'yes' && (
              <div>
                <FieldLabel>What do you have?</FieldLabel>
                <OptionCards
                  options={PROJECT_EXISTING_ASSETS}
                  labels={PROJECT_EXISTING_ASSET_LABELS}
                  value={details.existingAssets}
                  onToggle={(a) =>
                    patchDetails({ existingAssets: toggleIn(details.existingAssets, a) })
                  }
                />
              </div>
            )}

            <div>
              <FieldLabel>Upload project information</FieldLabel>
              <Button
                component="label"
                variant="outlined"
                fullWidth
                startIcon={<UploadFileIcon />}
                disabled={uploading}
                sx={{ justifyContent: 'flex-start', py: 1.5 }}
              >
                {uploading ? 'Uploading…' : 'PDF, DWG, RVT, E57, LAS, images, ZIP'}
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

            <div>
              <FieldLabel>Provider preferences</FieldLabel>
              <OptionCards
                options={PROJECT_PROVIDER_TYPES}
                labels={PROJECT_PROVIDER_TYPE_LABELS}
                value={details.providerTypes}
                onToggle={(p) => patchDetails({ providerTypes: toggleIn(details.providerTypes, p) })}
              />
              <FormControlLabel
                sx={{ mt: 1.5 }}
                control={
                  <Checkbox
                    checked={details.verifiedOnly}
                    onChange={(e) => patchDetails({ verifiedOnly: e.target.checked })}
                  />
                }
                label="Verified providers only"
              />
            </div>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="experience-label">Experience</InputLabel>
                  <Select
                    labelId="experience-label"
                    label="Experience"
                    value={details.experience ?? 'any'}
                    onChange={(e) =>
                      patchDetails({ experience: e.target.value as (typeof PROJECT_EXPERIENCE)[number] })
                    }
                  >
                    {PROJECT_EXPERIENCE.map((x) => (
                      <MenuItem key={x} value={x}>
                        {PROJECT_EXPERIENCE_LABELS[x]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="min-rating-label">Minimum rating</InputLabel>
                  <Select
                    labelId="min-rating-label"
                    label="Minimum rating"
                    value={details.minRating ?? 'any'}
                    onChange={(e) =>
                      patchDetails({ minRating: e.target.value as (typeof PROJECT_MIN_RATINGS)[number] })
                    }
                  >
                    {PROJECT_MIN_RATINGS.map((r) => (
                      <MenuItem key={r} value={r}>
                        {PROJECT_MIN_RATING_LABELS[r]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              multiline
              minRows={4}
              label="Anything else providers should know?"
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
        )}

        {current.id === 'review' && (
          <Stack className="wizard-panel" key="review" spacing={3}>
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.75 }, borderRadius: 2 }}>
              <Stack spacing={0.5} sx={{ mb: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {title.trim() || 'Untitled project'}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <PlaceOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2">
                    {[details.city, details.state, details.country].filter(Boolean).join(', ') ||
                      locationText.trim() ||
                      (details.locationKnown === 'not_yet' ? 'Location not set yet' : 'Location TBD')}
                  </Typography>
                </Stack>
              </Stack>

              <Grid container spacing={2.5}>
                <ReviewFact label="Property">
                  <ReviewChips
                    items={[
                      buildingType
                        ? (PROJECT_PROPERTY_TYPE_LABELS[
                            buildingType as (typeof PROJECT_PROPERTY_TYPES)[number]
                          ] ?? buildingType)
                        : '',
                      areaSqft ? `${Number(areaSqft).toLocaleString()} sq ft` : '',
                      floors ? `${floors} floor${floors === '1' ? '' : 's'}` : '',
                    ].filter(Boolean)}
                  />
                </ReviewFact>
                <ReviewFact label="Services">
                  <ReviewChips items={services.map((s) => SURVEY_SERVICE_LABELS[s])} />
                </ReviewFact>
                <ReviewFact label="Deliverables">
                  <ReviewChips
                    items={details.scopeDeliverables.map((d) => PROJECT_SCOPE_DELIVERABLE_LABELS[d])}
                  />
                </ReviewFact>
                <ReviewFact label="Timeline">
                  <ReviewChips
                    items={[
                      details.timeline ? PROJECT_TIMELINE_LABELS[details.timeline] : '',
                      details.priority ? PROJECT_PRIORITY_LABELS[details.priority] : '',
                    ].filter(Boolean)}
                  />
                </ReviewFact>
                <ReviewFact label="Budget">
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {details.pricingMode === 'fixed' && details.budgetFixedCents
                      ? `$${(details.budgetFixedCents / 100).toLocaleString()}`
                      : details.pricingMode === 'range' &&
                          details.budgetMinCents &&
                          details.budgetMaxCents
                        ? `$${(details.budgetMinCents / 100).toLocaleString()} – $${(details.budgetMaxCents / 100).toLocaleString()}`
                        : details.pricingMode === 'open'
                          ? 'Open for proposals'
                          : '—'}
                  </Typography>
                </ReviewFact>
                <ReviewFact label="Files">
                  <ReviewChips items={details.files.map((f) => f.fileName)} empty="None" />
                </ReviewFact>
              </Grid>
            </Paper>

            <div>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                Step status
              </Typography>
              <Grid container spacing={1.25}>
                {STEPS.filter((s) => s.id !== 'review').map((s) => {
                  const st = progress.steps[s.id];
                  const complete = st === 'complete';
                  const partial = st === 'partial';
                  return (
                    <Grid key={s.id} size={{ xs: 12, sm: 6 }}>
                      <Paper
                        component="button"
                        type="button"
                        variant="outlined"
                        onClick={() => jumpTo(STEPS.findIndex((x) => x.id === s.id))}
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
                          bgcolor: complete ? 'rgba(0, 36, 107, 0.04)' : 'background.paper',
                          borderColor: complete
                            ? 'primary.main'
                            : partial
                              ? 'warning.main'
                              : 'divider',
                          '&:hover': { bgcolor: 'rgba(0, 36, 107, 0.06)' },
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
                        <Typography
                          variant="body2"
                          sx={{ flex: 1, fontWeight: 700, color: 'text.primary' }}
                        >
                          {s.label}
                        </Typography>
                        <Chip
                          size="small"
                          label={complete ? 'Saved' : partial ? 'Needs attention' : 'Pending'}
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
          sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}
        >
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
