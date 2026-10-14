import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Volume2, CheckCircle2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSuryoyeTheme } from "../../theme/colors";
import { getLessonBundleById, FullLessonBundle } from "../../db/queries/lessons";
import { suraytAudio } from "../../engine/audio";
import { DualScriptText } from "../../components/typography/DualScriptText";
import { QantreCard } from "../../components/suryoye-ui/QantreCard";
import { ScriptModeBar } from "../../components/suryoye-ui/ScriptModeBar";
import { useAppStore } from "../../store/useAppStore";

export default function LessonDetailScreen() {
  const theme = useSuryoyeTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bundle, setBundle] = useState<FullLessonBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const addXp = useAppStore((s) => s.addXpAndRegisterActivity);

  useEffect(() => {
    if (!id) return;
    getLessonBundleById(id).then((data) => {
      setBundle(data);
      setLoading(false);
    });
  }, [id]);

  const handlePlayAudio = (itemId: string, audioUrl?: string | null) => {
    Haptics.selectionAsync();
    suraytAudio.playPronunciation(itemId, audioUrl);
  };

  const handleCompleteLesson = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const todayIso = new Date().toISOString().split("T")[0];
    addXp(25, todayIso);
    router.back();
  };

  if (loading || !bundle) {
    return (
      <SafeAreaView style={[styles.centerScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const { lesson, words: lessonWords, sentences: lessonSentences } = bundle;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          {lesson.titleNl}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.kicker, { color: theme.textSecondary }]}>
          {lesson.locationTheme} • NIVEAU {lesson.cefrLevel}
        </Text>

        <DualScriptText
          serto={lesson.titleSuraytSerto}
          latin={lesson.titleSuraytLat}
          variant="lg"
        />

        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {lesson.descriptionNl}
        </Text>

        <ScriptModeBar />

        {/* Sectie 1: Woorden in deze les */}
        <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
          Woordenschat ({lessonWords.length} woorden)
        </Text>

        {lessonWords.map((word) => (
          <View
            key={word.id}
            style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={styles.itemTextContainer}>
              <DualScriptText
                serto={word.suraytSerto}
                sertoUnvocalized={word.suraytSertoUnvocalized}
                latin={word.suraytLat}
                variant="md"
              />
              <Text style={[styles.translationText, { color: theme.textSecondary }]}>
                {word.translationNl}
              </Text>
            </View>

            <Pressable
              onPress={() => handlePlayAudio(word.id, word.audioUrl)}
              style={[styles.playButton, { backgroundColor: theme.surfaceElevated }]}
            >
              <Volume2 size={18} color={theme.primary} />
            </Pressable>
          </View>
        ))}

        {/* Sectie 2: Voorbeeldzinnen & Dialogen */}
        {lessonSentences.length > 0 && (
          <View style={styles.sentencesSection}>
            <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
              Voorbeeldzinnen & Dialogen ({lessonSentences.length})
            </Text>

            {lessonSentences.map((sent) => (
              <View
                key={sent.id}
                style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.itemTextContainer}>
                  <DualScriptText
                    serto={sent.suraytSerto}
                    sertoUnvocalized={sent.suraytSertoUnvocalized}
                    latin={sent.suraytLat}
                    variant="md"
                  />
                  <Text style={[styles.translationText, { color: theme.textSecondary }]}>
                    {sent.translationNl}
                  </Text>
                </View>

                {sent.audioUrl && (
                  <Pressable
                    onPress={() => handlePlayAudio(sent.id, sent.audioUrl)}
                    style={[styles.playButton, { backgroundColor: theme.surfaceElevated }]}
                  >
                    <Volume2 size={18} color={theme.primary} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Voltooi les knop */}
        <Pressable
          onPress={handleCompleteLesson}
          style={[styles.completeButton, { backgroundColor: theme.primary }]}
        >
          <CheckCircle2 size={20} color="#FFFFFF" />
          <Text style={styles.completeButtonText}>Les Voltooien (+25 XP)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backButton: { padding: 4, marginRight: 12 },
  topBarTitle: { fontSize: 17, fontFamily: "NotoSans-Bold", flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  kicker: { fontSize: 11, fontFamily: "NotoSans-Bold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  description: { fontSize: 14, fontFamily: "NotoSans-Regular", lineHeight: 20, marginVertical: 10 },
  sectionHeading: { fontSize: 18, fontFamily: "NotoSans-Bold", marginTop: 24, marginBottom: 12 },
  itemCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  itemTextContainer: { flex: 1, marginRight: 12 },
  translationText: { fontSize: 14, fontFamily: "NotoSans-Regular", marginTop: 4 },
  playButton: { padding: 10, borderRadius: 10 },
  sentencesSection: { marginTop: 12 },
  completeButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14, marginTop: 32 },
  completeButtonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "NotoSans-Bold" },
});
