import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bb-sound-enabled";

export function useSoundSettings() {
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsSoundEnabled(stored === "true");
    }
  }, []);

  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const newVal = !prev;
      localStorage.setItem(STORAGE_KEY, String(newVal));

      // We also update a global variable or emit an event for non-React contexts (like useGameInput/GameScene)
      // The easiest robust way without context is dispatching a custom event, or having a global flag on window.
      window.dispatchEvent(
        new CustomEvent("sound-setting-changed", { detail: { isSoundEnabled: newVal } }),
      );

      return newVal;
    });
  }, []);

  return { isSoundEnabled, toggleSound };
}
