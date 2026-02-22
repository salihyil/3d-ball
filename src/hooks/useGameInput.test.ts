import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameInput } from './useGameInput';

describe('useGameInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.dispatchEvent(new Event('blur')); // Clear keys
  });

  it('should initialize with zero input', () => {
    const { result } = renderHook(() => useGameInput());
    const input = result.current.getInput();
    expect(input).toEqual({ dx: 0, dz: 0, boost: false, jump: false });
  });

  it('should update input when keys are pressed', () => {
    const { result } = renderHook(() => useGameInput());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

    const input = result.current.getInput();
    // Diagonal normalized
    expect(input.dz).toBeCloseTo(-0.7071, 4);
    expect(input.dx).toBeCloseTo(0.7071, 4);
  });

  it('should handle boost and jump keys', () => {
    const { result } = renderHook(() => useGameInput());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    const input = result.current.getInput();
    expect(input.boost).toBe(true);
    expect(input.jump).toBe(true);
  });

  it('should ignore keys when input/textarea is focused', () => {
    const { result } = renderHook(() => useGameInput());

    // Mock activeElement
    const inputEl = document.createElement('input');
    document.body.appendChild(inputEl);
    inputEl.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));

    const input = result.current.getInput();
    expect(input.dz).toBe(0);

    // Clean up
    inputEl.blur();
    document.body.removeChild(inputEl);
  });

  it('should clear keys on blur', () => {
    const { result } = renderHook(() => useGameInput());

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    window.dispatchEvent(new Event('blur'));

    const input = result.current.getInput();
    expect(input.dz).toBe(0);
  });

  it('should prevent default on certain keys', () => {
    renderHook(() => useGameInput());
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    const spy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });
});
