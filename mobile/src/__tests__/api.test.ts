// Tests for api.ts — Content-Type handling and token injection.

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('expo-local-authentication', () => ({}));
jest.mock('../config', () => ({ API_BASE: 'https://api.example.com', BIZ_ID: 'biz_test' }));
jest.mock('../pinnedFetch', () => ({ pinnedFetch: jest.fn() }));

let api: typeof import('../api').api;
let unregisterPushNotifications: typeof import('../api').unregisterPushNotifications;
let setAuth: typeof import('../auth').setAuth;
let pinnedFetchMock: jest.MockedFunction<any>;

beforeEach(() => {
  jest.resetModules();
  jest.mock('../pinnedFetch', () => ({ pinnedFetch: jest.fn() }));
  ({ setAuth } = require('../auth'));
  ({ api, unregisterPushNotifications } = require('../api'));
  ({ pinnedFetch: pinnedFetchMock } = require('../pinnedFetch'));
});

function makeOkResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('api Content-Type header', () => {
  it('sets application/json for plain JSON body', async () => {
    pinnedFetchMock.mockResolvedValue(makeOkResponse({ result: 'ok' }));
    setAuth('test-token', null, null);

    await api('/test', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) });

    const [, init] = pinnedFetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('omits Content-Type for FormData so RN can set the multipart boundary', async () => {
    pinnedFetchMock.mockResolvedValue(makeOkResponse({ url: 'https://cdn.example.com/logo.jpg' }));
    setAuth('test-token', null, null);

    const form = new FormData();
    form.append('key', 'value');
    await api('/uploads', { method: 'POST', body: form });

    const [, init] = pinnedFetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('always injects the Bearer token when authenticated', async () => {
    pinnedFetchMock.mockResolvedValue(makeOkResponse({}));
    setAuth('my-jwt', null, null);

    await api('/me');

    const [, init] = pinnedFetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt');
  });

  it('omits Authorization header when not authenticated', async () => {
    pinnedFetchMock.mockResolvedValue(makeOkResponse({ bookingPage: 'https://example.com' }));
    setAuth(null, null, null);

    await api('/public/page');

    const [, init] = pinnedFetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('does not replay a failed mutation after a transport error', async () => {
    pinnedFetchMock.mockRejectedValue(new Error('connection reset'));
    setAuth('test-token', null, null);

    await expect(api('/messages', { method: 'POST', body: JSON.stringify({ content: 'hello' }) }))
      .rejects.toThrow('connection reset');

    expect(pinnedFetchMock).toHaveBeenCalledTimes(1);
  });

  it('revokes the current device token with the captured session token', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockResolvedValueOnce('device-token-id');
    pinnedFetchMock.mockResolvedValue(makeOkResponse({ ok: true }));
    setAuth('logout-token', null, null);

    const pending = unregisterPushNotifications();
    setAuth(null, null, null);
    await pending;

    const [, init] = pinnedFetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer logout-token');
  });
});
