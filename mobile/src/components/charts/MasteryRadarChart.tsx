import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { SkillMatrixScores } from "../../db/queries/analytics";
import { useSuryoyeTheme } from "../../theme/colors";

interface MasteryRadarChartProps {
  scores: SkillMatrixScores;
  size?: number;
}

const AXES: {
  key: keyof SkillMatrixScores;
  labelNl: string;
  labelSerto: string;
  angleDeg: number;
}[] = [
  { key: "serto_reading", labelNl: "Serto Lezen", labelSerto: "ܩܪܳܝܐ", angleDeg: -90 },
  { key: "listening", labelNl: "Luisteren", labelSerto: "ܫܡܳܥܐ", angleDeg: 0 },
  { key: "vocabulary", labelNl: "Woordenschat", labelSerto: "ܡܶܠ̈ܶܐ", angleDeg: 90 },
  { key: "grammar_roots", labelNl: "Wortels (k-ṯ-w)", labelSerto: "ܫܶܪܫ̈ܶܐ", angleDeg: 180 },
];

export const MasteryRadarChart: React.FC<MasteryRadarChartProps> = ({
  scores,
  size = 250,
}) => {
  const theme = useSuryoyeTheme();
  const center = size / 2;
  const maxRadius = size * 0.34;
  const rings = [0.25, 0.5, 0.75, 1.0];

  const polarToCartesian = (angleDeg: number, radius: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(angleRad),
      y: center + radius * Math.sin(angleRad),
    };
  };

  // Bereken de hoekpunten van de speler-polygoon
  const dataPoints = AXES.map((axis) => {
    const val = Math.max(8, Math.min(100, scores[axis.key] ?? 15));
    const r = (val / 100) * maxRadius;
    return {
      ...axis,
      value: val,
      ...polarToCartesian(axis.angleDeg, r),
    };
  });

  const polygonPointsString = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Concentrische achtergrond-ringen (25%, 50%, 75%, 100%) */}
        {rings.map((ratio) => {
          const r = maxRadius * ratio;
          const ringPoints = AXES.map((a) => {
            const pt = polarToCartesian(a.angleDeg, r);
            return `${pt.x},${pt.y}`;
          }).join(" ");
          return (
            <Polygon
              key={`ring-${ratio}`}
              points={ringPoints}
              fill="none"
              stroke={theme.border}
              strokeWidth={1}
              strokeDasharray={ratio < 1 ? "3,3" : undefined}
            />
          );
        })}

        {/* As-lijnen vanuit het midden */}
        {AXES.map((axis) => {
          const outer = polarToCartesian(axis.angleDeg, maxRadius);
          return (
            <Line
              key={`axis-${axis.key}`}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke={theme.archStroke}
              strokeWidth={1}
            />
          );
        })}

        {/* Gevulde vaardigheidspolygoon */}
        <Polygon
          points={polygonPointsString}
          fill={theme.primary}
          fillOpacity={0.24}
          stroke={theme.primary}
          strokeWidth={2.4}
        />

        {/* Gouden knooppunten op elke as */}
        {dataPoints.map((pt) => (
          <Circle
            key={`node-${pt.key}`}
            cx={pt.x}
            cy={pt.y}
            r={4.5}
            fill={theme.gold}
            stroke={theme.primary}
            strokeWidth={1.8}
          />
        ))}

        {/* Labels buiten de ringen */}
        {dataPoints.map((pt) => {
          const labelPos = polarToCartesian(pt.angleDeg, maxRadius + 28);
          return (
            <SvgText
              key={`lbl-${pt.key}`}
              x={labelPos.x}
              y={labelPos.y}
              fill={theme.textPrimary}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {`${pt.labelNl} (${pt.value}%)`}
            </SvgText>
          );
        })}
      </Svg>

      {/* Compacte 4-koloms samenvatting onder de radar */}
      <View style={styles.pillarsRow}>
        {dataPoints.map((pt) => (
          <View
            key={`pill-${pt.key}`}
            style={[
              styles.pillarBadge,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.pillarSerto, { color: theme.primary }]}>
              {pt.labelSerto}
            </Text>
            <Text style={[styles.pillarScore, { color: theme.textPrimary }]}>
              {pt.value}%
            </Text>
            <Text style={[styles.pillarTitle, { color: theme.textSecondary }]}>
              {pt.labelNl}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  pillarsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 6,
    gap: 6,
  },
  pillarBadge: {
    flex: 1,
    minWidth: "22%",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillarSerto: {
    fontFamily: "NotoSansSyriacWestern-Bold",
    fontSize: 18,
    lineHeight: 25,
  },
  pillarScore: {
    fontFamily: "NotoSans-Bold",
    fontSize: 14,
    marginTop: 2,
  },
  pillarTitle: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    textAlign: "center",
  },
});
