import { z } from 'zod';
import {
  ACCOUNT_TYPES,
  ROLE_HINTS,
  PROJECT_STATUSES,
  MATCH_STATUSES,
  NOTIFICATION_CHANNELS,
  SURVEY_SERVICES,
  WORKSPACE_ROLES,
  MEMBERSHIP_ROLES,
  STAFF_PERMISSIONS,
  STAFF_PERMISSION_PRESETS,
  STAFF_LEVELS,
} from '@surveylink/types';

/**
 * Shared zod schemas — the single validation source of truth used at every
 * request boundary (API) and on the client (web + mobile) before submit.
 *
 * Phase 1 scaffold ships the shared primitives and enum schemas. Feature DTOs
 * (signup, profile, project, match) compose from these in later build steps.
 */

// --- Primitives ---

/** E.164 phone number, e.g. +14155552671. */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164 format, e.g. +14155552671');

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

/** Canonical form for storage + lookups (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Longitude/latitude pair in WGS84 (EPSG:4326). */
export const geoPointSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});
export type GeoPointInput = z.infer<typeof geoPointSchema>;

/** Money is always integer cents — never float. */
export const centsSchema = z.number().int().nonnegative();

// --- Enum schemas (mirror DB CHECK constraints) ---

export const roleHintSchema = z.enum(ROLE_HINTS);
export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLES);
/** Signup may provision marketplace roles only. Staff are invited by super admin. */
export const signupRoleSchema = z.enum(['client', 'surveyor']);
export const staffPermissionSchema = z.enum(STAFF_PERMISSIONS);
export const staffPermissionPresetSchema = z.enum(STAFF_PERMISSION_PRESETS);
export const staffLevelSchema = z.enum(STAFF_LEVELS);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const matchStatusSchema = z.enum(MATCH_STATUSES);
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

// --- Auth DTOs ---

/**
 * Passwords are delegated to the managed provider (Auth0); we enforce a
 * baseline that matches Auth0’s usual “good” DB policy so signup fails early
 * with a clear message instead of a generic “Validation failed”.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol (!@#$…)');


export const namePartSchema = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(100)
  .regex(/^[\p{L}\p{M}\s'-]+$/u, 'Use letters only');

export const signupSchema = z.object({
  firstName: namePartSchema,
  lastName: namePartSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  /** Marketplace: client | surveyor. Staff portal: admin. */
  roleHint: signupRoleSchema.default('client'),
  /** Optional; preferred path is choosing account type on the first onboarding screen. */
  accountType: accountTypeSchema.default('individual').optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  /** Login must accept existing passwords — do not enforce signup complexity here. */
  password: z.string().min(1, 'Password is required').max(128),
  /**
   * Marketplace login must pass `client` or `surveyor`.
   * Staff portal (`/build/admin`) omits this and requires an admin membership.
   */
  role: workspaceRoleSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Marketplace-only password reset. Staff / admin accounts are intentionally
 * excluded — the API refuses to trigger a reset email for them.
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
  /** Required marketplace workspace: client or surveyor (never admin). */
  role: signupRoleSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Strong password policy (aligned with Create account / Auth0). */
export const passwordPolicySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/\d/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol');

/** Complete a first-party password reset using the emailed one-time token. */
export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'Reset link is invalid or expired'),
  password: passwordPolicySchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const addMembershipSchema = z.object({
  role: workspaceRoleSchema,
});
export type AddMembershipInput = z.infer<typeof addMembershipSchema>;

export const verifyPhoneSchema = z.object({
  code: z.string().regex(/^\d{4,10}$/, 'Code must be 4-10 digits'),
});
export type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>;

/** Optional phone update before sending SMS OTP during onboarding. */
export const startPhoneVerificationSchema = z
  .object({
    phone: phoneSchema.optional(),
  })
  .strict();
export type StartPhoneVerificationInput = z.infer<typeof startPhoneVerificationSchema>;

/** Confirm email OTP (replaces Auth0 link-only verify for marketplace signup). */
export const verifyEmailSchema = z.object({
  code: z.string().regex(/^\d{4,10}$/, 'Code must be 4-10 digits'),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Structured postal address collected during onboarding (company or base address). */
export const postalAddressSchema = z
  .object({
    line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
    line2: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().min(1, 'City is required').max(120),
    state: z.string().trim().min(1, 'State / region is required').max(120),
    postalCode: z.string().trim().min(1, 'Postal code is required').max(40),
    country: z.string().trim().min(1, 'Country is required').max(120),
  })
  .strict();
export type PostalAddressInput = z.infer<typeof postalAddressSchema>;

/** Personal profile fields collected after contact OTP. */
export const updateMeSchema = z
  .object({
    fullName: z.string().min(1).max(200).optional(),
    /** Optional object-storage key from a prior upload. */
    avatarKey: z.string().min(1).max(500).nullable().optional(),
    /** Client company name (ignored for surveyor-only accounts). */
    companyName: z.string().min(1).max(200).nullable().optional(),
    /** Base / company postal address from account profile. */
    address: postalAddressSchema.optional(),
    registrationNumber: z.string().trim().max(120).nullable().optional(),
    website: z.string().trim().max(300).nullable().optional(),
  })
  .strict();
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/** First onboarding glance — choose company vs individual before Terms/NDA. */
export const selectAccountTypeSchema = z
  .object({
    accountType: accountTypeSchema,
  })
  .strict();
export type SelectAccountTypeInput = z.infer<typeof selectAccountTypeSchema>;

/** Middle acceptance step — both Terms & Conditions and NDA must be accepted. */
export const acceptTermsSchema = z
  .object({
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms & Conditions to continue' }),
    }),
    acceptNda: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the NDA to continue' }),
    }),
  })
  .strict();
export type AcceptTermsInput = z.infer<typeof acceptTermsSchema>;

/** Company-only: request an OTP for the corporate work email. */
export const startWorkEmailSchema = z.object({ workEmail: emailSchema }).strict();
export type StartWorkEmailInput = z.infer<typeof startWorkEmailSchema>;

/** Company-only: confirm the work email OTP. */
export const verifyWorkEmailSchema = z
  .object({ code: z.string().regex(/^\d{4,10}$/, 'Code must be 4-10 digits') })
  .strict();
export type VerifyWorkEmailInput = z.infer<typeof verifyWorkEmailSchema>;

/**
 * Advance from complete_profile → portfolio|done after personal details are saved.
 * Address is required for both account types; company accounts also send registration
 * number (required) and website (optional). Work email is verified separately.
 */
export const completeProfileSchema = z
  .object({
    fullName: z.string().min(1).max(200).optional(),
    avatarKey: z.string().min(1).max(500).nullable().optional(),
    companyName: z.string().min(1).max(200).nullable().optional(),
    address: postalAddressSchema.optional(),
    registrationNumber: z.string().trim().max(120).nullable().optional(),
    website: z.string().trim().max(300).nullable().optional(),
  })
  .strict();
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

/** Body posted from the OAuth callback page to exchange the provider code. */
export const googleExchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  /** Mobile deep-link / Expo redirect; must match the start authorize call. */
  redirectUri: z.string().min(1).max(500).optional(),
});
export type GoogleExchangeInput = z.infer<typeof googleExchangeSchema>;

/**
 * Completes a social sign-up: the account already exists at the identity
 * provider, we just need the details the provider can't give us (phone + role).
 */
export const completeRegistrationSchema = z.object({
  firstName: namePartSchema,
  lastName: namePartSchema,
  email: emailSchema.optional(),
  phone: phoneSchema,
  roleHint: workspaceRoleSchema.default('client'),
  /** Optional; preferred path is choosing account type on the first onboarding screen. */
  accountType: accountTypeSchema.default('individual').optional(),
});
export type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .strict();
export type LogoutInput = z.infer<typeof logoutSchema>;

// --- Surveyor profile DTOs ---

export const surveyServiceSchema = z.enum(SURVEY_SERVICES);

export const portfolioItemSchema = z.object({
  key: z.string().min(1).max(500),
  caption: z.string().max(300).optional(),
});

/** Structured Core + Identity portfolio payload (validated loosely for nested lists). */
export const surveyorPortfolioDetailsSchema = z
  .object({
    travelNationwide: z.boolean().optional(),
    internationalProjects: z.boolean().optional(),
    remoteServices: z.boolean().optional(),
    availability: z
      .enum(['available_immediately', 'available_in_3_days', 'available_next_week', 'busy_until'])
      .nullable()
      .optional(),
    busyUntil: z.string().max(40).nullable().optional(),
    currency: z.string().max(8).optional(),
    hourlyRateCents: z.number().int().nonnegative().nullable().optional(),
    minimumProjectCents: z.number().int().nonnegative().nullable().optional(),
    emergencyRateCents: z.number().int().nonnegative().nullable().optional(),
    travelCharges: z.enum(['included', 'extra']).nullable().optional(),
    yearsRealityCapture: z.number().int().min(0).max(80).nullable().optional(),
    generalLiabilityInsurance: z.boolean().nullable().optional(),
    languages: z.array(z.string().max(40)).max(20).optional(),
    industries: z.array(z.string().max(40)).max(30).optional(),
    certifications: z.array(z.record(z.string(), z.unknown())).max(40).optional(),
    documents: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
    projects: z.array(z.record(z.string(), z.unknown())).max(40).optional(),
    identity: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

export const createSurveyorProfileSchema = z.object({
  bio: z.string().max(8000).optional(),
  services: z.array(surveyServiceSchema).min(1, 'Select at least one service'),
  equipment: z.array(z.string().min(1).max(120)).max(80).default([]),
  location: geoPointSchema.optional(),
  baseCity: z.string().max(200).optional(),
  radiusKm: z.number().int().min(1).max(10000).default(25),
  dayRateCents: centsSchema.optional(),
  portfolio: z.array(portfolioItemSchema).max(30).default([]),
  details: surveyorPortfolioDetailsSchema.optional(),
  isMatchable: z.boolean().default(true),
});
export type CreateSurveyorProfileInput = z.infer<typeof createSurveyorProfileSchema>;

export const updateSurveyorProfileSchema = createSurveyorProfileSchema.partial();
export type UpdateSurveyorProfileInput = z.infer<typeof updateSurveyorProfileSchema>;

// --- Client project DTOs ---

// --- Admin DTOs ---

export const createMatchSchema = z.object({
  projectId: z.string().uuid(),
  surveyorId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});
export type CreateMatchInput = z.infer<typeof createMatchSchema>;

export const updateMatchSchema = z
  .object({
    status: matchStatusSchema.optional(),
    adminNotes: z.string().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNotes !== undefined, {
    message: 'Provide a status and/or admin notes',
  });
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;

export const updateProjectStatusSchema = z.object({
  status: projectStatusSchema,
});
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;

export const adminSurveyorQuerySchema = z.object({
  service: surveyServiceSchema.optional(),
  nearLat: z.coerce.number().min(-90).max(90).optional(),
  nearLng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(20000).optional(),
  minRating: z.coerce.number().optional(),
  q: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  matchable: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true' || v === '1';
    }),
  complete: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true' || v === '1';
    }),
  bldVerified: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true' || v === '1';
    }),
  minDayRateCents: z.coerce.number().int().min(0).optional(),
  maxDayRateCents: z.coerce.number().int().min(0).optional(),
});
export type AdminSurveyorQuery = z.infer<typeof adminSurveyorQuerySchema>;

export const adminProjectsQuerySchema = z
  .object({
    clientId: z.string().uuid().optional(),
    /** pipeline = pending match; all = every status */
    scope: z.enum(['pipeline', 'all']).optional().default('pipeline'),
  })
  .default({});
export type AdminProjectsQuery = z.infer<typeof adminProjectsQuerySchema>;

export const adminUsersQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    role: z.enum(['client', 'surveyor', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .default({});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const updateAdminUserSchema = z
  .object({
    firstName: namePartSchema.optional(),
    lastName: namePartSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    status: z.enum(['active', 'suspended']).optional(),
    accountType: z.enum(ACCOUNT_TYPES).optional(),
    companyName: z.string().trim().max(200).nullable().optional(),
    addressLine1: z.string().trim().max(200).nullable().optional(),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
    state: z.string().trim().max(120).nullable().optional(),
    postalCode: z.string().trim().max(40).nullable().optional(),
    country: z.string().trim().max(120).nullable().optional(),
    workEmail: z.union([emailSchema, z.literal(''), z.null()]).optional(),
    website: z.string().trim().max(300).nullable().optional(),
    registrationNumber: z.string().trim().max(120).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Provide at least one field to update',
  });
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

/** Super-admin confirmation to mark a user's email or phone verified. */
export const adminVerifyContactSchema = z.object({
  channel: z.enum(['email', 'phone']),
  /** Acting super admin's own password (re-auth). */
  password: z.string().min(1).max(200),
});
export type AdminVerifyContactInput = z.infer<typeof adminVerifyContactSchema>;

/** Date / location filters for the admin operations overview. */
export const adminOverviewQuerySchema = z.object({
  from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
  to: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
  location: z.string().trim().max(120).optional(),
});
export type AdminOverviewQuery = z.infer<typeof adminOverviewQuerySchema>;

/** Client discovery of matchable surveyors for a posted project. */
export const clientSurveyorBrowseSchema = z.object({
  cursor: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  /** Override / narrow services; defaults to the project's services. */
  services: z
    .union([z.array(surveyServiceSchema), surveyServiceSchema])
    .optional()
    .transform((v) => (v == null ? undefined : Array.isArray(v) ? v : [v])),
  minRating: z.coerce.number().min(0).max(5).optional(),
  bldVerified: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true' || v === '1';
    }),
  /** Search radius from the project site (km). */
  radiusKm: z.coerce.number().positive().max(20000).optional(),
  minDayRateCents: z.coerce.number().int().min(0).optional(),
  maxDayRateCents: z.coerce.number().int().min(0).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z
    .enum(['relevance', 'distance', 'rating', 'price_asc', 'price_desc'])
    .optional()
    .default('relevance'),
});
export type ClientSurveyorBrowseInput = z.infer<typeof clientSurveyorBrowseSchema>;

export const createStaffAdminSchema = z.object({
  firstName: namePartSchema,
  lastName: namePartSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  title: z.string().max(120).optional(),
  permissionPreset: staffPermissionPresetSchema.default('matcher'),
  permissions: z.array(staffPermissionSchema).default([]),
});
export type CreateStaffAdminInput = z.infer<typeof createStaffAdminSchema>;

export const updateStaffAdminSchema = z
  .object({
    title: z.string().max(120).nullable().optional(),
    permissionPreset: staffPermissionPresetSchema.optional(),
    permissions: z.array(staffPermissionSchema).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.permissionPreset !== undefined ||
      v.permissions !== undefined ||
      v.status !== undefined,
    { message: 'Provide at least one field to update' },
  )
  .superRefine((v, ctx) => {
    if (v.permissionPreset === 'custom' && (!v.permissions || v.permissions.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom preset requires at least one permission',
        path: ['permissions'],
      });
    }
  });
export type UpdateStaffAdminInput = z.infer<typeof updateStaffAdminSchema>;

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  services: z.array(surveyServiceSchema).min(1, 'Select at least one service'),
  location: geoPointSchema.optional(),
  locationText: z.string().max(300).optional(),
  buildingType: z.string().max(100).optional(),
  buildingAge: z.string().max(100).optional(),
  floors: z.number().int().min(0).max(1000).optional(),
  areaSqft: z.number().int().min(0).max(100_000_000).optional(),
  neededWithin: z.string().max(100).optional(),
  notes: z.string().max(4000).optional(),
  /** Extended posting-wizard brief (JSON). */
  details: z.record(z.string(), z.unknown()).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// --- Feedback & ratings ---

export const feedbackAspectsSchema = z
  .object({
    product: z.number().int().min(1).max(5).optional(),
    partnership: z.number().int().min(1).max(5).optional(),
    matching: z.number().int().min(1).max(5).optional(),
    reliability: z.number().int().min(1).max(5).optional(),
  })
  .default({});

export const submitFeedbackSchema = z.object({
  matchId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .min(10, 'Please share at least 10 characters')
    .max(2000),
  aspects: feedbackAspectsSchema.optional(),
  recommend: z.boolean().nullable().optional(),
  /** Which workspace the reviewer is submitting from (required when user is both sides). */
  asRole: z.enum(['client', 'surveyor']).optional(),
});
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export const submitSiteFeedbackSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().email('Enter a valid email').max(160).optional(),
  ),
  rating: z.number().int().min(1).max(5),
  message: z
    .string()
    .trim()
    .min(10, 'Please share at least 10 characters')
    .max(2000),
  source: z.enum(['landing', 'support', 'other']).optional().default('landing'),
  /** Honeypot — must stay empty. */
  company: z.string().max(0).optional(),
});
export type SubmitSiteFeedbackInput = z.infer<typeof submitSiteFeedbackSchema>;

// --- Help desk ---

export const helpTicketCategorySchema = z.enum([
  'blocker',
  'account',
  'billing',
  'project',
  'matching',
  'technical',
  'other',
]);
export const helpTicketPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export const helpTicketStatusSchema = z.enum([
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
]);
export const helpTicketWorkspaceSchema = z.enum(['client', 'surveyor']);

export const createHelpTicketSchema = z.object({
  workspace: helpTicketWorkspaceSchema,
  category: helpTicketCategorySchema,
  priority: helpTicketPrioritySchema.default('normal'),
  subject: z.string().trim().min(4).max(160),
  body: z.string().trim().min(10).max(4000),
  projectId: z.string().uuid().nullable().optional(),
  attachments: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        fileName: z.string().trim().min(1).max(255),
        contentType: z.string().trim().max(120).nullable().optional(),
      }),
    )
    .max(5)
    .optional()
    .default([]),
});
export type CreateHelpTicketInput = z.infer<typeof createHelpTicketSchema>;

export const helpTicketMessageSchema = z
  .object({
    body: z.string().trim().max(4000).default(''),
    attachments: z
      .array(
        z.object({
          url: z.string().url().max(2000),
          fileName: z.string().trim().min(1).max(255),
          contentType: z.string().trim().max(120).nullable().optional(),
        }),
      )
      .max(5)
      .optional()
      .default([]),
  })
  .refine((v) => v.body.trim().length >= 2 || (v.attachments?.length ?? 0) > 0, {
    message: 'Add a message or at least one image',
  });
export type HelpTicketMessageInput = z.infer<typeof helpTicketMessageSchema>;

export const updateHelpTicketSchema = z
  .object({
    status: helpTicketStatusSchema.optional(),
    priority: helpTicketPrioritySchema.optional(),
  })
  .refine((v) => v.status !== undefined || v.priority !== undefined, {
    message: 'Provide a status and/or priority',
  });
export type UpdateHelpTicketInput = z.infer<typeof updateHelpTicketSchema>;
