"use client";

import { useEffect, useState } from "react";
import { nextTheme, parseTheme, writeStoredTheme, type Theme } from "@/lib/theme";
import { shellCopy } from "./copy/shell";
import { IconButton } from "./Button";

/** Light/dark switch. The initial theme is set before paint by THEME_INIT_SCRIPT; this only reads and changes it. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(parseTheme(document.documentElement.dataset.theme) ?? "light");
  }, []);

  const toggle = () => {
    const next = nextTheme(theme ?? "light");
    document.documentElement.dataset.theme = next;
    writeStoredTheme(localStorage, next);
    setTheme(next);
  };

  return (
    <IconButton
      icon={theme === "dark" ? "light_mode" : "dark_mode"}
      label={shellCopy.actions.toggleTheme}
      aria-pressed={theme === "dark"}
      onClick={toggle}
    />
  );
}
