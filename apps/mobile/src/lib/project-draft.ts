import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROJECT_POST_STEPS, type SurveyService } from '@surveylink/types';

export const PROJECT_DRAFT_KEY = 'bld.mobile.projectPostDraft.v1';

export type ProjectDraftSummary = {
  title: string;
  stepLabel: string;
  services: SurveyService[];
  locationText: string;
  savedAt: string | null;
};

/** Summary of the in-progress brief for the Projects screen; null when nothing worth resuming. */
export async function readProjectDraftSummary(): Promise<ProjectDraftSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(PROJECT_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as {
      step?: number;
      title?: string;
      autoTitle?: string;
      services?: SurveyService[];
      savedAt?: string;
      details?: { address?: string; city?: string; state?: string };
    };
    const services = Array.isArray(d.services) ? d.services : [];
    const locationText = [d.details?.address, d.details?.city, d.details?.state]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(', ');
    const title = (d.title ?? '').trim();
    if (!title && services.length === 0 && !locationText) return null;
    const step = typeof d.step === 'number' ? d.step : 0;
    return {
      title: title || (d.autoTitle ?? '').trim() || 'Untitled project',
      stepLabel: PROJECT_POST_STEPS[Math.min(Math.max(step, 0), PROJECT_POST_STEPS.length - 1)]?.label ?? '',
      services,
      locationText,
      savedAt: typeof d.savedAt === 'string' ? d.savedAt : null,
    };
  } catch {
    return null;
  }
}

export async function clearProjectDraft(): Promise<void> {
  await AsyncStorage.removeItem(PROJECT_DRAFT_KEY);
}
