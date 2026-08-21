/**
 * Client project brief — catalogs + structured details for the posting wizard.
 * Core matching fields stay denormalized on Project; extended brief lives in details JSON.
 */

import type { SurveyService } from './surveyor-portfolio';

export const PROJECT_PROPERTY_TYPES = [
  'residential',
  'commercial',
  'industrial',
  'healthcare',
  'education',
  'hospitality',
  'retail',
  'warehouse',
  'office',
  'government',
  'infrastructure',
  'other',
] as const;
export type ProjectPropertyType = (typeof PROJECT_PROPERTY_TYPES)[number];

export const PROJECT_PROPERTY_TYPE_LABELS: Record<ProjectPropertyType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  healthcare: 'Healthcare',
  education: 'Education',
  hospitality: 'Hospitality',
  retail: 'Retail',
  warehouse: 'Warehouse',
  office: 'Office',
  government: 'Government',
  infrastructure: 'Infrastructure',
  other: 'Other',
};

export const PROJECT_BUILDING_STATUSES = [
  'existing',
  'under_construction',
  'new_construction',
  'renovation',
  'demolition',
  'unknown',
] as const;
export type ProjectBuildingStatus = (typeof PROJECT_BUILDING_STATUSES)[number];

export const PROJECT_BUILDING_STATUS_LABELS: Record<ProjectBuildingStatus, string> = {
  existing: 'Existing',
  under_construction: 'Under Construction',
  new_construction: 'New Construction',
  renovation: 'Renovation',
  demolition: 'Demolition',
  unknown: 'Unknown',
};

export const PROJECT_LOCATION_KNOWN = ['yes', 'not_yet'] as const;
export type ProjectLocationKnown = (typeof PROJECT_LOCATION_KNOWN)[number];

export const PROJECT_SITE_ACCESS_REQUIRED = ['yes', 'no', 'not_sure'] as const;
export type ProjectSiteAccessRequired = (typeof PROJECT_SITE_ACCESS_REQUIRED)[number];

export const PROJECT_SITE_ACCESS_WINDOWS = [
  'weekdays',
  'weekends',
  'business_hours',
  'flexible',
  'specific_schedule',
] as const;
export type ProjectSiteAccessWindow = (typeof PROJECT_SITE_ACCESS_WINDOWS)[number];

export const PROJECT_SITE_ACCESS_WINDOW_LABELS: Record<ProjectSiteAccessWindow, string> = {
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  business_hours: 'Business hours',
  flexible: 'Flexible',
  specific_schedule: 'Specific schedule',
};

export const PROJECT_SCAN_TYPES = [
  'terrestrial',
  'mobile_lidar',
  'handheld',
  'not_sure',
] as const;
export type ProjectScanType = (typeof PROJECT_SCAN_TYPES)[number];

export const PROJECT_SCAN_TYPE_LABELS: Record<ProjectScanType, string> = {
  terrestrial: 'Terrestrial Laser Scanning',
  mobile_lidar: 'Mobile LiDAR',
  handheld: 'Handheld Scanning',
  not_sure: "Not sure — let professionals recommend",
};

export const PROJECT_SCAN_OUTPUTS = [
  'registered_point_cloud',
  'e57',
  'rcp_rcs',
  'las_laz',
  'other',
] as const;
export type ProjectScanOutput = (typeof PROJECT_SCAN_OUTPUTS)[number];

export const PROJECT_SCAN_OUTPUT_LABELS: Record<ProjectScanOutput, string> = {
  registered_point_cloud: 'Registered Point Cloud',
  e57: 'E57',
  rcp_rcs: 'RCP / RCS',
  las_laz: 'LAS / LAZ',
  other: 'Other',
};

export const PROJECT_ACCURACY = ['standard', 'high', 'professional_recommend', 'not_sure'] as const;
export type ProjectAccuracy = (typeof PROJECT_ACCURACY)[number];

export const PROJECT_ACCURACY_LABELS: Record<ProjectAccuracy, string> = {
  standard: 'Standard',
  high: 'High accuracy',
  professional_recommend: 'Professional recommendation',
  not_sure: "Not sure — let professionals recommend",
};

export const PROJECT_BIM_SOFTWARE = ['revit', 'archicad', 'other', 'no_preference', 'not_sure'] as const;
export type ProjectBimSoftware = (typeof PROJECT_BIM_SOFTWARE)[number];

export const PROJECT_BIM_SOFTWARE_LABELS: Record<ProjectBimSoftware, string> = {
  revit: 'Revit',
  archicad: 'Archicad',
  other: 'Other',
  no_preference: 'No preference',
  not_sure: "Not sure — recommend based on my project",
};

export const PROJECT_LOD = ['lod_100', 'lod_200', 'lod_300', 'lod_350', 'lod_400', 'not_sure'] as const;
export type ProjectLod = (typeof PROJECT_LOD)[number];

export const PROJECT_LOD_LABELS: Record<ProjectLod, string> = {
  lod_100: 'LOD 100',
  lod_200: 'LOD 200',
  lod_300: 'LOD 300',
  lod_350: 'LOD 350',
  lod_400: 'LOD 400',
  not_sure: "I'm not sure",
};

export const PROJECT_BIM_ELEMENTS = [
  'architecture',
  'structure',
  'doors_windows',
  'walls',
  'floors',
  'ceilings',
  'roof',
  'mep',
  'furniture',
  'equipment',
] as const;
export type ProjectBimElement = (typeof PROJECT_BIM_ELEMENTS)[number];

export const PROJECT_BIM_ELEMENT_LABELS: Record<ProjectBimElement, string> = {
  architecture: 'Architecture',
  structure: 'Structure',
  doors_windows: 'Doors & Windows',
  walls: 'Walls',
  floors: 'Floors',
  ceilings: 'Ceilings',
  roof: 'Roof',
  mep: 'MEP',
  furniture: 'Furniture',
  equipment: 'Equipment',
};

export const PROJECT_BIM_DELIVERABLES = ['rvt', 'ifc', 'dwg', 'pdf', 'point_cloud', 'other'] as const;
export type ProjectBimDeliverable = (typeof PROJECT_BIM_DELIVERABLES)[number];

export const PROJECT_BIM_DELIVERABLE_LABELS: Record<ProjectBimDeliverable, string> = {
  rvt: 'RVT',
  ifc: 'IFC',
  dwg: 'DWG',
  pdf: 'PDF',
  point_cloud: 'Point Cloud',
  other: 'Other',
};

export const PROJECT_SCOPE_DELIVERABLES = [
  'floor_plans',
  'elevations',
  'sections',
  'site_plan',
  'point_cloud',
  'photos_360',
  'panoramic',
  'revit_model',
  'ifc',
  'cad_drawings',
  'pdf_report',
  'as_built_drawings',
] as const;
export type ProjectScopeDeliverable = (typeof PROJECT_SCOPE_DELIVERABLES)[number];

export const PROJECT_SCOPE_DELIVERABLE_LABELS: Record<ProjectScopeDeliverable, string> = {
  floor_plans: 'Floor Plans',
  elevations: 'Elevations',
  sections: 'Sections',
  site_plan: 'Site Plan',
  point_cloud: 'Point Cloud',
  photos_360: '360° Photos',
  panoramic: 'Panoramic Images',
  revit_model: 'Revit Model',
  ifc: 'IFC',
  cad_drawings: 'CAD Drawings',
  pdf_report: 'PDF Report',
  as_built_drawings: 'As-Built Drawings',
};

export const PROJECT_SCOPE_GROUPS = [
  {
    id: 'survey',
    label: 'Survey',
    items: ['floor_plans', 'elevations', 'sections', 'site_plan'] as const,
  },
  {
    id: 'reality',
    label: 'Reality Capture',
    items: ['point_cloud', 'photos_360', 'panoramic'] as const,
  },
  {
    id: 'bim',
    label: 'BIM',
    items: ['revit_model', 'ifc', 'cad_drawings'] as const,
  },
  {
    id: 'docs',
    label: 'Documentation',
    items: ['pdf_report', 'as_built_drawings'] as const,
  },
] as const;

export const PROJECT_EXISTING_DATA = ['yes', 'no', 'not_sure'] as const;
export type ProjectExistingData = (typeof PROJECT_EXISTING_DATA)[number];

export const PROJECT_EXISTING_ASSETS = [
  'existing_drawings',
  'cad_files',
  'revit_model',
  'point_cloud',
  'site_photographs',
  'drone_imagery',
  'previous_survey',
  'other',
] as const;
export type ProjectExistingAsset = (typeof PROJECT_EXISTING_ASSETS)[number];

export const PROJECT_EXISTING_ASSET_LABELS: Record<ProjectExistingAsset, string> = {
  existing_drawings: 'Existing drawings',
  cad_files: 'CAD files',
  revit_model: 'Revit model',
  point_cloud: 'Point cloud',
  site_photographs: 'Site photographs',
  drone_imagery: 'Drone imagery',
  previous_survey: 'Previous survey',
  other: 'Other',
};

export const PROJECT_TIMELINES = [
  'asap',
  'within_3_days',
  'within_7_days',
  'within_14_days',
  'within_30_days',
  'flexible',
  'specific_date',
] as const;
export type ProjectTimeline = (typeof PROJECT_TIMELINES)[number];

export const PROJECT_TIMELINE_LABELS: Record<ProjectTimeline, string> = {
  asap: 'ASAP',
  within_3_days: 'Within 3 days',
  within_7_days: 'Within 7 days',
  within_14_days: 'Within 14 days',
  within_30_days: 'Within 30 days',
  flexible: 'Flexible',
  specific_date: 'Specific date',
};

export const PROJECT_PRIORITIES = ['standard', 'high', 'urgent'] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  standard: 'Standard',
  high: 'High priority',
  urgent: 'Urgent',
};

export const PROJECT_PRICING_MODES = ['fixed', 'range', 'open'] as const;
export type ProjectPricingMode = (typeof PROJECT_PRICING_MODES)[number];

export const PROJECT_PRICING_MODE_LABELS: Record<ProjectPricingMode, string> = {
  fixed: 'Fixed budget',
  range: 'Budget range',
  open: 'Open for proposals',
};

export const PROJECT_PROVIDER_TYPES = ['individual', 'company', 'either'] as const;
export type ProjectProviderType = (typeof PROJECT_PROVIDER_TYPES)[number];

export const PROJECT_PROVIDER_TYPE_LABELS: Record<ProjectProviderType, string> = {
  individual: 'Individual professional',
  company: 'Company',
  either: 'Either',
};

export const PROJECT_EXPERIENCE = ['any', '2_plus', '5_plus', '10_plus'] as const;
export type ProjectExperience = (typeof PROJECT_EXPERIENCE)[number];

export const PROJECT_EXPERIENCE_LABELS: Record<ProjectExperience, string> = {
  any: 'Any',
  '2_plus': '2+ years',
  '5_plus': '5+ years',
  '10_plus': '10+ years',
};

export const PROJECT_MIN_RATINGS = ['any', '4', '4_5', '4_8'] as const;
export type ProjectMinRating = (typeof PROJECT_MIN_RATINGS)[number];

export const PROJECT_MIN_RATING_LABELS: Record<ProjectMinRating, string> = {
  any: 'Any',
  '4': '4+',
  '4_5': '4.5+',
  '4_8': '4.8+',
};

export const PROJECT_COMM_CHANNELS = ['platform', 'email'] as const;
export type ProjectCommChannel = (typeof PROJECT_COMM_CHANNELS)[number];

export const PROJECT_COMM_CHANNEL_LABELS: Record<ProjectCommChannel, string> = {
  platform: 'Platform messages',
  email: 'Email notifications',
};

export const PROJECT_POST_STEPS = [
  { id: 'overview', label: 'Overview', blurb: 'Title, need & description' },
  { id: 'location', label: 'Location', blurb: 'Where is the site?' },
  { id: 'property', label: 'Property', blurb: 'Building & site details' },
  { id: 'services', label: 'Services', blurb: 'Requirements by trade' },
  { id: 'scope', label: 'Scope', blurb: 'Deliverables checklist' },
  { id: 'budget', label: 'Budget', blurb: 'Timeline & pricing' },
  { id: 'files', label: 'Files', blurb: 'Data, uploads & notes' },
  { id: 'review', label: 'Review', blurb: 'Check & publish' },
] as const;

export type ProjectPostStepId = (typeof PROJECT_POST_STEPS)[number]['id'];

export interface ProjectFileRef {
  key: string;
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes?: number;
}

export interface ProjectDetails {
  description: string;
  locationKnown: ProjectLocationKnown | null;
  country: string;
  state: string;
  city: string;
  zip: string;
  address: string;
  siteAccessRequired: ProjectSiteAccessRequired | null;
  siteAccessWindows: ProjectSiteAccessWindow[];
  buildingStatus: ProjectBuildingStatus | null;
  siteArea: string;
  yearBuilt: string;
  scanTypes: ProjectScanType[];
  scanOutputs: ProjectScanOutput[];
  accuracy: ProjectAccuracy | null;
  bimSoftware: ProjectBimSoftware | null;
  lod: ProjectLod | null;
  bimElements: ProjectBimElement[];
  bimDeliverables: ProjectBimDeliverable[];
  scopeDeliverables: ProjectScopeDeliverable[];
  existingData: ProjectExistingData | null;
  existingAssets: ProjectExistingAsset[];
  files: ProjectFileRef[];
  timeline: ProjectTimeline | null;
  completionDate: string;
  preferredStartDate: string;
  priority: ProjectPriority | null;
  pricingMode: ProjectPricingMode | null;
  budgetFixedCents: number | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  providerTypes: ProjectProviderType[];
  verifiedOnly: boolean;
  experience: ProjectExperience | null;
  minRating: ProjectMinRating | null;
  specialRequirements: string;
  communication: ProjectCommChannel[];
}

export function emptyProjectDetails(): ProjectDetails {
  return {
    description: '',
    locationKnown: null,
    country: 'United States',
    state: '',
    city: '',
    zip: '',
    address: '',
    siteAccessRequired: null,
    siteAccessWindows: [],
    buildingStatus: null,
    siteArea: '',
    yearBuilt: '',
    scanTypes: [],
    scanOutputs: [],
    accuracy: null,
    bimSoftware: null,
    lod: null,
    bimElements: [],
    bimDeliverables: [],
    scopeDeliverables: [],
    existingData: null,
    existingAssets: [],
    files: [],
    timeline: null,
    completionDate: '',
    preferredStartDate: '',
    priority: 'standard',
    pricingMode: null,
    budgetFixedCents: null,
    budgetMinCents: null,
    budgetMaxCents: null,
    providerTypes: ['either'],
    verifiedOnly: false,
    experience: 'any',
    minRating: 'any',
    specialRequirements: '',
    communication: ['platform', 'email'],
  };
}

export function normalizeProjectDetails(raw: unknown): ProjectDetails {
  const base = emptyProjectDetails();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Partial<ProjectDetails>;
  return {
    ...base,
    ...src,
    siteAccessWindows: Array.isArray(src.siteAccessWindows) ? src.siteAccessWindows : [],
    scanTypes: Array.isArray(src.scanTypes) ? src.scanTypes : [],
    scanOutputs: Array.isArray(src.scanOutputs) ? src.scanOutputs : [],
    bimElements: Array.isArray(src.bimElements) ? src.bimElements : [],
    bimDeliverables: Array.isArray(src.bimDeliverables) ? src.bimDeliverables : [],
    scopeDeliverables: Array.isArray(src.scopeDeliverables) ? src.scopeDeliverables : [],
    existingAssets: Array.isArray(src.existingAssets) ? src.existingAssets : [],
    files: Array.isArray(src.files) ? src.files : [],
    providerTypes: Array.isArray(src.providerTypes) ? src.providerTypes : ['either'],
    communication: Array.isArray(src.communication) ? src.communication : ['platform', 'email'],
  };
}

const LASER_SERVICES: SurveyService[] = [
  'laser_scanning',
  'mobile_mapping',
  'lidar_survey',
  'point_cloud_registration',
  'reality_capture',
];

const BIM_SERVICES: SurveyService[] = [
  'scan_to_bim',
  'bim_modeling',
  'revit_modeling',
  'cad_drafting',
  'point_cloud_to_cad',
  'point_cloud_to_bim',
];

export function projectNeedsLaserDetails(services: SurveyService[]): boolean {
  return services.some((s) => LASER_SERVICES.includes(s));
}

export function projectNeedsBimDetails(services: SurveyService[]): boolean {
  return services.some((s) => BIM_SERVICES.includes(s));
}

export type ProjectStepStatus = 'complete' | 'partial' | 'pending';

export interface ProjectPostProgress {
  percent: number;
  steps: Record<ProjectPostStepId, ProjectStepStatus>;
}

type BriefSource = {
  title?: string;
  services?: SurveyService[];
  locationText?: string | null;
  location?: { lat: number; lng: number } | null;
  buildingType?: string | null;
  floors?: number | null;
  areaSqft?: number | null;
  neededWithin?: string | null;
  notes?: string | null;
  details?: ProjectDetails | null;
};

function statusFrom(complete: boolean, started: boolean): ProjectStepStatus {
  if (complete) return 'complete';
  if (started) return 'partial';
  return 'pending';
}

/** Visual progress for the posting wizard (saved vs pending). */
export function projectPostProgress(brief: BriefSource): ProjectPostProgress {
  const d = brief.details ?? emptyProjectDetails();
  const titleOk = Boolean(brief.title?.trim());
  const servicesOk = (brief.services?.length ?? 0) > 0;
  const descOk = d.description.trim().length >= 50;

  const overview = statusFrom(
    titleOk && servicesOk && descOk,
    titleOk || servicesOk || d.description.trim().length > 0,
  );

  const locKnown = d.locationKnown;
  const locComplete =
    locKnown === 'not_yet' ||
    (locKnown === 'yes' &&
      Boolean(d.country.trim() && d.state.trim() && d.city.trim()) &&
      (Boolean(brief.locationText?.trim()) || Boolean(brief.location)));
  const location = statusFrom(
    locComplete,
    Boolean(locKnown) || Boolean(brief.locationText?.trim()) || Boolean(brief.location),
  );

  const property = statusFrom(
    Boolean(brief.buildingType?.trim()),
    Boolean(brief.buildingType || d.buildingStatus || brief.floors != null || brief.areaSqft != null),
  );

  const needsLaser = projectNeedsLaserDetails(brief.services ?? []);
  const needsBim = projectNeedsBimDetails(brief.services ?? []);
  const laserOk = !needsLaser || d.scanTypes.length > 0 || d.accuracy != null;
  const bimOk = !needsBim || d.bimSoftware != null || d.lod != null || d.bimElements.length > 0;
  const services = statusFrom(
    servicesOk && laserOk && bimOk,
    servicesOk || d.scanTypes.length > 0 || d.bimElements.length > 0,
  );

  const scope = statusFrom(d.scopeDeliverables.length > 0, d.scopeDeliverables.length > 0);

  const budgetOk =
    Boolean(d.timeline || brief.neededWithin) &&
    Boolean(d.pricingMode) &&
    (d.pricingMode === 'open' ||
      (d.pricingMode === 'fixed' && (d.budgetFixedCents ?? 0) > 0) ||
      (d.pricingMode === 'range' &&
        (d.budgetMinCents ?? 0) > 0 &&
        (d.budgetMaxCents ?? 0) >= (d.budgetMinCents ?? 0)));
  const budget = statusFrom(
    budgetOk,
    Boolean(d.timeline || brief.neededWithin || d.pricingMode || d.priority),
  );

  const files = statusFrom(
    d.existingData != null || d.files.length > 0 || d.specialRequirements.trim().length > 0,
    d.existingData != null ||
      d.files.length > 0 ||
      d.specialRequirements.trim().length > 0 ||
      d.existingAssets.length > 0,
  );

  const coreComplete =
    overview === 'complete' && location === 'complete' && property === 'complete' && services === 'complete';
  const review = statusFrom(coreComplete && budget === 'complete', coreComplete);

  const steps: Record<ProjectPostStepId, ProjectStepStatus> = {
    overview,
    location,
    property,
    services,
    scope,
    budget,
    files,
    review,
  };

  const weight: ProjectPostStepId[] = [
    'overview',
    'location',
    'property',
    'services',
    'scope',
    'budget',
    'files',
  ];
  const score = weight.reduce((sum, id) => {
    if (steps[id] === 'complete') return sum + 1;
    if (steps[id] === 'partial') return sum + 0.45;
    return sum;
  }, 0);
  const percent = Math.round((score / weight.length) * 100);

  return { percent, steps };
}
