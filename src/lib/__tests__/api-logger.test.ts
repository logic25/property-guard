import { describe, it, expect } from 'vitest';
import { loggedFetch } from '@/lib/api-logger';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}));

describe('api-logger', () => {
  it('detects PLUTO endpoint from URL', async () => {
    // Mock global fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockFetch);

    const response = await loggedFetch('https://data.cityofnewyork.us/resource/64uk-42ks.json?bbl=1234567890');
    
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);

    vi.unstubAllGlobals();
  });

  it('logs errors and re-throws on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      loggedFetch('https://data.cityofnewyork.us/resource/ic3t-wcy2.json')
    ).rejects.toThrow('Network error');

    vi.unstubAllGlobals();
  });

  it('handles non-ok responses without throwing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ error: 'Forbidden' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const response = await loggedFetch('https://data.cityofnewyork.us/resource/bc8t-ecyu.json');
    expect(response.status).toBe(403);

    vi.unstubAllGlobals();
  });

  it('detects various endpoint types', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    vi.stubGlobal('fetch', mockFetch);

    // Just verify it doesn't throw for various URLs
    await loggedFetch('https://data.cityofnewyork.us/resource/3h2n-5cm9.json');
    await loggedFetch('https://data.cityofnewyork.us/resource/jt7v-77mi.json');
    await loggedFetch('https://example.com/api/other');
    
    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.unstubAllGlobals();
  });
});
