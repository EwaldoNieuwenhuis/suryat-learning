import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MapPin, CheckCircle2, BookOpen } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSuryoyeTheme } from "../../theme/colors";
import {
  getAllLessonsWithProgress,
  LessonWithProgress,
} from "../../db/queries/lessons";
import { QantreCard } from "../../components/suryoye-ui/QantreCard";
import { ScriptModeBar } from "../../components/suryoye-ui/ScriptModeBar";

const CEFR_FILTERS = ["ALL", "A1", "A2", "B1"] as const;

export default function LearnPathScreen() {
  const theme = useSuryoyeTheme();
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [selectedCefr, setSelectedCefr] =
    useState<(typeof CEFR_FILTERS)[number]>("ALL");

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      getAllLessonsWithProgress().then((rows) => {
        if (mounted) setLessons(rows);
      });
      return () => {
        mounted = false;
      };
    }, [])
  );

  const filteredLessons =
    selectedCefr === "ALL"
      ? lessons
      : lessons.filter((l) => l.cefrLevel === selectedCefr);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <FlatList
        data={filteredLessons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={[styles.kicker, { color: theme.textSecondary }]}>
              DE ROUTE DOOR TUR ABDIN
            </Text>
            <Text style={[styles.screenTitle, { color: theme.textPrimary }]}>
              Šlomo Surayt Leerpad ({lessons.length} Lessen)
            </Text>

            <ScriptModeBar />

            {/* CEFR Niveau Filter */}
            <View style={styles.filterRow}>
              {CEFR_FILTERS.map((lvl) => {
                const active = selectedCefr === lvl;
                return (
                  <Pressable
                    key={lvl}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      setSelectedCefr(lvl);
                    }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active
                          ? theme.primary
                          : theme.surfaceElevated,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: active ? "#FFFFFF" : theme.textSecondary },
                      ]}
                    >
                      {lvl === "ALL" ? "Alle Niveaus" : `Niveau ${lvl}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const isCompleted = item.progressPercent >= 100 && item.totalWords > 0;
          return (
            <View style={styles.timelineItem}>
              {/* Verticale verbindingslijn tussen de steden van Tur Abdin */}
              {index < filteredLessons.length - 1 && (
                <View
                  style={[
                    styles.timelineConnector,
                    { backgroundColor: theme.archStroke },
                  ]}
                />
              )}

              <QantreCard
                title={`Hoofdstuk ${item.orderIndex} • ${item.locationTheme}`}
                titleSerto={item.titleSuraytSerto}
                titleLatin={item.titleSuraytLat}
                badgeText={`${item.cefrLevel} • ${item.totalWords} woorden`}
                badgeVariant={isCompleted ? "olive" : "gold"}
                onPress={() => router.push(`/lesson/${item.id}` as any)}
              >
                <Text style={[styles.lessonTitleNl, { color: theme.textPrimary }]}>
                  {item.titleNl}
                </Text>
                <Text style={[styles.lessonDesc, { color: theme.textSecondary }]}>
                  {item.descriptionNl}
                </Text>

                {/* Voortgangsbalk per les */}
                <View style={styles.progressSection}>
                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: theme.surface },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${item.progressPercent}%`,
                          backgroundColor: isCompleted
                            ? theme.success
                            : theme.primary,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.metaFooter}>
                    <View style={styles.locationWrap}>
                      <MapPin size={13} color={theme.terracotta} />
                      <Text
                        style={[styles.metaLabel, { color: theme.textSecondary }]}
                      >
                        {item.locationTheme}
                      </Text>
                    </View>

                    <View style={styles.locationWrap}>
                      {isCompleted ? (
                        <CheckCircle2 size={14} color={theme.success} />
                      ) : (
                        <BookOpen size={14} color={theme.primary} />
                      )}
                      <Text
                        style={[styles.metaLabel, { color: theme.textPrimary }]}
                      >
                        {item.learnedWords}/{item.totalWords} geleerd (
                        {item.progressPercent}%)
                      </Text>
                    </View>
                  </View>
                </View>
              </QantreCard>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  listContent: {
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
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: "NotoSans-Bold",
    fontSize: 12,
  },
  timelineItem: {
    position: "relative",
  },
  timelineConnector: {
    position: "absolute",
    left: 28,
    bottom: -14,
    width: 2,
    height: 28,
    zIndex: -1,
  },
  lessonTitleNl: {
    fontFamily: "NotoSans-Bold",
    fontSize: 15,
    marginBottom: 4,
  },
  lessonDesc: {
    fontFamily: "NotoSans-Regular",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  progressSection: {
    marginTop: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  metaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaLabel: {
    fontFamily: "NotoSans-Bold",
    fontSize: 11,
  },
});
