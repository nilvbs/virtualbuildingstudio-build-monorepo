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

/** Statuses offered in the posting wizard (older briefs may hold any PROJECT_BUILDING_STATUSES value). */
export const PROJECT_POST_BUILDING_STATUSES = ['existing', 'under_construction'] as const;

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
  'topographic_plan',
  'utility_map',
  'boundary_plan',
  'orthomosaic',
  'mesh_model',
  'thermal_report',
  'quantity_report',
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
  topographic_plan: 'Topographic Plan',
  utility_map: 'Utility Map',
  boundary_plan: 'Boundary Plan',
  orthomosaic: 'Orthomosaic Map',
  mesh_model: '3D Mesh Model',
  thermal_report: 'Thermal Report',
  quantity_report: 'Bill of Quantities',
};

export const PROJECT_SCOPE_GROUPS = [
  {
    id: 'survey',
    label: 'Survey',
    items: [
      'floor_plans',
      'elevations',
      'sections',
      'site_plan',
      'topographic_plan',
      'utility_map',
      'boundary_plan',
    ] as const,
  },
  {
    id: 'reality',
    label: 'Reality Capture',
    items: ['point_cloud', 'photos_360', 'panoramic', 'orthomosaic', 'mesh_model'] as const,
  },
  {
    id: 'bim',
    label: 'BIM',
    items: ['revit_model', 'ifc', 'cad_drawings'] as const,
  },
  {
    id: 'docs',
    label: 'Documentation',
    items: ['pdf_report', 'as_built_drawings', 'thermal_report', 'quantity_report'] as const,
  },
] as const;

/** Deliverables that make sense for each service — the wizard only offers these. */
export const SERVICE_DELIVERABLES: Record<SurveyService, readonly ProjectScopeDeliverable[]> = {
  measured_building: ['floor_plans', 'elevations', 'sections', 'cad_drawings', 'pdf_report'],
  topographic: ['topographic_plan', 'site_plan', 'cad_drawings', 'pdf_report'],
  land: ['site_plan', 'topographic_plan', 'boundary_plan', 'cad_drawings', 'pdf_report'],
  utility_survey: ['utility_map', 'site_plan', 'cad_drawings', 'pdf_report'],
  boundary_survey: ['boundary_plan', 'site_plan', 'pdf_report'],
  construction_survey: ['site_plan', 'as_built_drawings', 'cad_drawings', 'pdf_report'],
  as_built_survey: ['as_built_drawings', 'floor_plans', 'elevations', 'sections', 'cad_drawings'],
  quantity_survey: ['quantity_report', 'pdf_report'],
  laser_scanning: ['point_cloud', 'photos_360', 'panoramic', 'mesh_model'],
  mobile_mapping: ['point_cloud', 'panoramic', 'photos_360'],
  lidar_survey: ['point_cloud', 'topographic_plan', 'site_plan'],
  point_cloud_registration: ['point_cloud'],
  reality_capture: ['point_cloud', 'photos_360', 'panoramic', 'mesh_model'],
  drone: ['panoramic', 'photos_360', 'orthomosaic'],
  drone_survey: ['orthomosaic', 'topographic_plan', 'point_cloud', 'site_plan', 'pdf_report'],
  aerial_photography: ['panoramic', 'photos_360'],
  orthomosaic_mapping: ['orthomosaic', 'site_plan', 'pdf_report'],
  photogrammetry: ['mesh_model', 'point_cloud', 'orthomosaic'],
  thermal_inspection: ['thermal_report', 'pdf_report'],
  scan_to_bim: ['revit_model', 'ifc', 'point_cloud'],
  bim_modeling: ['revit_model', 'ifc'],
  revit_modeling: ['revit_model', 'ifc'],
  cad_drafting: ['cad_drawings', 'floor_plans', 'elevations', 'sections'],
  point_cloud_to_cad: ['cad_drawings', 'floor_plans', 'elevations', 'sections'],
  point_cloud_to_bim: ['revit_model', 'ifc'],
};

/** Deliverables relevant to the selected services, in catalog order. */
export function deliverablesForServices(services: readonly SurveyService[]): ProjectScopeDeliverable[] {
  const allowed = new Set<ProjectScopeDeliverable>();
  for (const s of services) for (const d of SERVICE_DELIVERABLES[s] ?? []) allowed.add(d);
  return PROJECT_SCOPE_DELIVERABLES.filter((d) => allowed.has(d));
}

/** Scope groups narrowed to the selected services; empty groups are dropped. */
export function deliverableGroupsForServices(
  services: readonly SurveyService[],
): { id: string; label: string; items: ProjectScopeDeliverable[] }[] {
  const allowed = new Set(deliverablesForServices(services));
  return PROJECT_SCOPE_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    items: (g.items as readonly ProjectScopeDeliverable[]).filter((d) => allowed.has(d)),
  })).filter((g) => g.items.length > 0);
}

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

/** Timeline choices offered in the posting wizard. */
export const PROJECT_POST_TIMELINES = ['asap', 'flexible', 'specific_date'] as const;

/** Floor counts for the wizard dropdown; the last value means "that many or more". */
export const PROJECT_FLOOR_OPTIONS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50,
] as const;

export function floorOptionLabel(n: number): string {
  const max = PROJECT_FLOOR_OPTIONS[PROJECT_FLOOR_OPTIONS.length - 1] ?? 50;
  if (n >= max) return `${max}+ floors`;
  return `${n} floor${n === 1 ? '' : 's'}`;
}

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
  { id: 'location', label: 'Location & overview', blurb: 'Site address, project title & description' },
  { id: 'services', label: 'Services', blurb: 'What you need and the deliverables you expect' },
  { id: 'property', label: 'Property', blurb: 'Building type, status & size' },
  { id: 'budget', label: 'Timeline & estimate', blurb: 'When you need it and a recommended price' },
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
  /** Recommended price shown to the client at posting time (estimate, not a quote). */
  estimateMinCents: number | null;
  estimateMaxCents: number | null;
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
    estimateMinCents: null,
    estimateMaxCents: null,
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

export function projectNeedsLaserDetails(services: readonly SurveyService[]): boolean {
  return services.some((s) => LASER_SERVICES.includes(s));
}

export function projectNeedsBimDetails(services: readonly SurveyService[]): boolean {
  return services.some((s) => BIM_SERVICES.includes(s));
}

export const PROJECT_DESCRIPTION_MIN = 50;

/** Default project title from a picked address, e.g. "12 Main St, Houston, TX". */
export function suggestProjectTitle(place: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  label?: string | null;
}): string {
  const line1 = place.line1?.trim() || place.label?.split(',')[0]?.trim() || '';
  const parts = [line1, place.city?.trim(), place.state?.trim()].filter(
    (p, i, all): p is string => Boolean(p) && all.indexOf(p) === i,
  );
  return parts.join(', ').slice(0, 140);
}

/** Base fee + per-sq-ft rate in USD, tuned to typical US marketplace pricing. */
const SERVICE_PRICING: Record<SurveyService, { base: number; perSqft: number }> = {
  measured_building: { base: 600, perSqft: 0.1 },
  topographic: { base: 1200, perSqft: 0.03 },
  land: { base: 1000, perSqft: 0.02 },
  utility_survey: { base: 1500, perSqft: 0.04 },
  boundary_survey: { base: 900, perSqft: 0.01 },
  construction_survey: { base: 1200, perSqft: 0.05 },
  as_built_survey: { base: 800, perSqft: 0.12 },
  quantity_survey: { base: 700, perSqft: 0.05 },
  laser_scanning: { base: 900, perSqft: 0.08 },
  mobile_mapping: { base: 1500, perSqft: 0.05 },
  lidar_survey: { base: 1400, perSqft: 0.05 },
  point_cloud_registration: { base: 400, perSqft: 0.03 },
  reality_capture: { base: 800, perSqft: 0.07 },
  drone: { base: 450, perSqft: 0.01 },
  drone_survey: { base: 800, perSqft: 0.02 },
  aerial_photography: { base: 400, perSqft: 0.01 },
  orthomosaic_mapping: { base: 700, perSqft: 0.02 },
  photogrammetry: { base: 800, perSqft: 0.03 },
  thermal_inspection: { base: 600, perSqft: 0.03 },
  scan_to_bim: { base: 1200, perSqft: 0.15 },
  bim_modeling: { base: 1000, perSqft: 0.14 },
  revit_modeling: { base: 1000, perSqft: 0.14 },
  cad_drafting: { base: 500, perSqft: 0.08 },
  point_cloud_to_cad: { base: 600, perSqft: 0.09 },
  point_cloud_to_bim: { base: 1000, perSqft: 0.14 },
};

const SCAN_TYPE_FACTOR: Record<ProjectScanType, number> = {
  terrestrial: 1,
  mobile_lidar: 0.9,
  handheld: 0.85,
  not_sure: 1,
};

const LOD_FACTOR: Record<ProjectLod, number> = {
  lod_100: 0.7,
  lod_200: 0.85,
  lod_300: 1,
  lod_350: 1.15,
  lod_400: 1.3,
  not_sure: 1,
};

const COMPLEX_PROPERTY_TYPES: readonly string[] = ['industrial', 'healthcare', 'infrastructure'];

export interface ProjectPriceInput {
  services: readonly SurveyService[];
  areaSqft: number | null;
  floors: number | null;
  buildingType?: string | null;
  buildingStatus?: ProjectBuildingStatus | null;
  scanTypes?: readonly ProjectScanType[];
  accuracy?: ProjectAccuracy | null;
  lod?: ProjectLod | null;
  deliverables?: readonly ProjectScopeDeliverable[];
  timeline?: ProjectTimeline | null;
}

export interface ProjectPriceEstimate {
  minCents: number;
  maxCents: number;
  /** Human-readable inputs that moved the price, for the "based on" line. */
  factors: string[];
}

function roundPrice(dollars: number): number {
  const step = dollars < 5000 ? 50 : dollars < 25000 ? 100 : 500;
  return Math.max(step, Math.round(dollars / step) * step);
}

/**
 * Recommended price range for a brief. Indicative only — providers still quote.
 * Returns null until there is at least one service and a building size.
 */
export function estimateProjectPrice(input: ProjectPriceInput): ProjectPriceEstimate | null {
  const area = input.areaSqft ?? 0;
  if (!input.services.length || area <= 0) return null;

  const scanFactor = input.scanTypes?.length
    ? Math.max(...input.scanTypes.map((t) => SCAN_TYPE_FACTOR[t] ?? 1))
    : 1;
  const lodFactor = input.lod ? (LOD_FACTOR[input.lod] ?? 1) : 1;
  const accuracyFactor = input.accuracy === 'high' ? 1.15 : 1;

  const perService = input.services.map((s) => {
    const p = SERVICE_PRICING[s];
    let cost = p.base + p.perSqft * area;
    if (LASER_SERVICES.includes(s)) cost *= scanFactor * accuracyFactor;
    else if (BIM_SERVICES.includes(s)) cost *= lodFactor;
    else cost *= accuracyFactor;
    return cost;
  });
  let total = perService.reduce((a, b) => a + b, 0);

  const factors: string[] = [
    `${input.services.length} service${input.services.length === 1 ? '' : 's'}`,
    `${Math.round(area).toLocaleString('en-US')} sq ft`,
  ];

  if (input.services.length > 1) {
    total *= 1 - Math.min(0.15, 0.05 * (input.services.length - 1));
  }

  const floors = input.floors ?? 0;
  if (floors > 1) {
    total *= Math.min(2, 1 + 0.04 * (floors - 1));
  }
  if (floors > 0) factors.push(floorOptionLabel(floors));

  if (input.buildingStatus === 'under_construction') {
    total *= 1.1;
    factors.push('under construction');
  }
  if (input.buildingType && COMPLEX_PROPERTY_TYPES.includes(input.buildingType)) {
    total *= 1.1;
    factors.push(`${input.buildingType} site`);
  } else if (input.buildingType === 'residential') {
    total *= 0.95;
  }

  if (input.scanTypes?.length && projectNeedsLaserDetails(input.services)) {
    const named = input.scanTypes.filter((t) => t !== 'not_sure');
    if (named.length) factors.push(named.map((t) => PROJECT_SCAN_TYPE_LABELS[t]).join(' / '));
  }
  if (input.accuracy === 'high') factors.push('high accuracy');
  if (input.lod && input.lod !== 'not_sure' && projectNeedsBimDetails(input.services)) {
    factors.push(PROJECT_LOD_LABELS[input.lod]);
  }

  const extraDeliverables = Math.max(0, (input.deliverables?.length ?? 0) - 2);
  if (extraDeliverables > 0) total *= 1 + 0.03 * extraDeliverables;
  if (input.deliverables?.length) {
    factors.push(
      `${input.deliverables.length} deliverable${input.deliverables.length === 1 ? '' : 's'}`,
    );
  }

  if (input.timeline === 'asap') {
    total *= 1.2;
    factors.push('ASAP turnaround');
  }

  const min = roundPrice(total * 0.85);
  const max = Math.max(min, roundPrice(total * 1.2));
  return { minCents: min * 100, maxCents: max * 100, factors };
}

export function formatEstimateRange(minCents: number, maxCents: number): string {
  const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString('en-US')}`;
  return minCents === maxCents ? fmt(minCents) : `${fmt(minCents)} – ${fmt(maxCents)}`;
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
  const descLen = d.description.trim().length;

  const locKnown = d.locationKnown;
  const addressOk =
    locKnown === 'not_yet' ||
    (locKnown === 'yes' && Boolean(d.country.trim() && d.state.trim() && d.city.trim()));
  const location = statusFrom(
    addressOk && titleOk && descLen >= PROJECT_DESCRIPTION_MIN,
    titleOk || descLen > 0 || Boolean(brief.locationText?.trim()) || Boolean(brief.location),
  );

  const serviceCount = brief.services?.length ?? 0;
  const services = statusFrom(
    serviceCount > 0 && d.scopeDeliverables.length > 0,
    serviceCount > 0 || d.scopeDeliverables.length > 0,
  );

  const property = statusFrom(
    Boolean(brief.buildingType?.trim()) && (brief.areaSqft ?? 0) > 0,
    Boolean(brief.buildingType || d.buildingStatus || brief.floors != null || brief.areaSqft != null),
  );

  const budget = statusFrom(
    Boolean(d.timeline) && (d.timeline !== 'specific_date' || Boolean(d.completionDate)),
    Boolean(d.timeline || brief.neededWithin),
  );

  const coreComplete =
    location === 'complete' && services !== 'pending' && property === 'complete';
  const review = statusFrom(coreComplete && budget === 'complete', coreComplete);

  const steps: Record<ProjectPostStepId, ProjectStepStatus> = {
    location,
    services,
    property,
    budget,
    review,
  };

  const weight: ProjectPostStepId[] = ['location', 'services', 'property', 'budget'];
  const score = weight.reduce((sum, id) => {
    if (steps[id] === 'complete') return sum + 1;
    if (steps[id] === 'partial') return sum + 0.45;
    return sum;
  }, 0);
  const percent = Math.round((score / weight.length) * 100);

  return { percent, steps };
}
