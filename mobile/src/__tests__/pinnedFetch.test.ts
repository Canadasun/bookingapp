jest.mock('../config', () => ({ API_BASE: 'https://api.pulseappointments.com/api' }));
jest.mock('react-native-ssl-pinning', () => ({ fetch: jest.fn() }));

describe('pinnedFetch', () => {
  const originalDev = (global as any).__DEV__;

  afterEach(() => {
    (global as any).__DEV__ = originalDev;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('fails closed when native certificate pinning rejects the connection', async () => {
    (global as any).__DEV__ = false;
    const standardFetch = jest.fn();
    global.fetch = standardFetch as any;

    const { fetch: sslFetch } = require('react-native-ssl-pinning');
    sslFetch.mockRejectedValue(new Error('certificate pinning failure'));
    const { pinnedFetch } = require('../pinnedFetch');

    await expect(pinnedFetch('https://api.pulseappointments.com/api/me'))
      .rejects.toThrow('certificate pinning failure');
    expect(standardFetch).not.toHaveBeenCalled();
  });

  it('blocks unexpected production hosts before making a request', async () => {
    (global as any).__DEV__ = false;
    const { fetch: sslFetch } = require('react-native-ssl-pinning');
    const { pinnedFetch } = require('../pinnedFetch');

    await expect(pinnedFetch('https://attacker.example/api/me'))
      .rejects.toThrow('blocked request to unexpected host');
    expect(sslFetch).not.toHaveBeenCalled();
  });
});
