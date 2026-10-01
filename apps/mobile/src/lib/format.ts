import { SURVEY_SERVICE_LABELS, type SurveyService } from '@surveylink/types';

const TIMELINE_LABELS: Record<string, string> = {
  asap: 'As soon as possible',
  within_3_days: 'Within 3 days',
  '2_weeks': 'Within 2 weeks',
  '1_month': 'Within a month',
  flexible: 'Flexible',
};

export function serviceLabel(service: string): string {
  return SURVEY_SERVICE_LABELS[service as SurveyService] ?? service.replaceAll('_', ' ');
}

export function timelineLabel(value: string): string {
  return TIMELINE_LABELS[value] ?? value.replaceAll('_', ' ');
}

export function buildingLabel(type: string): string {
  return type.replaceAll('_', ' ');
}

export function firstName(fullName: string | null | undefined): string {
  const part = (fullName ?? '').trim().split(/\s+/)[0];
  return part || 'there';
}

export function formatDistanceMi(km: number): string {
  const miles = km * 0.621371;
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${(Math.round(miles * 10) / 10).toLocaleString('en-US')} mi`;
  return `${Math.round(miles).toLocaleString('en-US')} mi`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
