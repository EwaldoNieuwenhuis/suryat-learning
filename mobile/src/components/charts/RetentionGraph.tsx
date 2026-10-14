import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Zap } from "lucide-react-native";
import { VocabularyBreakdown } from "../../db/queries/analytics";
import { useSuryoyeTheme } from "../../theme/colors";

interface RetentionGraphProps {
  breakdown: VocabularyBreakdown;
}

export const RetentionGraph: React.FC<RetentionGraphProps> = ({ breakdown }) => {
  const theme = useSuryoyeTheme();
  const total = Math.max(1, breakdown.total);

  const segments = [
    {
      key: "mastered",
      label: "Beheerst (Mastered)",
      count: breakdown.masteredCount,
      color: theme.success,
    },
    {
      key: "review",
      label: "Actieve Review",
      count: breakdown.reviewCount,
      color: theme.gold,
    },
    {
      key: "learning",
      label: "Aan het leren",
      count: breakdown.learningCount,
      color: theme.terracotta,
    },
    {
      key: "new",
      label: "Nieuw in Corpus",
      count: breakdown.newCount,
      color: theme.isDark ? "#3A342D" : "#D8CCB8",
    },
  ];

  const fluencyLabel =
    breakdown.avgFluencyMs === 0
      ? "Nog geen meting"
      : breakdown.avgFluencyMs <= 2400
      ? `Vloeiend (${breakdown.avgFluencyMs} ms)`
      : breakdown.avgFluencyMs <= 5000
      ? `Goed (${breakdown.avgFluencyMs} ms)`
      : `Ontcijferend (${breakdown.avgFluencyMs} ms)`;

  return (
    <View>
      {/* Gestapelde voortgangsbalk */}
      <View style={[styles.barTrack, { backgroundColor: theme.surface }]}>
        {segments.map((seg) => {
          const widthPct = (seg.count / total) * 100;
          if (widthPct <= 0) return null;
          return (
            <View
              key={seg.key}
              style={{
                width: `${Math.max(1.5, widthPct)}%`,
                backgroundColor: seg.color,
                height: "100%",
              }}
            />
          );
        })}
      </View>

      {/* Uitsplitsing per status */}
      <View style={styles.legendGrid}>
        {segments.map((seg) => (
          <View key={seg.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: seg.color }]} />
            <View>
              <Text style={[styles.legendCount, { color: theme.textPrimary }]}>
                {seg.count}{" "}
                <Text style={[styles.legendPct, { color: theme.textMuted }]}>
                  ({Math.round((seg.count / total) * 100)}%)
                </Text>
              </Text>
              <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>
                {seg.label}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Reactietijd / Fluency Meter */}
      <View
        style={[
          styles.fluencyBanner,
          { backgroundColor: theme.goldSoft, borderColor: theme.gold },
        ]}
      >
        <Zap size={18} color={theme.saffron} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.fluencyTitle, { color: theme.textPrimary }]}>
            Herkenningssnelheid (Fluency): {fluencyLabel}
          </Text>
          <Text style={[styles.fluencySub, { color: theme.textSecondary }]}>
            Gemiddelde reactietijd op Serto- en luistervragen. Onder 2.400 ms geeft extra FSRS-stabiliteit.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barTrack: {
    height: 16,
    borderRadius: 999,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 14,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  legendItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendCount: {
    fontFamily: "NotoSans-Bold",
    fontSize: 14,
  },
  legendPct: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
  },
  legendLabel: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
  },
  fluencyBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  fluencyTitle: {
    fontFamily: "NotoSans-Bold",
    fontSize: 13,
  },
  fluencySub: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    marginTop: 2,
  },
});
