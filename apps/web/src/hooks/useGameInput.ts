import { useCallback, useEffect, useRef } from 'react';

export interface InputState {
  dx: number;
  dz: number;
  boost: boolean;
  jump: boolean;
}

export function useGameInput() {
  const keysRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<InputState>({
    dx: 0,
    dz: 0,
    boost: false,
    jump: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore game inputs if focusing an input/textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      keysRef.current.add(key);
      // Prevent page scroll
      if (
        [
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          ' ',
          'shift',
        ].includes(key)
      ) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const handleBlur = () => {
      keysRef.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Call this every frame to get current input
  const getInput = useCallback((): InputState => {
    const keys = keysRef.current;
    let dx = 0;
    let dz = 0;

    if (keys.has('w') || keys.has('arrowup')) dz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dz += 1;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;

    // Normalize diagonal
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }

    const boost = keys.has('shift');
    const jump = keys.has(' ');

    inputRef.current = { dx, dz, boost, jump };
    return inputRef.current;
  }, []);

  return { getInput, inputRef };
}
