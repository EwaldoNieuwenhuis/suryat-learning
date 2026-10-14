import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import Svg, { Path, Circle, G, Line, Polygon } from "react-native-svg";
import { useSuryoyeTheme } from "../../theme/colors";

interface SyriacBorderProps {
  color?: string;
  accentColor?: string;
  width?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Decoratieve horizontale scheidingslijn met de 8-puntige Suryoye/Mesopotamische ster
 * en manuscript-kalligrafie-uitlopers.
 */
export const SyriacBorder: React.FC<SyriacBorderProps> = ({
  color,
  accentColor,
  width = 280,
  style,
}) => {
  const theme = useSuryoyeTheme();
  const strokeColor = color ?? theme.archStroke;
  const starColor = accentColor ?? theme.gold;
  const center = width / 2;

  return (
    <View style={[{ alignItems: "center", marginVertical: 8 }, style]}>
      <Svg width={width} height={24} viewBox={`0 0 ${width} 24`}>
        {/* Linker en rechter getrapte manuscript-lijnen */}
        <Line
          x1={8}
          y1={12}
          x2={center - 28}
          y2={12}
          stroke={strokeColor}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Line
          x1={center + 28}
          y1={12}
          x2={width - 8}
          y2={12}
          stroke={strokeColor}
          strokeWidth={1.2}
          strokeLinecap="round"
        />

        {/* Zij-diamantjes (Mor Gabriel kalksteen-motief) */}
        <Polygon
          points={`${center - 22},12 ${center - 17},8 ${center - 12},12 ${center - 17},16`}
          fill={theme.primary}
          opacity={0.85}
        />
        <Polygon
          points={`${center + 22},12 ${center + 17},8 ${center + 12},12 ${center + 17},16`}
          fill={theme.primary}
          opacity={0.85}
        />

        {/* Centrale 8-puntige Suryoye Zon/Ster */}
        <G transform={`translate(${center}, 12)`}>
          <Path
            d="M0,-10 L2.5,-3 L9.5,-3 L4,1.5 L6,8.5 L0,4 L-6,8.5 L-4,1.5 L-9.5,-3 L-2.5,-3 Z"
            fill={starColor}
          />
          <Circle cx={0} cy={0} r={2.2} fill={theme.primary} />
        </G>
      </Svg>
    </View>
  );
};
