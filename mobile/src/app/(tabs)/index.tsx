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
  Flame,
  Sparkles,
  Volume2,
  ArrowRight,
  Layers,
  Award,
} from "lucide-react-native";
import { useSuryoyeTheme } from "../../theme/colors";
import { useAppStore } from "../../store/useAppStore";
import { getRankForXp } from "../../engine/tracker";
import {
  getAllLessonsWithProgress,
  LessonWithProgress,
} from "../../db/queries/lessons";
import {
  getVocabularyBreakdown,
  VocabularyBreakdown,
} from "../../db/queries/analytics";
import { getRawSqlite } from "../../db/client";
import { WordRow } from "../../db/schema";
import { suraytAudio } from "../../engine/audio";
import { DualScriptText } from "../../components/typography/DualScriptText";
import { QantreCard } from "../../components/suryoye-ui/QantreCard";
import { SyriacBorder } from "../../components/suryoye-ui/SyriacBorder";
import { ScriptModeBar } from "../../components/suryoye-ui/ScriptModeBar";

function getTimeBasedSuraytGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      serto: "ܒܪܺܝܟ݂ ܨܰܦܪܐ",
      latin: "Brix ṣafro",
      nl: "Goedemorgen in Tur Abdin",
    };
  }
  if (hour >= 18 || hour < 5) {
    return {
      serto: "ܒܪܺܝܟ݂ ܪܰܡܫܐ",
      latin: "Brix ramšo",
      nl: "Goedenavond in Tur Abdin",
    };
  }
  return {
    serto: "ܫܠܳܡܐ ܥܰܠܽܘܟ݂",
    latin: "Šlomo ʻalux",
    nl: "Welkom terug",
  };
}

export default function DashboardScreen() {
  const theme = useSuryoyeTheme();
  const router = useRouter();

  const totalXp = useAppStore((s) => s.totalXp);
  const todayXp = useAppStore((s) => s.todayXp);
  const dailyGoalXp = useAppStore((s) => s.dailyGoalXp);
  const currentStreak = useAppStore((s) => s.currentStreak);

  const [nextLesson, setNextLesson] = useState<LessonWithProgress | null>(null);
  const [breakdown, setBreakdown] = useState<VocabularyBreakdown | null>(null);
  const [wordOfTheDay, setWordOfTheDay] = useState<WordRow | null>(null);

  const rank = getRankForXp(totalXp);
  const greeting = getTimeBasedSuraytGreeting();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const allLessons = await getAllLessonsWithProgress();
        const vocStats = getVocabularyBreakdown();

        // Kies de eerste les die nog niet 100% voltooid is
        const recommended =
          allLessons.find((l) => l.progressPercent < 100) ?? allLessons[0] ?? null;

        // Kies een deterministisch 'Woord van de Dag' uit de database
        const rawDb = getRawSqlite();
        const daySeed = new Date().getDate() + new Date().getMonth() * 31;
        const wotdRow = rawDb.getFirstSync<any>(
          `SELECT * FROM words ORDER BY id LIMIT 1 OFFSET ?`,
          [daySeed % Math.max(1, vocStats.total)]
        );

        if (active) {
          setNextLesson(recommended);
          setBreakdown(vocStats);
          if (wotdRow) {
            setWordOfTheDay({
              id: wotdRow.id,
              lessonId: wotdRow.lesson_id,
              suraytLat: wotdRow.surayt_lat,
              suraytLatSearch: wotdRow.surayt_lat_search,
              suraytSerto: wotdRow.surayt_serto,
              suraytSertoUnvocalized: wotdRow.surayt_serto_unvocalized,
              rootRadicals: wotdRow.root_radicals,
              partOfSpeech: wotdRow.part_of_speech,
              gender: wotdRow.gender,
              pluralLat: wotdRow.plural_lat,
              pluralSerto: wotdRow.plural_serto,
              translationNl: wotdRow.translation_nl,
              translationEn: wotdRow.translation_en,
              translationDe: wotdRow.translation_de,
              audioUrl: wotdRow.audio_url,
              audioLocal: wotdRow.audio_local,
              cefrLevel: wotdRow.cefr_level,
              category: wotdRow.category,
            });
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const dailyGoalPct = Math.min(100, Math.round((todayXp / dailyGoalXp) * 100));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Begroeting & Streak teller */}
        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingNl, { color: theme.textSecondary }]}>
              {greeting.nl.toUpperCase()}
            </Text>
            <DualScriptText
              serto={greeting.serto}
              latin={greeting.latin}
              variant="2xl"
              bold
              interactiveToggle
            />
          </View>

          <View
            style={[
              styles.streakBadge,
              { backgroundColor: theme.goldSoft, borderColor: theme.gold },
            ]}
          >
            <Flame size={20} color={theme.saffron} fill={theme.saffron} />
            <Text style={[styles.streakCount, { color: theme.textPrimary }]}>
              {currentStreak}
            </Text>
            <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>
              dagen
            </Text>
          </View>
        </View>

        {/* Globale Schrift & Zow'e Controlebalk */}
        <ScriptModeBar />

        {/* Culturele Suryoye Rang & Dagelijkse XP Missie */}
        <QantreCard
          title={`Rang Niveau ${rank.level} • ${rank.titleNl}`}
          titleSerto={rank.titleSuraytSerto}
          titleLatin={rank.titleSuraytLat}
          badgeText={`${totalXp} XP`}
          badgeVariant="gold"
        >
          <View style={styles.missionContainer}>
            <View style={styles.missionHeaderRow}>
              <View style={styles.missionTitleWrap}>
                <Award size={16} color={theme.primary} />
                <Text style={[styles.missionTitle, { color: theme.textPrimary }]}>
                  Dagelijkse Missie ({todayXp} / {dailyGoalXp} XP)
                </Text>
              </View>
              <Text style={[styles.missionPct, { color: theme.primary }]}>
                {dailyGoalPct}%
              </Text>
            </View>

            <View style={[styles.progressBarBg, { backgroundColor: theme.surface }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${dailyGoalPct}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>

            {rank.nextRankXp && (
              <Text style={[styles.nextRankHint, { color: theme.textMuted }]}>
                Nog {Math.max(0, rank.nextRankXp - totalXp)} XP tot de volgende titel in Tur Abdin
              </Text>
            )}
          </View>
        </QantreCard>

        {/* Actiekaart 1: Verdergaan met het huidige hoofdstuk */}
        {nextLesson && (
          <QantreCard
            title={`Huidige Bestemming • ${nextLesson.locationTheme}`}
            titleSerto={nextLesson.titleSuraytSerto}
            titleLatin={nextLesson.titleSuraytLat}
            badgeText={nextLesson.cefrLevel}
            badgeVariant="crimson"
            onPress={() => router.push(`/lesson/${nextLesson.id}` as any)}
          >
            <Text style={[styles.lessonTitleNl, { color: theme.textPrimary }]}>
              {nextLesson.titleNl}
            </Text>
            <Text style={[styles.lessonDesc, { color: theme.textSecondary }]}>
              {nextLesson.descriptionNl}
            </Text>

            <View style={styles.lessonActionRow}>
              <Text style={[styles.wordCountMeta, { color: theme.textMuted }]}>
                {nextLesson.learnedWords} / {nextLesson.totalWords} woorden geleerd (
                {nextLesson.progressPercent}%)
              </Text>
              <View style={[styles.ctaButton, { backgroundColor: theme.primary }]}>
                <Text style={styles.ctaButtonText}>Start Les</Text>
                <ArrowRight size={15} color="#FFFFFF" />
              </View>
            </View>
          </QantreCard>
        )}

        {/* Actiekaart 2: Spaced Repetition (SRS) Wachtrij */}
        <QantreCard
          title="Spaced Repetition Geheugen"
          titleSerto="ܬܶܢܳܝܐ ܕܡܶܠ̈ܶܐ"
          titleLatin="Tenoyo d-mele"
          badgeText={
            breakdown && breakdown.dueNowCount > 0
              ? `${breakdown.dueNowCount} klaar`
              : "Bijgewerkt"
          }
          badgeVariant="olive"
          onPress={() => router.push("/(tabs)/review" as any)}
        >
          <View style={styles.srsRow}>
            <Layers size={22} color={theme.olive} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.srsText, { color: theme.textPrimary }]}>
                {breakdown && breakdown.dueNowCount > 0
                  ? `Er staan ${breakdown.dueNowCount} woorden klaar voor herhaling.`
                  : "Start een verse sessie met nieuwe woorden uit het Šlomo Surayt corpus."}
              </Text>
              <Text style={[styles.srsSub, { color: theme.textSecondary }]}>
                Totaal in woordenboek: {breakdown?.total ?? 1345} woorden
              </Text>
            </View>
          </View>
        </QantreCard>

        <SyriacBorder />

        {/* Woord van de Dag uit Tur Abdin */}
        {wordOfTheDay && (
          <QantreCard
            title={`Woord van de Dag • ${wordOfTheDay.category}`}
            badgeText={wordOfTheDay.cefrLevel}
            badgeVariant="terracotta"
          >
            <View style={styles.wotdHeader}>
              <View style={{ flex: 1 }}>
                <DualScriptText
                  serto={wordOfTheDay.suraytSerto}
                  sertoUnvocalized={wordOfTheDay.suraytSertoUnvocalized}
                  latin={wordOfTheDay.suraytLat}
                  variant="2xl"
                  bold
                  interactiveToggle
                />
                {wordOfTheDay.rootRadicals && (
                  <Text style={[styles.rootTag, { color: theme.terracotta }]}>
                    Wortel: {wordOfTheDay.rootRadicals}
                  </Text>
                )}
              </View>

              <Pressable
                onPress={() =>
                  suraytAudio.playPronunciation(
                    wordOfTheDay.id,
                    wordOfTheDay.audioUrl
                  )
                }
                style={[
                  styles.audioCircleBtn,
                  { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                ]}
              >
                <Volume2 size={22} color={theme.primary} />
              </Pressable>
            </View>

            <View
              style={[
                styles.translationBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Sparkles size={15} color={theme.gold} />
              <Text style={[styles.translationText, { color: theme.textPrimary }]}>
                {wordOfTheDay.translationNl}
              </Text>
            </View>
          </QantreCard>
        )}
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
    paddingBottom: 32,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  greetingNl: {
    fontFamily: "NotoSans-Bold",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
  },
  streakCount: {
    fontFamily: "NotoSans-Bold",
    fontSize: 17,
  },
  streakLabel: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
  },
  missionContainer: {
    marginTop: 4,
  },
  missionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  missionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  missionTitle: {
    fontFamily: "NotoSans-Bold",
    fontSize: 13,
  },
  missionPct: {
    fontFamily: "NotoSans-Bold",
    fontSize: 13,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  nextRankHint: {
    fontFamily: "NotoSans-Regular",
    fontSize: 11,
    marginTop: 6,
  },
  lessonTitleNl: {
    fontFamily: "NotoSans-Bold",
    fontSize: 15,
    marginBottom: 4,
  },
  lessonDesc: {
    fontFamily: "NotoSans-Regular",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  lessonActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wordCountMeta: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
  },
  ctaButtonText: {
    fontFamily: "NotoSans-Bold",
    color: "#FFFFFF",
    fontSize: 13,
  },
  srsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  srsText: {
    fontFamily: "NotoSans-Bold",
    fontSize: 13,
  },
  srsSub: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  wotdHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rootTag: {
    fontFamily: "NotoSans-Bold",
    fontSize: 12,
    marginTop: 4,
  },
  audioCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  translationBox: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  translationText: {
    fontFamily: "NotoSans-Bold",
    fontSize: 14,
    flex: 1,
  },
});
