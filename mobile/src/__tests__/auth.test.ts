// Tests for auth.ts — refresh session mutex and session-clearing on failure.

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('expo-local-authentication', () => ({}));
jest.mock('../config', () => ({ API_BASE: 'https://api.example.com', BIZ_ID: 'biz_test' }));

let setAuth: typeof import('../auth').setAuth;
let getAuth: typeof import('../auth').getAuth;
let refreshSession: typeof import('../auth').refreshSession;

beforeEach(() => {
  jest.resetModules();
  // Re-require after resetModules so each test gets a fresh module with null _refreshPromise
  ({ setAuth, getAuth, refreshSession } = require('../auth'));
});

const testUser = { id: '1', name: 'Test', email: 'test@example.com', role: 'OWNER', staffId: null, businessId: 'biz1' };

describe('refreshSession', () => {
  it('returns false and clears session when the server rejects the refresh token', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any;
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
    global.fetch = jest.fn().mockReturnValue(new Promise((res) => { resolveFetch = res; })) as any;
    setAuth('old-token', null, 'old-refresh');

    // Start both calls before either resolves
    const p1 = refreshSession();
    const p2 = refreshSession();
    resolveFetch({ ok: true, json: async () => newTokenResponse });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
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
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => response }) as any;
    setAuth('expired', null, 'valid-refresh');

    const result = await refreshSession();

    expect(result).toBe(true);
    expect(getAuth().token).toBe('token-abc');
    expect(getAuth().user?.name).toBe('Owner');
  });
});
