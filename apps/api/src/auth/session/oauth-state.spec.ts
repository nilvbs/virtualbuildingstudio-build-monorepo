import { createOAuthState, verifyOAuthState } from './oauth-state';

const SECRET = 'test-secret';

describe('oauth-state', () => {
  it('verifies a state presented with its own nonce', () => {
    const { state, nonce } = createOAuthState('surveyor', SECRET);
    expect(verifyOAuthState(state, nonce, SECRET)).toEqual({ role: 'surveyor' });
  });

  it('rejects a missing or foreign nonce (login CSRF)', () => {
    const { state } = createOAuthState('client', SECRET);
    const other = createOAuthState('client', SECRET);
    expect(verifyOAuthState(state, undefined, SECRET)).toBeNull();
    expect(verifyOAuthState(state, other.nonce, SECRET)).toBeNull();
  });

  it('rejects tampered or differently signed state', () => {
    const { state, nonce } = createOAuthState('client', SECRET);
    const [body, sig] = state.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), r: 'surveyor' }),
    ).toString('base64url');
    expect(verifyOAuthState(`${forgedBody}.${sig}`, nonce, SECRET)).toBeNull();
    expect(verifyOAuthState(state, nonce, 'other-secret')).toBeNull();
  });

  it('rejects expired state', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const { state, nonce } = createOAuthState('client', SECRET);
    jest.setSystemTime(new Date('2026-01-01T00:11:00Z'));
    expect(verifyOAuthState(state, nonce, SECRET)).toBeNull();
    jest.useRealTimers();
  });
});
