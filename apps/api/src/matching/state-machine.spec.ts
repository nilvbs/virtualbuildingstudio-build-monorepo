import {
  PROJECT_STATUS_TRANSITIONS,
  MATCH_STATUS_TRANSITIONS,
  isValidTransition,
} from '@surveylink/types';

/**
 * These are the Phase 1 invariants that Phase 2 (offers, payments, busy-lock)
 * will build on. Even though there is no money yet, the status state machines
 * must hold. Transitions are enforced in the backend, not just the UI.
 */
describe('project status state machine', () => {
  it('advances submitted -> matching -> matched -> confirmed -> completed', () => {
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'submitted', 'matching')).toBe(true);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'matching', 'matched')).toBe(true);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'matched', 'confirmed')).toBe(true);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'confirmed', 'completed')).toBe(true);
  });

  it('allows cancelling from any non-terminal state', () => {
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'submitted', 'cancelled')).toBe(true);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'matching', 'cancelled')).toBe(true);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'matched', 'cancelled')).toBe(true);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'confirmed', 'cancelled')).toBe(true);
  });

  it('rejects skipping states and leaving terminal states', () => {
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'submitted', 'completed')).toBe(false);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'submitted', 'matched')).toBe(false);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'completed', 'matching')).toBe(false);
    expect(isValidTransition(PROJECT_STATUS_TRANSITIONS, 'cancelled', 'submitted')).toBe(false);
  });
});

describe('match status state machine', () => {
  it('follows proposed -> accepted -> completed', () => {
    expect(isValidTransition(MATCH_STATUS_TRANSITIONS, 'proposed', 'accepted')).toBe(true);
    expect(isValidTransition(MATCH_STATUS_TRANSITIONS, 'accepted', 'completed')).toBe(true);
  });

  it('allows declining a proposed match', () => {
    expect(isValidTransition(MATCH_STATUS_TRANSITIONS, 'proposed', 'declined')).toBe(true);
  });

  it('rejects invalid jumps', () => {
    expect(isValidTransition(MATCH_STATUS_TRANSITIONS, 'proposed', 'completed')).toBe(false);
    expect(isValidTransition(MATCH_STATUS_TRANSITIONS, 'declined', 'accepted')).toBe(false);
  });
});
