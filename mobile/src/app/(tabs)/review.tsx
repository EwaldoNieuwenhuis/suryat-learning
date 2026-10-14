import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Volume2, Check, RefreshCw, AlertCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSuryoyeTheme } from "../../theme/colors";
import { getDueReviewQueue, getStruggleWords, DueReviewCard } from "../../db/queries/analytics";
import { suraytAudio } from "../../engine/audio";
import { DualScriptText } from "../../components/typography/DualScriptText";
import { QantreCard } from "../../components/suryoye-ui/QantreCard";
import { ScriptModeBar } from "../../components/suryoye-ui/ScriptModeBar";
import { WordRow } from "../../db/schema";

export default function ReviewScreen() {
  const theme = useSuryoyeTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isStruggleMode = params.mode === "struggle";

  const [cards, setCards] = useState<DueReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isStruggleMode) {
        const struggleList = getStruggleWords(25);
        if (active) {
          setCards(
            struggleList.map((item) => ({
              word: {
                id: item.id,
                lessonId: "1",
                suraytLat: item.suraytLat,
                suraytLatSearch: item.suraytLat,
                suraytSerto: item.suraytSerto,
                suraytSertoUnvocalized: item.suraytSerto,
                rootRadicals: item.rootRadicals,
                partOfSpeech: "n",
                gender: null,
                pluralLat: null,
                pluralSerto: null,
                translationNl: item.translationNl,
                translationEn: item.translationNl,
                translationDe: item.translationNl,
                audioUrl: null,
                audioLocal: null,
                cefrLevel: "A1",
                category: "Focus",
              },
              status: "struggle",
              easinessFactor: 2.5,
              intervalDays: 1,
              repetitions: 1,
              lapses: item.lapses,
              avgResponseMs: item.avgResponseMs,
            }))
          );
          setCurrentIndex(0);
          setShowAnswer(false);
        }
      } else {
        const queue = getDueReviewQueue(25);
        if (active) {
          setCards(queue);
          setCurrentIndex(0);
          setShowAnswer(false);
        }
      }
      return () => {
        active = false;
      };
    }, [isStruggleMode])
  );

  const currentCard = cards[currentIndex];

  const handlePlayAudio = (word: WordRow) => {
    suraytAudio.playPronunciation(word.id, word.audioUrl);
  };

  const handleNext = () => {
    Haptics.selectionAsync();
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.kicker, { color: theme.textSecondary }]}>
          {isStruggleMode ? "HERHAAL ZWAKKE WOORDEN" : "SPACED REPETITION GEHEUGEN"}
        </Text>
        <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
          {isStruggleMode ? "Focus Training" : "SRS Flashcards"}
        </Text>

        <ScriptModeBar />

        {cards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Check size={48} color={theme.olive} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              Alles bijgewerkt!
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Er zijn op dit moment geen woorden die herhaald moeten worden. Kom later terug of begin een nieuwe les!
            </Text>
          </View>
        ) : currentCard ? (
          <View style={styles.cardContainer}>
            <Text style={[styles.progressCounter, { color: theme.textMuted }]}>
              Kaart {currentIndex + 1} van {cards.length}
            </Text>

            <QantreCard
              title={currentCard.word.category || "Woordenschat"}
              badgeText={currentCard.word.cefrLevel}
              badgeVariant="gold"
            >
              <View style={styles.flashcardBody}>
                <DualScriptText
                  serto={currentCard.word.suraytSerto}
                  sertoUnvocalized={currentCard.word.suraytSertoUnvocalized}
                  latin={currentCard.word.suraytLat}
                  variant="xl"
                  align="center"
                />

                <Pressable
                  onPress={() => handlePlayAudio(currentCard.word)}
                  style={[styles.audioBtn, { backgroundColor: theme.surfaceElevated }]}
                >
                  <Volume2 size={24} color={theme.primary} />
                  <Text style={[styles.audioText, { color: theme.primary }]}>Beluister</Text>
                </Pressable>

                {showAnswer ? (
                  <View style={styles.answerSection}>
                    <Text style={[styles.translationNl, { color: theme.textPrimary }]}>
                      {currentCard.word.translationNl}
                    </Text>
                    {currentCard.word.rootRadicals && (
                      <Text style={[styles.rootText, { color: theme.textMuted }]}>
                        Wortel: {currentCard.word.rootRadicals}
                      </Text>
                    )}

                    <Pressable
                      onPress={handleNext}
                      style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                    >
                      <Text style={styles.actionBtnText}>Volgende Kaart</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowAnswer(true);
                    }}
                    style={[styles.revealBtn, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.revealBtnText, { color: theme.textPrimary }]}>
                      Toon Vertaling
                    </Text>
                  </Pressable>
                )}
              </View>
            </QantreCard>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },
  kicker: { fontSize: 11, fontFamily: "NotoSans-Bold", letterSpacing: 1.2, textTransform: "uppercase" },
  screenTitle: { fontSize: 24, fontFamily: "NotoSans-Bold", marginVertical: 6 },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontFamily: "NotoSans-Bold", marginTop: 16 },
  emptySubtitle: { fontSize: 14, fontFamily: "NotoSans-Regular", textAlign: "center", marginTop: 8, lineHeight: 20 },
  cardContainer: { marginTop: 12 },
  progressCounter: { fontSize: 12, fontFamily: "NotoSans-Bold", marginBottom: 8, textAlign: "right" },
  flashcardBody: { alignItems: "center", paddingVertical: 20 },
  audioBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginTop: 16 },
  audioText: { fontSize: 14, fontFamily: "NotoSans-Bold" },
  revealBtn: { width: "100%", paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center", marginTop: 24 },
  revealBtnText: { fontSize: 15, fontFamily: "NotoSans-Bold" },
  answerSection: { width: "100%", alignItems: "center", marginTop: 20 },
  translationNl: { fontSize: 22, fontFamily: "NotoSans-Bold", textAlign: "center" },
  rootText: { fontSize: 13, fontFamily: "NotoSans-Regular", marginTop: 6 },
  actionBtn: { width: "100%", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 20 },
  actionBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "NotoSans-Bold" },
});
