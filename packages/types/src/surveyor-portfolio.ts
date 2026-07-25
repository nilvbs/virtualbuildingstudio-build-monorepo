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

export interface SurveyorPortfolioDetails {
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

  return {
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
