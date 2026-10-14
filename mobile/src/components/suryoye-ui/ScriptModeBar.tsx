import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Moon, Sun, Sparkles } from "lucide-react-native";
import { useSuryoyeTheme } from "../../theme/colors";
import { ScriptDisplayMode, useAppStore } from "../../store/useAppStore";

const MODE_LABELS: Record<ScriptDisplayMode, { label: string; sertoSample: string }> = {
  dual: { label: "Serto + Latijn", sertoSample: "ܣܘܪܝܬ" },
  serto_only: { label: "Alleen Serto", sertoSample: "ܣܘܪܝoyo" },
  latin_only: { label: "Alleen Latijn", sertoSample: "Abc" },
};

export const ScriptModeBar: React.FC = () => {
  const theme = useSuryoyeTheme();
  const scriptMode = useAppStore((s) => s.scriptMode);
  const showVocalizedSerto = useAppStore((s) => s.showVocalizedSerto);
  const cycleScriptMode = useAppStore((s) => s.cycleScriptMode);
  const toggleVocalizedSerto = useAppStore((s) => s.toggleVocalizedSerto);
  const toggleThemeMode = useAppStore((s) => s.toggleThemeMode);

  return (
    <View
      style={[
        styles.barContainer,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {/* 1. Knop om te wisselen tussen Dual / Alleen Serto / Alleen Latijn */}
      <Pressable
        onPress={async () => {
          await Haptics.selectionAsync();
          cycleScriptMode();
        }}
        style={[
          styles.pillButton,
          { backgroundColor: theme.primarySoft, borderColor: theme.primary },
        ]}
      >
        <Text style={[styles.pillTitle, { color: theme.primary }]}>
          Schrift: {MODE_LABELS[scriptMode].label}
        </Text>
      </Pressable>

      {/* 2. Knop om Zow'e (Syrische klinkerpunten) aan/uit te zetten */}
      {scriptMode !== "latin_only" && (
        <Pressable
          onPress={async () => {
            await Haptics.selectionAsync();
            toggleVocalizedSerto();
          }}
          style={[
            styles.pillButton,
            {
              backgroundColor: showVocalizedSerto ? theme.goldSoft : "transparent",
              borderColor: showVocalizedSerto ? theme.gold : theme.border,
            },
          ]}
        >
          <Sparkles size={13} color={showVocalizedSerto ? theme.saffron : theme.textMuted} />
          <Text
            style={[
              styles.pillTitle,
              {
                color: showVocalizedSerto ? theme.textPrimary : theme.textMuted,
                marginLeft: 4,
              },
            ]}
          >
            Zow'e {showVocalizedSerto ? "Aan" : "Uit"}
          </Text>
        </Pressable>
      )}

      {/* 3. Light / Dark (Midyat Kalksteen vs. Basalt) Toggle */}
      <Pressable
        onPress={async () => {
          await Haptics.selectionAsync();
          toggleThemeMode();
        }}
        style={[
          styles.iconButton,
          { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
        ]}
      >
        {theme.isDark ? (
          <Sun size={16} color={theme.gold} />
        ) : (
          <Moon size={16} color={theme.textSecondary} />
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillTitle: {
    fontFamily: "NotoSans-Bold",
    fontSize: 12,
  },
  iconButton: {
    padding: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
});
