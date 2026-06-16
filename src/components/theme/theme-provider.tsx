"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type Accent = "gold" | "blue" | "emerald" | "rose" | "violet";

const ACCENT_IDS: Accent[] = ["gold", "blue", "emerald", "rose", "violet"];

interface ThemeContextValue {
  theme: Theme;
  accent: Accent;
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  accent: "gold",
  setTheme: () => {},
  setAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [accent, setAccentState] = useState<Accent>("gold");

  useEffect(() => {
    const html = document.documentElement;
    const t = html.classList.contains("light") ? "light" : "dark";
    const a = (ACCENT_IDS.find((id) => html.classList.contains(`accent-${id}`)) ?? "gold") as Accent;
    setThemeState(t);
    setAccentState(a);
  }, []);

  function setTheme(t: Theme) {
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(t);
    try { localStorage.setItem("odigo-theme", t); } catch {}
    setThemeState(t);
  }

  function setAccent(a: Accent) {
    const html = document.documentElement;
    ACCENT_IDS.forEach((id) => html.classList.remove(`accent-${id}`));
    html.classList.add(`accent-${a}`);
    try { localStorage.setItem("odigo-accent", a); } catch {}
    setAccentState(a);
  }

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}
