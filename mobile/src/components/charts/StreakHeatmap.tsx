import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { HeatmapDayCell } from "../../db/queries/analytics";
import { useSuryoyeTheme } from "../../theme/colors";

interface StreakHeatmapProps {
  cells: HeatmapDayCell[];
}

const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export const StreakHeatmap: React.FC<StreakHeatmapProps> = ({ cells }) => {
  const theme = useSuryoyeTheme();
  const [selectedCell, setSelectedCell] = useState<HeatmapDayCell | null>(
    cells.length > 0 ? cells[cells.length - 1] : null
  );

  // Groepeer de dagen in kolommen van 7 dagen (weken)
  const weeks = useMemo(() => {
    const grouped: HeatmapDayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      grouped.push(cells.slice(i, i + 7));
    }
    return grouped;
  }, [cells]);

  const getIntensityColor = (intensity: 0 | 1 | 2 | 3 | 4): string => {
    if (intensity === 0) {
      return theme.isDark ? "#2C2722" : "#E5DAC6";
    }
    if (intensity === 1) return "#E6C875"; // Licht saffraan
    if (intensity === 2) return "#D4AF37"; // Suryoye Oudgoud
    if (intensity === 3) return "#B54832"; // Warm Terracotta-Rood
    return "#8C1D24";                      // Manuscript Karmozijnrood (Top-activiteit)
  };

  return (
    <View>
      <View style={styles.matrixRow}>
        {/* Weekdag-labels links */}
        <View style={styles.weekdayColumn}>
          {WEEKDAY_LABELS.map((day, idx) => (
            <Text
              key={day}
              style={[
                styles.weekdayText,
                {
                  color: theme.textMuted,
                  opacity: idx % 2 === 0 ? 1 : 0.45,
                },
              ]}
            >
              {day}
            </Text>
          ))}
        </View>

        {/* Scrollbare weekkolommen */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gridContainer}
        >
          {weeks.map((week, wIdx) => (
            <View key={`week-${wIdx}`} style={styles.weekColumn}>
              {week.map((cell) => {
                const isSelected = selectedCell?.dateIso === cell.dateIso;
                return (
                  <Pressable
                    key={cell.dateIso}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      setSelectedCell(cell);
                    }}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: getIntensityColor(cell.intensity),
                        borderColor: isSelected ? theme.textPrimary : "transparent",
                        borderWidth: isSelected ? 1.5 : 0,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Legenda + Geselecteerde dag-detail */}
      <View style={[styles.footerRow, { borderTopColor: theme.border }]}>
        {selectedCell ? (
          <Text style={[styles.selectedInfo, { color: theme.textSecondary }]}>
            <Text style={{ fontFamily: "NotoSans-Bold", color: theme.textPrimary }}>
              {selectedCell.dateIso}:
            </Text>{" "}
            {selectedCell.reviewsCompleted} reviews •{" "}
            {Math.max(1, Math.round(selectedCell.studySeconds / 60))} min •{" "}
            {selectedCell.xpEarned} XP
          </Text>
        ) : (
          <Text style={[styles.selectedInfo, { color: theme.textMuted }]}>
            Tik op een dag voor details
          </Text>
        )}

        <View style={styles.legendRow}>
          <Text style={[styles.legendLabel, { color: theme.textMuted }]}>Minder</Text>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <View
              key={lvl}
              style={[
                styles.legendBox,
                { backgroundColor: getIntensityColor(lvl) },
              ]}
            />
          ))}
          <Text style={[styles.legendLabel, { color: theme.textMuted }]}>Meer</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  matrixRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  weekdayColumn: {
    marginRight: 8,
    justifyContent: "space-between",
    height: 7 * 16,
    paddingVertical: 1,
  },
  weekdayText: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    lineHeight: 14,
  },
  gridContainer: {
    paddingVertical: 2,
  },
  weekColumn: {
    marginRight: 4,
    justifyContent: "flex-start",
  },
  dayCell: {
    width: 13,
    height: 13,
    borderRadius: 3.5,
    marginBottom: 3,
  },
  footerRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  selectedInfo: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    marginHorizontal: 2,
  },
});
