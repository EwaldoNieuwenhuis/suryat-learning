import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSuryoyeTheme } from "../../theme/colors";
import { DualScriptText } from "../typography/DualScriptText";

export interface QantreCardProps {
  /** Optionele Nederlandse of categorie-titel bovenin de boog */
  title?: string;
  /** Optionele Surayt titel in Serto */
  titleSerto?: string;
  /** Optionele Surayt titel in Latijn */
  titleLatin?: string;
  /** Badge rechtsboven (bijv. 'A1', 'Midyat', of '+15 XP') */
  badgeText?: string;
  badgeVariant?: "gold" | "crimson" | "olive" | "terracotta";
  /** Toon de karakteristieke Tur Abdin stenen boog (Qanṭro) bovenin de kaart */
  showArchHeader?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const QantreCard: React.FC<QantreCardProps> = ({
  title,
  titleSerto,
  titleLatin,
  badgeText,
  badgeVariant = "gold",
  showArchHeader = true,
  onPress,
  style,
  children,
}) => {
  const theme = useSuryoyeTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getBadgeColors = () => {
    switch (badgeVariant) {
      case "crimson":
        return { bg: theme.primarySoft, text: theme.primary, border: theme.primary };
      case "olive":
        return { bg: theme.oliveSoft, text: theme.olive, border: theme.olive };
      case "terracotta":
        return { bg: theme.terracottaSoft, text: theme.terracotta, border: theme.terracotta };
      case "gold":
      default:
        return { bg: theme.goldSoft, text: theme.saffron, border: theme.gold };
    }
  };

  const badgeColors = getBadgeColors();

  const cardBody = (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {/* Subtiele Qanṭro (Tur Abdin Boog) SVG Watermerk/Header */}
      {showArchHeader && (
        <View style={styles.archWrapper} pointerEvents="none">
          <Svg width="100%" height={34} viewBox="0 0 360 34" preserveAspectRatio="none">
            <Path
              d="M 0,32 Q 180,-12 360,32"
              fill="none"
              stroke={theme.archStroke}
              strokeWidth={1.4}
              strokeDasharray="4,3"
              opacity={0.65}
            />
            <Path
              d="M 24,34 Q 180,0 336,34"
              fill="none"
              stroke={theme.gold}
              strokeWidth={1}
              opacity={0.4}
            />
            <Circle cx={180} cy={9} r={3} fill={theme.gold} opacity={0.75} />
          </Svg>
        </View>
      )}

      {/* Header rij indien titel of badge is opgegeven */}
      {(title || titleSerto || badgeText) && (
        <View style={styles.headerRow}>
          <View style={styles.titleColumn}>
            {title && (
              <Text
                style={[
                  styles.kickerTitle,
                  { color: theme.textSecondary },
                ]}
              >
                {title.toUpperCase()}
              </Text>
            )}
            {(titleSerto || titleLatin) && (
              <DualScriptText
                serto={titleSerto}
                latin={titleLatin}
                variant="lg"
                bold
              />
            )}
          </View>

          {badgeText && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: badgeColors.bg,
                  borderColor: badgeColors.border,
                },
              ]}
            >
              <Text style={[styles.badgeLabel, { color: badgeColors.text }]}>
                {badgeText}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Inhoud van de kaart */}
      <View style={styles.contentArea}>{children}</View>
    </View>
  );

  if (!onPress) {
    return cardBody;
  }

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.975, { damping: 16, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 260 });
      }}
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={animatedStyle}
    >
      {cardBody}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 18,
    borderWidth: 1.2,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    marginBottom: 14,
    elevation: 2,
  },
  archWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 34,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 6,
    marginBottom: 10,
  },
  titleColumn: {
    flex: 1,
    paddingRight: 8,
  },
  kickerTitle: {
    fontFamily: "NotoSans-Bold",
    fontSize: 11,
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeLabel: {
    fontFamily: "NotoSans-Bold",
    fontSize: 12,
  },
  contentArea: {
    marginTop: 2,
  },
});
