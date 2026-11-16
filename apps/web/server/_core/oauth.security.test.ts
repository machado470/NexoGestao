import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Google OAuth credential forwarding', () => {
  let routes: Map<string, Function>;
  let state: string;
  let response: any;
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'local-test-only');
    vi.stubEnv('GOOGLE_OAUTH_STATE_SECRET', 'local-state-test-only');
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3010/api/auth/google/callback');
    routes = new Map();
    const { registerOAuthRoutes } = await import('./oauth');
    registerOAuthRoutes({ get: (path: string, handler: Function) => routes.set(path, handler) } as any);
    response = { cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() };
    routes.get('/api/auth/google')!({ query: {}, headers: {} }, response);
    state = response.cookie.mock.calls.find(([name]: string[]) => name === 'oauth_google_state')[1];
    response.cookie.mockClear();
    response.redirect.mockClear();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const callbackRequest = (state: string) => ({ query: { code: 'test-code', state },
    cookies: { oauth_google_state: state }, headers: {} });

  it('forwards only the Google ID token, not an asserted email/profile', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access', id_token: 'signed-google-id-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'local-session' }) });
    vi.stubGlobal('fetch', fetch);
    await routes.get('/api/auth/google/callback')!(callbackRequest(state), response);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, options] = fetch.mock.calls[1];
    expect(url).toMatch(/\/auth\/google\/bff-login$/);
    expect(JSON.parse(options.body)).toEqual({ idToken: 'signed-google-id-token' });
    expect(response.cookie).toHaveBeenCalledWith('nexo_token', 'local-session', expect.any(Object));
  });
  it('does not establish a session if the token exchange omits the ID token', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'access' }) });
    vi.stubGlobal('fetch', fetch);
    await routes.get('/api/auth/google/callback')!(callbackRequest(state), response);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(expect.stringContaining('google_oauth_callback_failed'));
  });
  it('rejects modified OAuth state before contacting Google or the API', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await routes.get('/api/auth/google/callback')!(callbackRequest(state + 'tampered'), response);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });
});
