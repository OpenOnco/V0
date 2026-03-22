import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilters } from '../src/hooks/useFilters';

describe('useFilters', () => {
  it('starts with no sex selected', () => {
    const { result } = renderHook(() => useFilters());
    expect(result.current.sex).toBeNull();
    expect(result.current.selectedCancers).toEqual([]);
  });

  it('sets sex and clears state', () => {
    const { result } = renderHook(() => useFilters());
    act(() => result.current.setSex('male'));
    expect(result.current.sex).toBe('male');
  });

  it('toggles family cancers', () => {
    const { result } = renderHook(() => useFilters());
    act(() => result.current.toggleFamily('Lung'));
    expect(result.current.familyCancers.has('Lung')).toBe(true);
    expect(result.current.selectedCancers).toContain('Lung');

    act(() => result.current.toggleFamily('Lung'));
    expect(result.current.familyCancers.has('Lung')).toBe(false);
    expect(result.current.selectedCancers).not.toContain('Lung');
  });

  it('allows multiple family cancers', () => {
    const { result } = renderHook(() => useFilters());
    act(() => result.current.toggleFamily('Lung'));
    act(() => result.current.toggleFamily('Breast'));
    expect(result.current.familyCancers.size).toBe(2);
    expect(result.current.selectedCancers).toContain('Lung');
    expect(result.current.selectedCancers).toContain('Breast');
  });

  it('toggles smoking and adds cancers', () => {
    const { result } = renderHook(() => useFilters());
    act(() => result.current.toggleSmoke());
    expect(result.current.smokeOn).toBe(true);
    expect(result.current.selectedCancers).toContain('Lung');
    expect(result.current.selectedCancers).toContain('Bladder');
    expect(result.current.selectedCancers.length).toBe(6);

    act(() => result.current.toggleSmoke());
    expect(result.current.smokeOn).toBe(false);
    expect(result.current.selectedCancers).toEqual([]);
  });

  it('toggles gaps', () => {
    const { result } = renderHook(() => useFilters());
    act(() => result.current.toggleGap('Colon/Rectum'));
    expect(result.current.selectedCancers).toContain('Colon/Rectum');
    act(() => result.current.toggleGap('Colon/Rectum'));
    expect(result.current.selectedCancers).not.toContain('Colon/Rectum');
  });

  it('deduplicates across sources', () => {
    const { result } = renderHook(() => useFilters());
    act(() => result.current.toggleFamily('Lung'));
    act(() => result.current.toggleSmoke());
    // Lung from both family + smoking, should appear once
    const lungCount = result.current.selectedCancers.filter((c) => c === 'Lung').length;
    expect(lungCount).toBe(1);
  });

  it('resets everything', () => {
    const { result } = renderHook(() => useFilters());
    act(() => result.current.setSex('female'));
    act(() => result.current.toggleFamily('Breast'));
    act(() => result.current.toggleSmoke());
    act(() => result.current.toggleGap('Cervix'));
    act(() => result.current.resetAll());

    expect(result.current.sex).toBeNull();
    expect(result.current.familyCancers.size).toBe(0);
    expect(result.current.smokeOn).toBe(false);
    expect(result.current.gapSet.size).toBe(0);
    expect(result.current.selectedCancers).toEqual([]);
  });
});
