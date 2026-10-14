import { useAppStore } from "../store/useAppStore";

export const SURYOYE_PALETTE = {
  // Primaire erfgoedkleuren (Tur Abdin, Midyat, Mor Gabriel)
  manuscriptCrimson: "#8C1D24",
  manuscriptCrimsonLight: "#A8242C",
  manuscriptCrimsonSoft: "rgba(140, 29, 36, 0.12)",

  oldGold: "#D4AF37",
  saffronGold: "#E09F3E",
  goldSoft: "rgba(212, 175, 55, 0.16)",

  terracotta: "#A85A3A",
  terracottaSoft: "rgba(168, 90, 58, 0.14)",

  olive: "#4A5D4E",
  oliveSoft: "rgba(74, 93, 78, 0.15)",

  // Statuskleuren
  success: "#2E6F40",
  warning: "#D9822B",
  error: "#B91C1C",

  // Light Mode (Midyat Kalksteen & Perkament)
  light: {
    background: "#F6F0E6",
    surface: "#EFE6D5",
    surfaceElevated: "#FAF6F0",
    border: "#DFD3BD",
    archStroke: "#C9B99B",
    textPrimary: "#231F1C",
    textSecondary: "#5C5349",
    textMuted: "#877B6E",
  },

  // Dark Mode (Mesopotamisch Nachtblauw / Basalt & Koper)
  dark: {
    background: "#161412",
    surface: "#211E1A",
    surfaceElevated: "#2B2722",
    border: "#38322B",
    archStroke: "#4F463B",
    textPrimary: "#F5EFE6",
    textSecondary: "#C4B7A6",
    textMuted: "#8A7E70",
  },
} as const;

export interface SuryoyeTheme {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  archStroke: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  gold: string;
  saffron: string;
  goldSoft: string;
  terracotta: string;
  terracottaSoft: string;
  olive: string;
  oliveSoft: string;
  success: string;
  error: string;
}

export function useSuryoyeTheme(): SuryoyeTheme {
  const themeMode = useAppStore((s) => s.themeMode);
  const isDark = themeMode === "dark";
  const modeColors = isDark ? SURYOYE_PALETTE.dark : SURYOYE_PALETTE.light;

  return {
    isDark,
    ...modeColors,
    primary: SURYOYE_PALETTE.manuscriptCrimson,
    primarySoft: SURYOYE_PALETTE.manuscriptCrimsonSoft,
    gold: SURYOYE_PALETTE.oldGold,
    saffron: SURYOYE_PALETTE.saffronGold,
    goldSoft: SURYOYE_PALETTE.goldSoft,
    terracotta: SURYOYE_PALETTE.terracotta,
    terracottaSoft: SURYOYE_PALETTE.terracottaSoft,
    olive: SURYOYE_PALETTE.olive,
    oliveSoft: SURYOYE_PALETTE.oliveSoft,
    success: SURYOYE_PALETTE.success,
    error: SURYOYE_PALETTE.error,
  };
}
