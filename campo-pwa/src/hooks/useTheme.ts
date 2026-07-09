import { useCallback, useEffect, useState } from "react";

// Modo sol (spec cofre e portão §5.3): tema claro de alto contraste para leitura
// sob sol. v1: inversão CSS global com contra-inversão de mídia — barato e
// reversível; a validação de campo julga se basta (v2 seria tema por tokens).

const KEY = "campo-theme";
export type Theme = "dark" | "sun";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("sun", theme === "sun");
}

export function initTheme(): void {
  apply((localStorage.getItem(KEY) as Theme) ?? "dark");
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(KEY) as Theme) ?? "dark",
  );
  useEffect(() => apply(theme), [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "sun" ? "dark" : "sun";
      localStorage.setItem(KEY, next);
      return next;
    });
  }, []);
  return { theme, toggle };
}
