import type { HelpTicketWorkspace } from '@surveylink/types';

export interface HelpFaqItem {
  id: string;
  question: string;
  answer: string;
}

const CLIENT_FAQS: HelpFaqItem[] = [
  {
    id: 'c-post',
    question: 'How do I post a survey project?',
    answer:
      'Go to Projects → New brief and walk through the guided steps. Share the site location, services you need (laser scanning, BIM, etc.), timing, and any notes. Once submitted, nearby surveyors are notified automatically.',
  },
  {
    id: 'c-match',
    question: 'What happens after I submit a brief?',
    answer:
      'Your project moves into matching. Eligible surveyors get an offer with a working-hours response window (typically business hours, Mon–Fri). When someone accepts, the project is matched and you can track progress from the project page.',
  },
  {
    id: 'c-window',
    question: 'Why hasn’t anyone accepted yet?',
    answer:
      'Offers only count down during working hours, so evenings and weekends pause the timer. Coverage also depends on location, services, and how complete nearby portfolios are. If nothing lands, open a ticket and ops can help review matching.',
  },
  {
    id: 'c-status',
    question: 'Where do I see project status and assigned surveyors?',
    answer:
      'Open the project from Your projects. You’ll see matching progress, match status, and (once assigned) the surveyor’s workspace identity. Details stay on that page through completion.',
  },
  {
    id: 'c-feedback',
    question: 'When can I leave feedback?',
    answer:
      'After a match or project is completed, a short rating form appears on the project page. Feedback goes both ways—clients rate surveyors and surveyors can rate clients—to keep the marketplace trusted.',
  },
  {
    id: 'c-ticket',
    question: 'When should I open a help ticket?',
    answer:
      'Use a ticket for account issues, billing questions, matching problems, or anything that needs the ops team. Choose Blocker if you can’t proceed at all — those are prioritized and stay as a conversation thread until resolved.',
  },
];

const SURVEYOR_FAQS: HelpFaqItem[] = [
  {
    id: 's-portfolio',
    question: 'Why don’t I see project requests yet?',
    answer:
      'Requests and matches unlock after your portfolio is 100% complete—services, coverage, rates, and identity. Finish Portfolio in the sidebar, then check My Requests for incoming offers.',
  },
  {
    id: 's-requests',
    question: 'How do My Requests work?',
    answer:
      'When a nearby brief matches your services and coverage, you get an offer in My Requests. You can accept or decline inside the working-hours response window. Accepting moves the job into My Matches.',
  },
  {
    id: 's-hours',
    question: 'What is the working-hours response window?',
    answer:
      'Each offer has a deadline that only advances during official working hours (Mon–Fri). Outside that window the timer pauses, so you’re not penalized overnight or on weekends. Expired offers are cancelled automatically.',
  },
  {
    id: 's-matches',
    question: 'What’s the difference between Requests and Matches?',
    answer:
      'My Requests are open offers you haven’t accepted yet. My Matches are projects you’ve accepted—use that list to track active and completed work, and to leave feedback when a job is done.',
  },
  {
    id: 's-coverage',
    question: 'How does coverage affect which jobs I see?',
    answer:
      'Auto-matching prefers surveyors whose portfolio services and geographic coverage fit the brief. Keep your base city, service radius, and specialties up to date so you stay in range for relevant projects.',
  },
  {
    id: 's-ticket',
    question: 'When should I contact support?',
    answer:
      'Open a ticket for account access, portfolio problems, matching questions, or payment issues. Pick Blocker if work is stuck (expired offer, can’t accept, portfolio unlock). Replies stay in the same conversation thread.',
  },
];

export function faqsForWorkspace(workspace: HelpTicketWorkspace): HelpFaqItem[] {
  return workspace === 'client' ? CLIENT_FAQS : SURVEYOR_FAQS;
}
