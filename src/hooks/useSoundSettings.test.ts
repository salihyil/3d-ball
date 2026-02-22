import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSoundSettings } from './useSoundSettings';

describe('useSoundSettings', () => {
  const STORAGE_KEY = 'bb-sound-enabled';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should initialize with true if no value in localStorage', () => {
    const { result } = renderHook(() => useSoundSettings());
    expect(result.current.isSoundEnabled).toBe(true);
  });

  it('should initialize with value from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    const { result } = renderHook(() => useSoundSettings());
    expect(result.current.isSoundEnabled).toBe(false);
  });

  it('should toggle sound and update localStorage', () => {
    const { result } = renderHook(() => useSoundSettings());

    act(() => {
      result.current.toggleSound();
    });

    expect(result.current.isSoundEnabled).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');

    act(() => {
      result.current.toggleSound();
    });

    expect(result.current.isSoundEnabled).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('should dispatch sound-setting-changed event when toggled', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useSoundSettings());

    act(() => {
      result.current.toggleSound();
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sound-setting-changed',
        detail: { isSoundEnabled: false },
      })
    );
  });
});
