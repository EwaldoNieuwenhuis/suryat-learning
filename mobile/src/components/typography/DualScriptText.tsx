import React, { useState } from "react";
import {
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  containsSyriacScript,
  getLatinTextStyle,
  getSertoTextStyle,
  TypographyVariant,
} from "../../theme/typography";
import { useSuryoyeTheme } from "../../theme/colors";
import { ScriptDisplayMode, useAppStore } from "../../store/useAppStore";

export interface DualScriptTextProps {
  /** Gevocaliseerde West-Syrische (Serto) string (met Zow'e klinkerpunten) */
  serto?: string | null;
  /** Optionele ongevocaliseerde Serto string (zonder Zow'e, voor gevorderde modus) */
  sertoUnvocalized?: string | null;
  /** Latijnse fonetische Surayt-transliteratie (bijv. 'šlomo', 'kṯowo') */
  latin?: string | null;
  /** Enkele string voor automatische RTL/Serto vs. Latijn detectie */
  text?: string | null;
  /** Typografische schaal ('xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero') */
  variant?: TypographyVariant;
  /** Subtitel-grootte voor de Latijnse ondertiteling in 'dual' modus */
  subtitleVariant?: TypographyVariant;
  bold?: boolean;
  color?: string;
  subtitleColor?: string;
  align?: "auto" | "left" | "right" | "center";
  /** Overschrijf de globale scriptMode voor specifieke oefeningen */
  forceMode?: ScriptDisplayMode;
  /** Sta toe dat de gebruiker op de tekst tikt om tussen Serto / Dual / Latijn te wisselen */
  interactiveToggle?: boolean;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

const SUBTITLE_VARIANT_MAP: Record<TypographyVariant, TypographyVariant> = {
  xs: "xs",
  sm: "xs",
  md: "sm",
  lg: "md",
  xl: "md",
  "2xl": "lg",
  hero: "xl",
};

export const DualScriptText: React.FC<DualScriptTextProps> = ({
  serto,
  sertoUnvocalized,
  latin,
  text,
  variant = "md",
  subtitleVariant,
  bold = false,
  color,
  subtitleColor,
  align = "auto",
  forceMode,
  interactiveToggle = false,
  style,
  containerStyle,
}) => {
  const theme = useSuryoyeTheme();
  const globalScriptMode = useAppStore((s) => s.scriptMode);
  const showVocalizedSerto = useAppStore((s) => s.showVocalizedSerto);
  const [localOverrideMode, setLocalOverrideMode] = useState<ScriptDisplayMode | null>(null);

  const activeMode = forceMode ?? localOverrideMode ?? globalScriptMode;

  // Geval 1: Enkele 'text' prop meegegeven -> Automatische Unicode-detectie
  if (text !== undefined && text !== null && !serto && !latin) {
    const isSyriac = containsSyriacScript(text);
    const baseStyle = isSyriac
      ? getSertoTextStyle(variant, bold)
      : getLatinTextStyle(variant, bold);

    return (
      <Text
        style={[
          baseStyle,
          {
            color: color ?? theme.textPrimary,
            textAlign:
              align === "auto" ? (isSyriac ? "right" : "left") : align,
          },
          style,
        ]}
      >
        {text}
      </Text>
    );
  }

  // Geval 2: Dual-Script (Serto + Latijn) modus
  const effectiveSerto =
    !showVocalizedSerto && sertoUnvocalized ? sertoUnvocalized : serto;

  const sertoStyle = getSertoTextStyle(variant, bold);
  const latPrimaryStyle = getLatinTextStyle(variant, bold);
  const latSubVariant = subtitleVariant ?? SUBTITLE_VARIANT_MAP[variant];
  const latSubStyle = getLatinTextStyle(latSubVariant, false);

  const handlePress = async () => {
    if (!interactiveToggle) return;
    await Haptics.selectionAsync();
    const order: ScriptDisplayMode[] = ["dual", "serto_only", "latin_only"];
    const nextIdx = (order.indexOf(activeMode) + 1) % order.length;
    setLocalOverrideMode(order[nextIdx]);
  };

  const renderContent = () => {
    if (activeMode === "serto_only" && effectiveSerto) {
      return (
        <Text
          style={[
            sertoStyle,
            {
              color: color ?? theme.textPrimary,
              textAlign: align === "auto" ? "right" : align,
            },
            style,
          ]}
        >
          {effectiveSerto}
        </Text>
      );
    }

    if (activeMode === "latin_only" && latin) {
      return (
        <Text
          style={[
            latPrimaryStyle,
            {
              color: color ?? theme.textPrimary,
              textAlign: align === "auto" ? "left" : align,
            },
            style,
          ]}
        >
          {latin}
        </Text>
      );
    }

    // Standaard: 'dual' (Serto prominent + Latijnse fonetische ondertiteling)
    return (
      <View
        style={[
          {
            alignItems:
              align === "center"
                ? "center"
                : align === "right"
                ? "flex-end"
                : "flex-start",
          },
          containerStyle,
        ]}
      >
        {effectiveSerto ? (
          <Text
            style={[
              sertoStyle,
              {
                color: color ?? theme.textPrimary,
                textAlign: align === "center" ? "center" : "right",
              },
              style,
            ]}
          >
            {effectiveSerto}
          </Text>
        ) : null}

        {latin ? (
          <Text
            style={[
              latSubStyle,
              {
                color: subtitleColor ?? theme.textSecondary,
                marginTop: 2,
                textAlign: align === "center" ? "center" : "left",
              },
            ]}
          >
            {latin}
          </Text>
        ) : null}
      </View>
    );
  };

  if (!interactiveToggle) {
    return renderContent();
  }

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      {renderContent()}
    </Pressable>
  );
};
