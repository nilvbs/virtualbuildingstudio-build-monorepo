import {
  addWorkingHours,
  isWithinWorkingHours,
  remainingWorkingMs,
} from './working-hours';

describe('working-hours', () => {
  const config = {
    timeZone: 'UTC',
    startHour: 9,
    endHour: 18,
    workdays: [1, 2, 3, 4, 5],
  };

  it('detects weekday business hours in UTC', () => {
    // Wednesday 10:00 UTC
    expect(isWithinWorkingHours(new Date('2026-09-09T10:00:00Z'), config)).toBe(true);
    // Wednesday 08:00 UTC
    expect(isWithinWorkingHours(new Date('2026-09-09T08:00:00Z'), config)).toBe(false);
    // Saturday 12:00 UTC
    expect(isWithinWorkingHours(new Date('2026-09-12T12:00:00Z'), config)).toBe(false);
  });

  it('adds three working hours across a lunch-to-evening stretch', () => {
    const from = new Date('2026-09-09T16:00:00Z'); // Wed 16:00
    const deadline = addWorkingHours(from, 3, config);
    // 2h Wed (16–18) + 1h Thu (09–10) → ~Thu 10:00
    expect(deadline.toISOString()).toBe('2026-09-10T10:00:00.000Z');
  });

  it('counts remaining working ms until deadline', () => {
    const now = new Date('2026-09-09T17:00:00Z');
    const deadline = new Date('2026-09-10T10:00:00Z');
    const ms = remainingWorkingMs(now, deadline, config);
    // 1h Wed + 1h Thu = 2h
    expect(ms).toBe(2 * 3_600_000);
  });
});
