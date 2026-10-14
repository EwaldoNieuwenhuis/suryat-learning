import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";

let storage: MMKV | null = null;
const memoryStore = new Map<string, string>();

try {
  storage = new MMKV({ id: "surayt-user-preferences" });
} catch {
  // Fallback for environments without MMKV native JSI module (e.g. Expo Go, web, tests)
  storage = null;
}

const mmkvStorageAdapter: StateStorage = {
  setItem: (name, value) => {
    if (storage) {
      storage.set(name, value);
    } else {
      memoryStore.set(name, value);
    }
  },
  getItem: (name) => {
    if (storage) {
      return storage.getString(name) ?? null;
    }
    return memoryStore.get(name) ?? null;
  },
  removeItem: (name) => {
    if (storage) {
      storage.delete(name);
    } else {
      memoryStore.delete(name);
    }
  },
};

export type ScriptDisplayMode = "dual" | "serto_only" | "latin_only";
export type TranslationLanguage = "nl" | "en" | "de";
export type ThemeMode = "light" | "dark";

interface AppState {
  scriptMode: ScriptDisplayMode;
  showVocalizedSerto: boolean; // Toon Serto met Zow'e klinkerpunten (true) of ongevocaliseerd (false)
  uiLanguage: TranslationLanguage;
  themeMode: ThemeMode;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDateIso: string | null;
  dailyGoalXp: number;
  todayXp: number;

  // Actions
  setScriptMode: (mode: ScriptDisplayMode) => void;
  cycleScriptMode: () => void;
  toggleVocalizedSerto: () => void;
  setUiLanguage: (lang: TranslationLanguage) => void;
  toggleThemeMode: () => void;
  addXpAndRegisterActivity: (earnedXp: number, todayIso: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      scriptMode: "dual",
      showVocalizedSerto: true,
      uiLanguage: "nl",
      themeMode: "light",
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDateIso: null,
      dailyGoalXp: 100,
      todayXp: 0,

      setScriptMode: (mode) => set({ scriptMode: mode }),

      cycleScriptMode: () => {
        const order: ScriptDisplayMode[] = ["dual", "serto_only", "latin_only"];
        const nextIndex = (order.indexOf(get().scriptMode) + 1) % order.length;
        set({ scriptMode: order[nextIndex] });
      },

      toggleVocalizedSerto: () =>
        set((state) => ({ showVocalizedSerto: !state.showVocalizedSerto })),

      setUiLanguage: (lang) => set({ uiLanguage: lang }),

      toggleThemeMode: () =>
        set((state) => ({
          themeMode: state.themeMode === "light" ? "dark" : "light",
        })),

      addXpAndRegisterActivity: (earnedXp, todayIso) => {
        const state = get();
        const isSameDay = state.lastActiveDateIso === todayIso;

        // Controleer of gisteren actief was voor streak-continuïteit
        let nextStreak = state.currentStreak;
        if (!isSameDay) {
          if (state.lastActiveDateIso) {
            const lastDate = new Date(state.lastActiveDateIso);
            const currDate = new Date(todayIso);
            const diffDays = Math.round(
              (currDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            nextStreak = diffDays === 1 ? state.currentStreak + 1 : 1;
          } else {
            nextStreak = 1;
          }
        }

        set({
          totalXp: state.totalXp + earnedXp,
          todayXp: isSameDay ? state.todayXp + earnedXp : earnedXp,
          currentStreak: nextStreak,
          longestStreak: Math.max(state.longestStreak, nextStreak),
          lastActiveDateIso: todayIso,
        });
      },
    }),
    {
      name: "surayt-app-store-v1",
      storage: createJSONStorage(() => mmkvStorageAdapter),
    }
  )
);
