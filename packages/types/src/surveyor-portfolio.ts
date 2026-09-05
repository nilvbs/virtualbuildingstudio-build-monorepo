/**
 * Surveyor portfolio catalogs + structured details (Core + Identity).
 * Stored primarily in SurveyorProfile.details (JSON); matching fields stay denormalized.
 */

// --- Services (grouped multi-select) ---

export const SURVEY_SERVICE_GROUPS = [
  {
    id: 'survey_services',
    label: 'Survey Services',
    services: [
      'measured_building',
      'topographic',
      'land',
      'utility_survey',
      'boundary_survey',
      'construction_survey',
      'as_built_survey',
      'quantity_survey',
    ],
  },
  {
    id: 'laser_reality',
    label: 'Laser & Reality Capture',
    services: [
      'laser_scanning',
      'mobile_mapping',
      'lidar_survey',
      'point_cloud_registration',
      'reality_capture',
    ],
  },
  {
    id: 'drone',
    label: 'Drone',
    services: [
      'drone',
      'drone_survey',
      'aerial_photography',
      'orthomosaic_mapping',
      'photogrammetry',
      'thermal_inspection',
    ],
  },
  {
    id: 'bim_cad',
    label: 'BIM & CAD',
    services: [
      'scan_to_bim',
      'bim_modeling',
      'revit_modeling',
      'cad_drafting',
      'point_cloud_to_cad',
      'point_cloud_to_bim',
    ],
  },
] as const;

export const SURVEY_SERVICES = [
  'measured_building',
  'topographic',
  'land',
  'utility_survey',
  'boundary_survey',
  'construction_survey',
  'as_built_survey',
  'quantity_survey',
  'laser_scanning',
  'mobile_mapping',
  'lidar_survey',
  'point_cloud_registration',
  'reality_capture',
  'drone',
  'drone_survey',
  'aerial_photography',
  'orthomosaic_mapping',
  'photogrammetry',
  'thermal_inspection',
  'scan_to_bim',
  'bim_modeling',
  'revit_modeling',
  'cad_drafting',
  'point_cloud_to_cad',
  'point_cloud_to_bim',
] as const;
export type SurveyService = (typeof SURVEY_SERVICES)[number];

export const SURVEY_SERVICE_LABELS: Record<SurveyService, string> = {
  measured_building: 'Measured Building Survey',
  topographic: 'Topographic Survey',
  land: 'Land Survey',
  utility_survey: 'Utility Survey',
  boundary_survey: 'Boundary Survey',
  construction_survey: 'Construction Survey',
  as_built_survey: 'As-Built Survey',
  quantity_survey: 'Quantity Survey',
  laser_scanning: 'Laser Scanning',
  mobile_mapping: 'Mobile Mapping',
  lidar_survey: 'LiDAR Survey',
  point_cloud_registration: 'Point Cloud Registration',
  reality_capture: 'Reality Capture',
  drone: 'Drone',
  drone_survey: 'Drone Survey',
  aerial_photography: 'Aerial Photography',
  orthomosaic_mapping: 'Orthomosaic Mapping',
  photogrammetry: 'Photogrammetry',
  thermal_inspection: 'Thermal Inspection',
  scan_to_bim: 'Scan-to-BIM',
  bim_modeling: 'BIM Modeling',
  revit_modeling: 'Revit Modeling',
  cad_drafting: 'CAD Drafting',
  point_cloud_to_cad: 'Point Cloud to CAD',
  point_cloud_to_bim: 'Point Cloud to BIM',
};

// --- Equipment catalog ---

export const EQUIPMENT_GROUPS = [
  {
    id: 'laser_scanners',
    label: 'Laser Scanners',
    items: [
      'leica_rtc360',
      'leica_blk360',
      'faro_focus',
      'trimble_x7',
    ],
  },
  {
    id: 'survey_equipment',
    label: 'Survey Equipment',
    items: ['total_station', 'gnss_gps', 'digital_level'],
  },
  {
    id: 'drone',
    label: 'Drone',
    items: ['dji_m350_rtk', 'dji_mavic_3e'],
  },
  {
    id: 'software',
    label: 'Software',
    items: [
      'autodesk_revit',
      'autocad',
      'civil_3d',
      'cyclone',
      'recap',
      'pix4d',
      'realitycapture',
    ],
  },
] as const;

export const EQUIPMENT_IDS = [
  'leica_rtc360',
  'leica_blk360',
  'faro_focus',
  'trimble_x7',
  'total_station',
  'gnss_gps',
  'digital_level',
  'dji_m350_rtk',
  'dji_mavic_3e',
  'autodesk_revit',
  'autocad',
  'civil_3d',
  'cyclone',
  'recap',
  'pix4d',
  'realitycapture',
] as const;
export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  leica_rtc360: 'Leica RTC360',
  leica_blk360: 'Leica BLK360',
  faro_focus: 'Faro Focus',
  trimble_x7: 'Trimble X7',
  total_station: 'Total Station',
  gnss_gps: 'GNSS GPS',
  digital_level: 'Digital Level',
  dji_m350_rtk: 'DJI M350 RTK',
  dji_mavic_3e: 'DJI Mavic 3E',
  autodesk_revit: 'Autodesk Revit',
  autocad: 'AutoCAD',
  civil_3d: 'Civil 3D',
  cyclone: 'Cyclone',
  recap: 'Recap',
  pix4d: 'Pix4D',
  realitycapture: 'RealityCapture',
};

// --- Availability / pricing / languages / industries ---

export const AVAILABILITY_OPTIONS = [
  'available_immediately',
  'available_in_3_days',
  'available_next_week',
  'busy_until',
] as const;
export type AvailabilityOption = (typeof AVAILABILITY_OPTIONS)[number];

export const AVAILABILITY_LABELS: Record<AvailabilityOption, string> = {
  available_immediately: 'Available Immediately',
  available_in_3_days: 'Available in 3 Days',
  available_next_week: 'Available Next Week',
  busy_until: 'Busy Until (Date)',
};

export const TRAVEL_CHARGE_OPTIONS = ['included', 'extra'] as const;
export type TravelChargeOption = (typeof TRAVEL_CHARGE_OPTIONS)[number];

export const PORTFOLIO_LANGUAGES = [
  'english',
  'spanish',
  'french',
  'german',
  'hindi',
  'arabic',
] as const;
export type PortfolioLanguage = (typeof PORTFOLIO_LANGUAGES)[number];

export const PORTFOLIO_LANGUAGE_LABELS: Record<PortfolioLanguage, string> = {
  english: 'English',
  spanish: 'Spanish',
  french: 'French',
  german: 'German',
  hindi: 'Hindi',
  arabic: 'Arabic',
};

export const INDUSTRIES_SERVED = [
  'commercial',
  'residential',
  'industrial',
  'healthcare',
  'education',
  'airport',
  'hospitality',
  'warehouse',
  'government',
  'retail',
  'infrastructure',
] as const;
export type IndustryServed = (typeof INDUSTRIES_SERVED)[number];

export const INDUSTRY_LABELS: Record<IndustryServed, string> = {
  commercial: 'Commercial',
  residential: 'Residential',
  industrial: 'Industrial',
  healthcare: 'Healthcare',
  education: 'Education',
  airport: 'Airport',
  hospitality: 'Hospitality',
  warehouse: 'Warehouse',
  government: 'Government',
  retail: 'Retail',
  infrastructure: 'Infrastructure',
};

export const DOCUMENT_TYPES = [
  'company_brochure',
  'insurance',
  'business_license',
  'professional_license',
  'safety_certificate',
  'portfolio_pdf',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  company_brochure: 'Company Brochure',
  insurance: 'Insurance',
  business_license: 'Business License',
  professional_license: 'Professional License',
  safety_certificate: 'Safety Certificate',
  portfolio_pdf: 'Portfolio PDF',
};

export const BUSINESS_TYPES = ['llc', 'corporation', 'partnership'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  llc: 'LLC',
  corporation: 'Corporation',
  partnership: 'Partnership',
};

export const COMPANY_CERTIFICATIONS = [
  'iso_9001',
  'iso_19650',
  'leica_certified',
  'trimble_certified',
  'autodesk_certified',
] as const;
export type CompanyCertificationId = (typeof COMPANY_CERTIFICATIONS)[number];

export const COMPANY_CERTIFICATION_LABELS: Record<CompanyCertificationId, string> = {
  iso_9001: 'ISO 9001',
  iso_19650: 'ISO 19650',
  leica_certified: 'Leica Certified',
  trimble_certified: 'Trimble Certified',
  autodesk_certified: 'Autodesk Certified',
};

export const PROFESSIONAL_MEMBERSHIPS = [
  'rics',
  'asprs',
  'nsps',
  'autodesk_certified_professional',
] as const;
export type ProfessionalMembership = (typeof PROFESSIONAL_MEMBERSHIPS)[number];

export const PROFESSIONAL_MEMBERSHIP_LABELS: Record<ProfessionalMembership, string> = {
  rics: 'RICS',
  asprs: 'ASPRS',
  nsps: 'NSPS',
  autodesk_certified_professional: 'Autodesk Certified Professional',
};

// --- Nested detail shapes ---

export interface PortfolioCertification {
  id: string;
  name: string;
  issuingOrganization: string;
  certificateNumber: string;
  expiryDate: string | null;
  fileKey: string | null;
}

export interface PortfolioDocument {
  type: DocumentType;
  /** Public S3 HTTPS URL */
  fileKey: string | null;
  fileName: string | null;
}

export interface PortfolioProject {
  id: string;
  title: string;
  clientIndustry: string;
  location: string;
  buildingType: string;
  projectSize: string;
  completionYear: string;
  servicesProvided: SurveyService[];
  images: { key: string; caption?: string }[];
  description: string;
  deliverables: string;
}

export interface WorkExperienceEntry {
  id: string;
  company: string;
  designation: string;
  duration: string;
  description: string;
}

export interface EducationEntry {
  id: string;
  degree: string;
  university: string;
  year: string;
}

export interface ProfessionalLicenseEntry {
  id: string;
  name: string;
  licenseNumber: string;
  jurisdiction: string;
  expiryDate: string | null;
  fileKey: string | null;
}

export interface ReferenceEntry {
  id: string;
  name: string;
  company: string;
  email: string;
}

export interface TeamMemberEntry {
  id: string;
  name: string;
  photoKey: string | null;
  designation: string;
  experience: string;
}

export interface OfficeLocationEntry {
  id: string;
  city: string;
}

export interface IndividualIdentity {
  kind: 'individual';
  professionalTitle: string;
  headline: string;
  aboutMe: string;
  yearsExperience: number | null;
  currentCompany: string;
  previousExperience: WorkExperienceEntry[];
  education: EducationEntry[];
  professionalLicenses: ProfessionalLicenseEntry[];
  skills: string[];
  memberships: ProfessionalMembership[];
  achievements: string[];
  references: ReferenceEntry[];
}

export interface CompanyIdentity {
  kind: 'company';
  logoKey: string | null;
  coverImageKey: string | null;
  companyName: string;
  tagline: string;
  aboutCompany: string;
  website: string;
  linkedIn: string;
  facebook: string;
  instagram: string;
  youtube: string;
  registrationNumber: string;
  taxId: string;
  businessType: BusinessType | null;
  foundedYear: string;
  employeeCount: number | null;
  officeLocations: OfficeLocationEntry[];
  headOfficeAddress: string;
  teamMembers: TeamMemberEntry[];
  projectsHandledAnnually: number | null;
  largestProject: string;
  averageTeamSize: number | null;
  concurrentProjects: number | null;
  insuranceGeneralLiability: boolean;
  insuranceProfessionalLiability: boolean;
  insuranceWorkersComp: boolean;
  insuranceExpiry: string | null;
  insuranceFileKey: string | null;
  companyCertifications: CompanyCertificationId[];
  awards: string[];
}

export type PortfolioIdentity = IndividualIdentity | CompanyIdentity;

export const DAILY_CAPTURE_CAPACITIES = [
  'under_5k',
  '5k_20k',
  '20k_50k',
  '50k_plus',
] as const;
export type DailyCaptureCapacity = (typeof DAILY_CAPTURE_CAPACITIES)[number];

export const DAILY_CAPTURE_CAPACITY_LABELS: Record<DailyCaptureCapacity, string> = {
  under_5k: '<5,000 sq ft/day',
  '5k_20k': '5,000–20,000 sq ft/day',
  '20k_50k': '20,000–50,000 sq ft/day',
  '50k_plus': '50,000+ sq ft/day',
};

export const COVERAGE_COUNTRIES = ['us', 'ca', 'mx', 'other'] as const;
export type CoverageCountryId = (typeof COVERAGE_COUNTRIES)[number];

export const COVERAGE_COUNTRY_LABELS: Record<CoverageCountryId, string> = {
  us: 'United States',
  ca: 'Canada',
  mx: 'Mexico',
  other: 'Other',
};

export const COVERAGE_REGIONS: Record<Exclude<CoverageCountryId, 'other'>, string[]> = {
  us: [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Michigan',
    'Minnesota',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nebraska',
    'Nevada',
    'New Hampshire',
    'New Jersey',
    'New Mexico',
    'New York',
    'North Carolina',
    'North Dakota',
    'Ohio',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'Rhode Island',
    'South Carolina',
    'South Dakota',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Washington',
    'West Virginia',
    'Wisconsin',
    'Wyoming',
    'District of Columbia',
  ],
  ca: [
    'Alberta',
    'British Columbia',
    'Manitoba',
    'New Brunswick',
    'Newfoundland and Labrador',
    'Northwest Territories',
    'Nova Scotia',
    'Nunavut',
    'Ontario',
    'Prince Edward Island',
    'Quebec',
    'Saskatchewan',
    'Yukon',
  ],
  mx: [
    'Aguascalientes',
    'Baja California',
    'Baja California Sur',
    'Campeche',
    'Chiapas',
    'Chihuahua',
    'Coahuila',
    'Colima',
    'Durango',
    'Guanajuato',
    'Guerrero',
    'Hidalgo',
    'Jalisco',
    'Mexico City',
    'Mexico State',
    'Michoacán',
    'Morelos',
    'Nayarit',
    'Nuevo León',
    'Oaxaca',
    'Puebla',
    'Querétaro',
    'Quintana Roo',
    'San Luis Potosí',
    'Sinaloa',
    'Sonora',
    'Tabasco',
    'Tamaulipas',
    'Tlaxcala',
    'Veracruz',
    'Yucatán',
    'Zacatecas',
  ],
};

export interface CoverageCountyEntry {
  zip: string;
  county: string;
  state: string;
  country: CoverageCountryId;
  lat: number;
  lng: number;
  /** [west, south, east, north] from geocoder when available */
  bbox: [number, number, number, number] | null;
  /** Closed ring of [lng, lat] pairs for map polygon (preferred over bbox) */
  polygon: [number, number][] | null;
  /** Census GEOID / FIPS when available — used to reload county polygons */
  fips: string | null;
  /** When false, county stays in the ZIP result list but is excluded from coverage/map */
  selected: boolean;
}

export interface SurveyorPortfolioDetails {
  dailyCaptureCapacity: DailyCaptureCapacity | null;
  coverageCountries: CoverageCountryId[];
  coverageRegions: Partial<Record<CoverageCountryId, string[]>>;
  /** US ZIP-driven counties that participate in coverage */
  coverageCounties: CoverageCountyEntry[];
  travelNationwide: boolean;
  internationalProjects: boolean;
  remoteServices: boolean;
  availability: AvailabilityOption | null;
  busyUntil: string | null;
  currency: string;
  hourlyRateCents: number | null;
  minimumProjectCents: number | null;
  emergencyRateCents: number | null;
  travelCharges: TravelChargeOption | null;
  /** Extra travel cost in cents when travelCharges === 'extra' */
  travelExtraCents: number | null;
  yearsRealityCapture: number | null;
  generalLiabilityInsurance: boolean | null;
  languages: PortfolioLanguage[];
  industries: IndustryServed[];
  certifications: PortfolioCertification[];
  documents: PortfolioDocument[];
  projects: PortfolioProject[];
  identity: PortfolioIdentity | null;
}

export function emptyIndividualIdentity(): IndividualIdentity {
  return {
    kind: 'individual',
    professionalTitle: '',
    headline: '',
    aboutMe: '',
    yearsExperience: null,
    currentCompany: '',
    previousExperience: [],
    education: [],
    professionalLicenses: [],
    skills: [],
    memberships: [],
    achievements: [],
    references: [],
  };
}

export function emptyCompanyIdentity(): CompanyIdentity {
  return {
    kind: 'company',
    logoKey: null,
    coverImageKey: null,
    companyName: '',
    tagline: '',
    aboutCompany: '',
    website: '',
    linkedIn: '',
    facebook: '',
    instagram: '',
    youtube: '',
    registrationNumber: '',
    taxId: '',
    businessType: null,
    foundedYear: '',
    employeeCount: null,
    officeLocations: [],
    headOfficeAddress: '',
    teamMembers: [],
    projectsHandledAnnually: null,
    largestProject: '',
    averageTeamSize: null,
    concurrentProjects: null,
    insuranceGeneralLiability: false,
    insuranceProfessionalLiability: false,
    insuranceWorkersComp: false,
    insuranceExpiry: null,
    insuranceFileKey: null,
    companyCertifications: [],
    awards: [],
  };
}

export function emptyPortfolioDetails(
  accountType: 'individual' | 'company' = 'individual',
): SurveyorPortfolioDetails {
  return {
    dailyCaptureCapacity: null,
    coverageCountries: [],
    coverageRegions: {},
    coverageCounties: [],
    travelNationwide: false,
    internationalProjects: false,
    remoteServices: false,
    availability: null,
    busyUntil: null,
    currency: 'USD',
    hourlyRateCents: null,
    minimumProjectCents: null,
    emergencyRateCents: null,
    travelCharges: null,
    travelExtraCents: null,
    yearsRealityCapture: null,
    generalLiabilityInsurance: null,
    languages: [],
    industries: [],
    certifications: [],
    documents: DOCUMENT_TYPES.map((type) => ({ type, fileKey: null, fileName: null })),
    projects: [],
    identity:
      accountType === 'company' ? emptyCompanyIdentity() : emptyIndividualIdentity(),
  };
}

export function newEntryId(): string {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePortfolioDetails(
  raw: unknown,
  accountType: 'individual' | 'company' = 'individual',
): SurveyorPortfolioDetails {
  const base = emptyPortfolioDetails(accountType);
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Partial<SurveyorPortfolioDetails>;

  const identityRaw = src.identity;
  let identity = base.identity;
  if (identityRaw && typeof identityRaw === 'object' && 'kind' in identityRaw) {
    if (identityRaw.kind === 'company') {
      identity = { ...emptyCompanyIdentity(), ...(identityRaw as CompanyIdentity), kind: 'company' };
    } else if (identityRaw.kind === 'individual') {
      identity = {
        ...emptyIndividualIdentity(),
        ...(identityRaw as IndividualIdentity),
        kind: 'individual',
      };
    }
  }

  const coverageCountries = Array.isArray(src.coverageCountries)
    ? (src.coverageCountries.filter((c) =>
        (COVERAGE_COUNTRIES as readonly string[]).includes(c),
      ) as CoverageCountryId[])
    : [];
  const coverageRegions: Partial<Record<CoverageCountryId, string[]>> = {};
  if (src.coverageRegions && typeof src.coverageRegions === 'object') {
    for (const country of COVERAGE_COUNTRIES) {
      const list = src.coverageRegions[country];
      if (Array.isArray(list)) coverageRegions[country] = list.filter((x) => typeof x === 'string');
    }
  }

  const coverageCounties: CoverageCountyEntry[] = Array.isArray(src.coverageCounties)
    ? src.coverageCounties
        .filter((entry): entry is CoverageCountyEntry => {
          if (!entry || typeof entry !== 'object') return false;
          const e = entry as CoverageCountyEntry;
          return (
            typeof e.zip === 'string' &&
            typeof e.county === 'string' &&
            typeof e.state === 'string' &&
            typeof e.lat === 'number' &&
            typeof e.lng === 'number'
          );
        })
        .map((e) => ({
          zip: e.zip.trim(),
          county: e.county.trim(),
          state: e.state.trim(),
          country: ((COVERAGE_COUNTRIES as readonly string[]).includes(e.country) ? e.country : 'us') as CoverageCountryId,
          lat: e.lat,
          lng: e.lng,
          bbox:
            Array.isArray(e.bbox) && e.bbox.length === 4 && e.bbox.every((n) => typeof n === 'number')
              ? ([e.bbox[0], e.bbox[1], e.bbox[2], e.bbox[3]] as [number, number, number, number])
              : null,
          polygon:
            Array.isArray(e.polygon) &&
            e.polygon.length >= 4 &&
            e.polygon.every(
              (pt) =>
                Array.isArray(pt) &&
                pt.length >= 2 &&
                typeof pt[0] === 'number' &&
                typeof pt[1] === 'number',
            )
              ? (e.polygon.map((pt) => [pt[0], pt[1]] as [number, number]) as [number, number][])
              : null,
          fips: typeof e.fips === 'string' && e.fips.trim() ? e.fips.trim() : null,
          selected: e.selected !== false,
        }))
    : [];

  return {
    dailyCaptureCapacity: (DAILY_CAPTURE_CAPACITIES as readonly string[]).includes(
      src.dailyCaptureCapacity as string,
    )
      ? (src.dailyCaptureCapacity as DailyCaptureCapacity)
      : null,
    coverageCountries,
    coverageRegions,
    coverageCounties,
    travelNationwide: Boolean(src.travelNationwide),
    internationalProjects: Boolean(src.internationalProjects),
    remoteServices: Boolean(src.remoteServices),
    availability: (src.availability as AvailabilityOption | null) ?? null,
    busyUntil: src.busyUntil ?? null,
    currency: src.currency?.trim() || 'USD',
    hourlyRateCents: src.hourlyRateCents ?? null,
    minimumProjectCents: src.minimumProjectCents ?? null,
    emergencyRateCents: src.emergencyRateCents ?? null,
    travelCharges: (src.travelCharges as TravelChargeOption | null) ?? null,
    travelExtraCents: src.travelExtraCents ?? null,
    yearsRealityCapture:
      typeof src.yearsRealityCapture === 'number' && Number.isFinite(src.yearsRealityCapture)
        ? src.yearsRealityCapture
        : null,
    generalLiabilityInsurance:
      typeof src.generalLiabilityInsurance === 'boolean' ? src.generalLiabilityInsurance : null,
    languages: Array.isArray(src.languages) ? (src.languages as PortfolioLanguage[]) : [],
    industries: Array.isArray(src.industries) ? (src.industries as IndustryServed[]) : [],
    certifications: Array.isArray(src.certifications)
      ? (src.certifications as PortfolioCertification[])
      : [],
    documents: Array.isArray(src.documents)
      ? (src.documents as PortfolioDocument[])
      : base.documents,
    projects: Array.isArray(src.projects) ? (src.projects as PortfolioProject[]) : [],
    identity,
  };
}
