export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "simap.theme";

export function parseTheme(value: string | null | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolveTheme(stored: Theme | null, systemDark: boolean): Theme {
  return stored ?? (systemDark ? "dark" : "light");
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

export function readStoredTheme(storage: ReadStorage): Theme | null {
  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredTheme(storage: WriteStorage, theme: Theme): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this page only.
  }
}

/** Inline script run in <head> before paint: sets `data-theme` from storage, else the system setting. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;
