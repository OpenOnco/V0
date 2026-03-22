import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTestData } from '../src/hooks/useTestData';

// Don't mock useTestData here — we test it directly

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('useTestData', () => {
  it('starts in loading state', () => {
    // Mock fetch to hang indefinitely
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTestData());
    expect(result.current.source).toBe('loading');
    expect(result.current.tests).toEqual([]);
    expect(result.current.error).toBe(false);
  });

  it('sets error state on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useTestData());

    await waitFor(() => {
      expect(result.current.source).toBe('error');
    });
    expect(result.current.error).toBe(true);
    expect(result.current.tests).toEqual([]);
  });

  it('sets error state on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    });
    const { result } = renderHook(() => useTestData());

    await waitFor(() => {
      expect(result.current.source).toBe('error');
    });
    expect(result.current.error).toBe(true);
  });

  it('sets error state when API returns empty array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    const { result } = renderHook(() => useTestData());

    await waitFor(() => {
      expect(result.current.source).toBe('error');
    });
  });

  it('loads tests successfully from API', async () => {
    const mockData = {
      data: [
        {
          name: 'TestMCED',
          vendor: 'VendorX',
          testScope: 'Multi-cancer early detection',
          perCancerEarlyStageSensitivity: { Lung: 50, Breast: 30 },
          perCancerEarlyStageSensitivitySource: 'Study X',
          cancerTypeSensitivity: [],
        },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { result } = renderHook(() => useTestData());

    await waitFor(() => {
      expect(result.current.source).toBe('api');
    });
    expect(result.current.tests).toHaveLength(1);
    expect(result.current.tests[0].name).toBe('TestMCED');
    expect(result.current.tests[0].cancers).toEqual({ Lung: 50, Breast: 30 });
    expect(result.current.error).toBe(false);
  });

  it('filters out non-multi-cancer tests', async () => {
    const mockData = {
      data: [
        {
          name: 'MultiTest',
          vendor: 'V',
          testScope: 'Multi-cancer early detection',
          perCancerEarlyStageSensitivity: { Lung: 50 },
          cancerTypeSensitivity: [],
        },
        {
          name: 'SingleTest',
          vendor: 'V',
          testScope: 'Single cancer',
          perCancerEarlyStageSensitivity: { Lung: 50 },
          cancerTypeSensitivity: [],
        },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { result } = renderHook(() => useTestData());

    await waitFor(() => {
      expect(result.current.source).toBe('api');
    });
    expect(result.current.tests).toHaveLength(1);
    expect(result.current.tests[0].name).toBe('MultiTest');
  });
});
