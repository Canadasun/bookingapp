// Tests for auth.ts — refresh session mutex and session-clearing on failure.

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('expo-local-authentication', () => ({}));
jest.mock('../config', () => ({ API_BASE: 'https://api.example.com', BIZ_ID: 'biz_test' }));
jest.mock('../pinnedFetch', () => ({ pinnedFetch: jest.fn() }));

let setAuth: typeof import('../auth').setAuth;
let getAuth: typeof import('../auth').getAuth;
let refreshSession: typeof import('../auth').refreshSession;
let invalidateSessionRefresh: typeof import('../auth').invalidateSessionRefresh;
let pinnedFetchMock: jest.MockedFunction<any>;

beforeEach(() => {
  jest.resetModules();
  // Re-require after resetModules so each test gets a fresh module with null _refreshPromise
  ({ setAuth, getAuth, refreshSession, invalidateSessionRefresh } = require('../auth'));
  ({ pinnedFetch: pinnedFetchMock } = require('../pinnedFetch'));
});

const testUser = { id: '1', name: 'Test', email: 'test@example.com', role: 'OWNER', staffId: null, businessId: 'biz1' };

describe('refreshSession', () => {
  it('returns false and clears session when the server rejects the refresh token', async () => {
    pinnedFetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    setAuth('old-token', testUser, 'old-refresh');

    const result = await refreshSession();

    expect(result).toBe(false);
    expect(getAuth().token).toBeNull();
    expect(getAuth().refresh).toBeNull();
  });

  it('issues only one fetch when called concurrently (mutex)', async () => {
    const newTokenResponse = {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      user: testUser,
    };
    let resolveFetch!: (v: unknown) => void;
    pinnedFetchMock.mockReturnValue(new Promise((res) => { resolveFetch = res; }));
    setAuth('old-token', null, 'old-refresh');

    // Start both calls before either resolves
    const p1 = refreshSession();
    const p2 = refreshSession();
    resolveFetch({ ok: true, json: async () => newTokenResponse });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(pinnedFetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(getAuth().token).toBe('new-access');
  });

  it('stores new tokens on success', async () => {
    const response = {
      accessToken: 'token-abc',
      refreshToken: 'refresh-abc',
      user: { ...testUser, id: '2', name: 'Owner' },
    };
    pinnedFetchMock.mockResolvedValue({ ok: true, json: async () => response });
    setAuth('expired', null, 'valid-refresh');

    const result = await refreshSession();

    expect(result).toBe(true);
    expect(getAuth().token).toBe('token-abc');
    expect(getAuth().user?.name).toBe('Owner');
  });

  it('routes refresh-token exchange through the hardened fetch wrapper', async () => {
    pinnedFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'new', refreshToken: 'rotated', user: testUser }),
    });
    setAuth('expired', testUser, 'refresh-token');

    await refreshSession();

    expect(pinnedFetchMock).toHaveBeenCalledWith(
      'https://api.example.com/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not restore credentials when logout invalidates an in-flight refresh', async () => {
    let resolveFetch!: (value: unknown) => void;
    pinnedFetchMock.mockReturnValue(new Promise(resolve => { resolveFetch = resolve; }));
    setAuth('expired', testUser, 'refresh-token');

    const pending = refreshSession();
    invalidateSessionRefresh();
    setAuth(null, null, null);
    resolveFetch({
      ok: true,
      json: async () => ({ accessToken: 'restored', refreshToken: 'rotated', user: testUser }),
    });

    await expect(pending).resolves.toBe(false);
    expect(getAuth().token).toBeNull();
    expect(getAuth().refresh).toBeNull();
  });
});
