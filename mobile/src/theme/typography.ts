import { TextStyle } from "react-native";

export const SURAYT_FONTS = {
  latinRegular: "NotoSans-Regular",
  latinBold: "NotoSans-Bold",
  sertoRegular: "NotoSansSyriacWestern-Regular",
  sertoBold: "NotoSansSyriacWestern-Bold",
} as const;

export const SERTO_FONT_SCALE = 1.25;       // +25% fontSize verhoging voor Serto
export const SERTO_LINE_HEIGHT_SCALE = 1.35; // +35% extra lineHeight ruimte voor Zow'e klinkerpunten

export type TypographyVariant = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "hero";

export const BASE_LATIN_SIZES: Record<TypographyVariant, { fontSize: number; lineHeight: number }> = {
  xs: { fontSize: 12, lineHeight: 17 },
  sm: { fontSize: 14, lineHeight: 20 },
  md: { fontSize: 16, lineHeight: 23 },
  lg: { fontSize: 19, lineHeight: 27 },
  xl: { fontSize: 22, lineHeight: 31 },
  "2xl": { fontSize: 27, lineHeight: 37 },
  hero: { fontSize: 34, lineHeight: 46 },
};

const SYRIAC_UNICODE_REGEX = /[\u0700-\u074F]/;

/**
 * Detecteert of een string West-Syrische (Serto) Unicode-karakters bevat.
 */
export function containsSyriacScript(text?: string | null): boolean {
  if (!text) return false;
  return SYRIAC_UNICODE_REGEX.test(text);
}

/**
 * Genereert de exacte Android-veilige TextStyle voor West-Syrisch (Serto) schrift
 * met 25% grotere fontSize en 35% verhoogde lineHeight.
 */
export function getSertoTextStyle(
  variant: TypographyVariant = "md",
  bold = false
): TextStyle {
  const base = BASE_LATIN_SIZES[variant];
  const scaledFontSize = Math.round(base.fontSize * SERTO_FONT_SCALE);
  // Verhoog de lineHeight met 35% bovenop de geschaalde Serto-grootte zodat Zow'e nooit clippen
  const scaledLineHeight = Math.round(scaledFontSize * SERTO_LINE_HEIGHT_SCALE);

  return {
    fontFamily: bold ? SURAYT_FONTS.sertoBold : SURAYT_FONTS.sertoRegular,
    fontSize: scaledFontSize,
    lineHeight: scaledLineHeight,
    writingDirection: "rtl",
    includeFontPadding: true,
    paddingTop: 2,
    paddingBottom: 2,
  };
}

/**
 * Genereert de TextStyle voor Latijnse Surayt-transliteratie (inclusief š, ḥ, ṭ, ṣ, ḏ, ṯ).
 */
export function getLatinTextStyle(
  variant: TypographyVariant = "md",
  bold = false
): TextStyle {
  const base = BASE_LATIN_SIZES[variant];
  return {
    fontFamily: bold ? SURAYT_FONTS.latinBold : SURAYT_FONTS.latinRegular,
    fontSize: base.fontSize,
    lineHeight: base.lineHeight,
    writingDirection: "ltr",
  };
}
