import type { ProjectDetails, SurveyService } from '@surveylink/types';
import { PROJECT_POST_STEPS } from '@surveylink/types';

export const PROJECT_POST_DRAFT_KEY = 'bld.projectPostDraft.v1';

export type ProjectPostDraft = {
  step: number;
  title: string;
  services: SurveyService[];
  locationText: string;
  lat: string;
  lng: string;
  buildingType: string;
  buildingAge: string;
  floors: string;
  areaSqft: string;
  neededWithin: string;
  notes: string;
  details: ProjectDetails;
  savedAt: string;
};

export function draftStepLabel(step: number): string {
  const s = PROJECT_POST_STEPS[Math.min(Math.max(step, 0), PROJECT_POST_STEPS.length - 1)];
  return s?.label ?? `Step ${step + 1}`;
}

export function readProjectPostDraft(): ProjectPostDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROJECT_POST_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProjectPostDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      step: typeof parsed.step === 'number' ? parsed.step : 0,
      title: parsed.title ?? '',
      services: Array.isArray(parsed.services) ? parsed.services : [],
      locationText: parsed.locationText ?? '',
      lat: parsed.lat ?? '',
      lng: parsed.lng ?? '',
      buildingType: parsed.buildingType ?? '',
      buildingAge: parsed.buildingAge ?? '',
      floors: parsed.floors ?? '',
      areaSqft: parsed.areaSqft ?? '',
      neededWithin: parsed.neededWithin ?? '',
      notes: parsed.notes ?? '',
      details: (parsed.details ?? {}) as ProjectDetails,
      savedAt: parsed.savedAt ?? '',
    };
  } catch {
    return null;
  }
}

export function writeProjectPostDraft(draft: Omit<ProjectPostDraft, 'savedAt'>): ProjectPostDraft {
  const payload: ProjectPostDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(PROJECT_POST_DRAFT_KEY, JSON.stringify(payload));
  return payload;
}

export function clearProjectPostDraft(): void {
  localStorage.removeItem(PROJECT_POST_DRAFT_KEY);
}

export function hasProjectPostDraft(): boolean {
  return readProjectPostDraft() != null;
}

export function draftDisplayTitle(draft: ProjectPostDraft): string {
  const t = draft.title.trim();
  return t || 'Untitled draft';
}
