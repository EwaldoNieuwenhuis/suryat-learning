import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  AlertTriangle,
  Flame,
  Trophy,
  Volume2,
  Play,
} from "lucide-react-native";
import { useSuryoyeTheme } from "../../theme/colors";
import { useAppStore } from "../../store/useAppStore";
import {
  getFourPillarSkillMatrix,
  getStruggleWords,
  getVocabularyBreakdown,
  getYearlyActivityHeatmap,
  HeatmapDayCell,
  SkillMatrixScores,
  StruggleWordItem,
  VocabularyBreakdown,
} from "../../db/queries/analytics";
import { suraytAudio } from "../../engine/audio";
import { QantreCard } from "../../components/suryoye-ui/QantreCard";
import { DualScriptText } from "../../components/typography/DualScriptText";
import { StreakHeatmap } from "../../components/charts/StreakHeatmap";
import { MasteryRadarChart } from "../../components/charts/MasteryRadarChart";
import { RetentionGraph } from "../../components/charts/RetentionGraph";

export default function StatsAnalyticsScreen() {
  const theme = useSuryoyeTheme();
  const router = useRouter();

  const currentStreak = useAppStore((s) => s.currentStreak);
  const longestStreak = useAppStore((s) => s.longestStreak);
  const totalXp = useAppStore((s) => s.totalXp);

  const [skillScores, setSkillScores] = useState<SkillMatrixScores>({
    serto_reading: 15,
    listening: 15,
    vocabulary: 15,
    grammar_roots: 15,
  });
  const [heatmapCells, setHeatmapCells] = useState<HeatmapDayCell[]>([]);
  const [breakdown, setBreakdown] = useState<VocabularyBreakdown>({
    total: 1345,
    newCount: 1345,
    learningCount: 0,
    reviewCount: 0,
    masteredCount: 0,
    dueNowCount: 0,
    avgFluencyMs: 0,
  });
  const [struggleWords, setStruggleWords] = useState<StruggleWordItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setSkillScores(getFourPillarSkillMatrix());
      setHeatmapCells(getYearlyActivityHeatmap(140));
      setBreakdown(getVocabularyBreakdown());
      setStruggleWords(getStruggleWords(8));
    }, [])
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.kicker, { color: theme.textSecondary }]}>
          PRESTATIES & FSRS TELEMETRIE
        </Text>
        <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
          Meenschap & Analytics
        </Text>

        {/* Top KPI Tegels */}
        <View style={styles.kpiRow}>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
          >
            <Flame size={20} color={theme.saffron} />
            <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
              {currentStreak}d
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Huidige Streak (Max {longestStreak}d)
            </Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
          >
            <Trophy size={20} color={theme.gold} />
            <Text style={[styles.kpiValue, { color: theme.textPrimary }]}>
              {totalXp}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
              Totale Ervaring (XP)
            </Text>
          </View>
        </View>

        {/* 1. 4-Pijler Vaardigheidsmatrix (Radar Chart) */}
        <QantreCard
          title="4-Pijler Vaardigheidsmatrix"
          titleSerto="ܡܰܘܕܥܳܢܽܘܬ݂ܐ ܕܝܽܘܠܦܳܢܐ"
          titleLatin="Mawdʻonuṯo d-yulfono"
          badgeText="0-100%"
          badgeVariant="crimson"
        >
          <MasteryRadarChart scores={skillScores} />
        </QantreCard>

        {/* 2. GitHub-stijl Activiteiten Heatmap */}
        <QantreCard
          title="Activiteiten Heatmap"
          titleSerto="ܣܽܘܪܓܳܕ݂ܐ ܕܝܰܘܡܳܬ݂̈ܐ"
          titleLatin="Surgodo d-yawmoṯe"
          badgeText="Dagelijks Ritme"
          badgeVariant="gold"
        >
          <StreakHeatmap cells={heatmapCells} />
        </QantreCard>

        {/* 3. Woordenschat Breakdown & Fluency */}
        <QantreCard
          title="Woordenschat Breakdown & Fluency"
          titleSerto="ܟܽܘܢܳܫ ܡܶܠ̈ܶܐ"
          titleLatin="Kunoš mele"
          badgeText={`${breakdown.total} Woorden`}
          badgeVariant="olive"
        >
          <RetentionGraph breakdown={breakdown} />
        </QantreCard>

        {/* 4. Struggle Words (Zwakste Woorden met hoogste foutpercentage) */}
        <QantreCard
          title="Struggle Words Analyse"
          titleSerto="ܡܶܠ̈ܶܐ ܥܰܣܩܳܬ݂̈ܐ"
          titleLatin="Mele ʻasqoṯo"
          badgeText={`${struggleWords.length} Aandachtspunten`}
          badgeVariant="terracotta"
        >
          {struggleWords.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Je hebt nog geen woorden met herhaalde fouten (lapses). Maak een les of SRS-review om je zwakke woorden hier automatisch te analyseren!
            </Text>
          ) : (
            <View>
              <Pressable
                onPress={() => router.push("/(tabs)/review?mode=struggle" as any)}
                style={[
                  styles.practiceStruggleBtn,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Play size={15} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.practiceStruggleBtnText}>
                  Oefen Direct Deze {struggleWords.length} Zwakke Woorden
                </Text>
              </Pressable>

              {struggleWords.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.struggleRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <DualScriptText
                      serto={item.suraytSerto}
                      latin={item.suraytLat}
                      variant="lg"
                      bold
                    />
                    <Text
                      style={[
                        styles.struggleTrans,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {item.translationNl}
                      {item.rootRadicals ? ` • Wortel: ${item.rootRadicals}` : ""}
                    </Text>
                  </View>

                  <View style={styles.struggleMetrics}>
                    <View
                      style={[
                        styles.errorBadge,
                        { backgroundColor: theme.primarySoft },
                      ]}
                    >
                      <AlertTriangle size={12} color={theme.primary} />
                      <Text
                        style={[styles.errorBadgeText, { color: theme.primary }]}
                      >
                        {item.errorRatePercent}% fout ({item.lapses}x)
                      </Text>
                    </View>
                    <Text style={[styles.msText, { color: theme.textMuted }]}>
                      Gem. {item.avgResponseMs} ms
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => suraytAudio.playPronunciation(item.id)}
                    style={[
                      styles.smallAudioBtn,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Volume2 size={16} color={theme.primary} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </QantreCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },
  kicker: {
    fontFamily: "NotoSans-Bold",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  screenTitle: {
    fontFamily: "NotoSans-Bold",
    fontSize: 22,
    marginTop: 2,
    marginBottom: 14,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  kpiValue: {
    fontFamily: "NotoSans-Bold",
    fontSize: 22,
    marginTop: 6,
  },
  kpiLabel: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  practiceStruggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  practiceStruggleBtnText: {
    fontFamily: "NotoSans-Bold",
    color: "#FFFFFF",
    fontSize: 13,
  },
  struggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  struggleTrans: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  struggleMetrics: {
    alignItems: "flex-end",
  },
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  errorBadgeText: {
    fontFamily: "NotoSans-Bold",
    fontSize: 11,
  },
  msText: {
    fontFamily: "NotoSans-Regular",
    fontSize: 10,
    marginTop: 3,
  },
  smallAudioBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
