import { z } from 'zod';
import {
  ROLE_HINTS,
  PROJECT_STATUSES,
  MATCH_STATUSES,
  NOTIFICATION_CHANNELS,
  SURVEY_SERVICES,
  WORKSPACE_ROLES,
  MEMBERSHIP_ROLES,
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

export const emailSchema = z.string().email().max(320);

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
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLES);
/** Signup may provision marketplace or staff (admin) membership. */
export const signupRoleSchema = z.enum(['client', 'surveyor', 'admin']);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const matchStatusSchema = z.enum(MATCH_STATUSES);
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

// --- Auth DTOs ---

/**
 * Passwords are delegated to the managed provider (Auth0); we only enforce a
 * baseline here. Auth0's own password policy is the source of truth.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128);

export const signupSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  /** Marketplace: client | surveyor. Staff portal: admin. */
  roleHint: signupRoleSchema.default('client'),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  /**
   * Marketplace login must pass `client` or `surveyor`.
   * Staff portal (`/build/admin`) omits this and requires an admin membership.
   */
  role: workspaceRoleSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const addMembershipSchema = z.object({
  role: workspaceRoleSchema,
});
export type AddMembershipInput = z.infer<typeof addMembershipSchema>;

export const verifyPhoneSchema = z.object({
  code: z.string().regex(/^\d{4,10}$/, 'Code must be 4-10 digits'),
});
export type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>;

/** Verify-email is a no-body resync/resend; kept as a schema for consistency. */
export const verifyEmailSchema = z.object({}).strict();
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Body posted from the OAuth callback page to exchange the provider code. */
export const googleExchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type GoogleExchangeInput = z.infer<typeof googleExchangeSchema>;

/**
 * Completes a social sign-up: the account already exists at the identity
 * provider, we just need the details the provider can't give us (phone + role).
 */
export const completeRegistrationSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: emailSchema.optional(),
  phone: phoneSchema,
  roleHint: workspaceRoleSchema.default('client'),
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

export const createSurveyorProfileSchema = z.object({
  bio: z.string().max(2000).optional(),
  services: z.array(surveyServiceSchema).min(1, 'Select at least one service'),
  equipment: z.array(z.string().min(1).max(120)).max(50).default([]),
  location: geoPointSchema.optional(),
  baseCity: z.string().max(200).optional(),
  radiusKm: z.number().int().min(1).max(1000).default(25),
  dayRateCents: centsSchema.optional(),
  portfolio: z.array(portfolioItemSchema).max(30).default([]),
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
});
export type AdminSurveyorQuery = z.infer<typeof adminSurveyorQuerySchema>;

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
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
