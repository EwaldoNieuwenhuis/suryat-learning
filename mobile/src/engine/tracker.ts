import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { dailyActivity, SkillPillar, srsCards, srsReviewLogs } from "../db/schema";
import { calculateNextSrsState, deriveRatingFromPerformance, ReviewRating } from "./srs";
import { useAppStore } from "../store/useAppStore";

export interface SuryoyeRank {
  level: number;
  titleSuraytLat: string;
  titleSuraytSerto: string;
  titleNl: string;
  minXp: number;
  nextRankXp: number | null;
}

export const SURYOYE_CULTURAL_RANKS: SuryoyeRank[] = [
  {
    level: 1,
    titleSuraytLat: "Yolufo",
    titleSuraytSerto: "ܝܳܠܽܘܦܐ",
    titleNl: "Student van Tur Abdin",
    minXp: 0,
    nextRankXp: 250,
  },
  {
    level: 2,
    titleSuraytLat: "Qaroyo",
    titleSuraytSerto: "ܩܰܪܳܝܐ",
    titleNl: "Voorlezer van het Serto",
    minXp: 250,
    nextRankXp: 750,
  },
  {
    level: 3,
    titleSuraytLat: "Mšamšono",
    titleSuraytSerto: "ܡܫܰܡܫܳܢܐ",
    titleNl: "Hoeder van de Traditie",
    minXp: 750,
    nextRankXp: 1800,
  },
  {
    level: 4,
    titleSuraytLat: "Sofro",
    titleSuraytSerto: "ܣܳܦܪܐ",
    titleNl: "Kalligraaf van Midyat",
    minXp: 1800,
    nextRankXp: 3500,
  },
  {
    level: 5,
    titleSuraytLat: "Malfono",
    titleSuraytSerto: "ܡܰܠܦܳܢܐ",
    titleNl: "Meester van het Surayt",
    minXp: 3500,
    nextRankXp: null,
  },
];

export function getRankForXp(xp: number): SuryoyeRank {
  for (let i = SURYOYE_CULTURAL_RANKS.length - 1; i >= 0; i--) {
    if (xp >= SURYOYE_CULTURAL_RANKS[i].minXp) {
      return SURYOYE_CULTURAL_RANKS[i];
    }
  }
  return SURYOYE_CULTURAL_RANKS[0];
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface RecordExerciseParams {
  itemId: string;
  skillPillar: SkillPillar;
  isCorrect: boolean;
  responseTimeMs: number;
  explicitRating?: ReviewRating;
  studyDurationSeconds?: number;
}

/**
 * Verwerkt een beantwoorde vraag of flashcard:
 * 1. Berekent de nieuwe FSRS/SM-2 state
 * 2. Schrijft een review-log weg voor de 4-Pijler Vaardigheidsmatrix
 * 3. Werkt de 365-dagen Heatmap (daily_activity) en XP/Streak in Zustand+MMKV bij
 */
export async function recordExerciseAttempt(params: RecordExerciseParams) {
  const db = getDb();
  const nowMs = Date.now();
  const todayIso = getTodayIsoDate();

  const rating =
    params.explicitRating ??
    deriveRatingFromPerformance(params.isCorrect, params.responseTimeMs);

  // Haal bestaande SRS-kaart op of maak een verse standaard-kaart
  const existingCards = await db
    .select()
    .from(srsCards)
    .where(eq(srsCards.itemId, params.itemId))
    .limit(1);

  const currentCard = existingCards[0] ?? {
    itemId: params.itemId,
    itemType: "word" as const,
    status: "new" as const,
    easinessFactor: 2.5,
    stability: 0.0,
    difficulty: 5.0,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    correctStreak: 0,
    totalReviews: 0,
    totalCorrect: 0,
    avgResponseMs: 0,
    lastReviewedAt: null,
    nextReviewAt: 0,
  };

  const nextState = calculateNextSrsState({
    card: currentCard,
    rating,
    responseTimeMs: params.responseTimeMs,
    nowMs,
  });

  // XP berekening: basis XP + snelheid-bonus voor vlot antwoorden
  const xpEarned = params.isCorrect
    ? rating === 4
      ? 15
      : rating === 3
      ? 10
      : 6
    : 2;

  const addedSeconds =
    params.studyDurationSeconds ??
    Math.max(2, Math.round(params.responseTimeMs / 1000));

  // 1. Upsert SRS Card
  await db
    .insert(srsCards)
    .values({
      itemId: params.itemId,
      itemType: currentCard.itemType,
      ...nextState,
    })
    .onConflictDoUpdate({
      target: srsCards.itemId,
      set: nextState,
    });

  // 2. Voeg Review Log toe voor Radar Chart & Struggle Words
  await db.insert(srsReviewLogs).values({
    itemId: params.itemId,
    skillPillar: params.skillPillar,
    rating,
    isCorrect: params.isCorrect ? 1 : 0,
    responseTimeMs: params.responseTimeMs,
    reviewedAt: nowMs,
  });

  // 3. Upsert Dagelijkse Activiteit (voor de 365-dagen Streak Heatmap)
  await db
    .insert(dailyActivity)
    .values({
      dateIso: todayIso,
      studySeconds: addedSeconds,
      reviewsCompleted: 1,
      lessonsCompleted: 0,
      xpEarned,
    })
    .onConflictDoUpdate({
      target: dailyActivity.dateIso,
      set: {
        studySeconds: sql`${dailyActivity.studySeconds} + ${addedSeconds}`,
        reviewsCompleted: sql`${dailyActivity.reviewsCompleted} + 1`,
        xpEarned: sql`${dailyActivity.xpEarned} + ${xpEarned}`,
      },
    });

  // 4. Werk direct de Zustand + MMKV store bij voor live UI-feedback
  useAppStore.getState().addXpAndRegisterActivity(xpEarned, todayIso);

  return {
    nextState,
    xpEarned,
    rating,
  };
}

/**
 * Markeert een volledige les als voltooid en kent bonus-XP toe.
 */
export async function recordLessonCompletion(bonusXp = 50): Promise<void> {
  const db = getDb();
  const todayIso = getTodayIsoDate();

  await db
    .insert(dailyActivity)
    .values({
      dateIso: todayIso,
      studySeconds: 60,
      reviewsCompleted: 0,
      lessonsCompleted: 1,
      xpEarned: bonusXp,
    })
    .onConflictDoUpdate({
      target: dailyActivity.dateIso,
      set: {
        lessonsCompleted: sql`${dailyActivity.lessonsCompleted} + 1`,
        xpEarned: sql`${dailyActivity.xpEarned} + ${bonusXp}`,
      },
    });

  useAppStore.getState().addXpAndRegisterActivity(bonusXp, todayIso);
}
