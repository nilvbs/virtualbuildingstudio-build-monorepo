import { redirect } from 'next/navigation';

/** Surveyors list merged into Users — keep deep links working via role filter. */
export default function AdminSurveyorsRedirectPage() {
  redirect('/build/admin/users?role=surveyor');
}
