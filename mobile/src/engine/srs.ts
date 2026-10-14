import { SrsCardRow, SrsStatus } from "../db/schema";

export type ReviewRating = 1 | 2 | 3 | 4; // 1 = Opnieuw (Again), 2 = Moeilijk (Hard), 3 = Goed (Good), 4 = Makkelijk (Easy)

export interface SrsCalculationInput {
  card: SrsCardRow;
  rating: ReviewRating;
  responseTimeMs: number;
  nowMs?: number;
}

export interface SrsCalculationResult {
  status: SrsStatus;
  easinessFactor: number;
  stability: number;
  difficulty: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  correctStreak: number;
  totalReviews: number;
  totalCorrect: number;
  avgResponseMs: number;
  lastReviewedAt: number;
  nextReviewAt: number;
}

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_EASINESS = 1.3;
const MAX_EASINESS = 3.2;

/**
 * Berekent een automatische ReviewRating (1-4) op basis van juistheid en reactiesnelheid (fluency)
 * wanneer een oefening (bijv. MultipleChoice of AudioMatch) binair (goed/fout) is.
 */
export function deriveRatingFromPerformance(isCorrect: boolean, responseTimeMs: number): ReviewRating {
  if (!isCorrect) return 1; // Again
  if (responseTimeMs <= 2400) return 4; // Easy (directe vlotheid)
  if (responseTimeMs <= 6500) return 3; // Good (normale herkenning)
  return 2; // Hard (correct, maar lang moeten ontcijferen)
}

/**
 * Voert de FSRS / SM-2 berekening uit voor een individuele Surayt kaart.
 */
export function calculateNextSrsState(input: SrsCalculationInput): SrsCalculationResult {
  const { card, rating } = input;
  const nowMs = input.nowMs ?? Date.now();
  const clampedResponseMs = Math.max(250, Math.min(input.responseTimeMs, 30000));
  const isCorrect = rating >= 2;

  const totalReviews = card.totalReviews + 1;
  const totalCorrect = card.totalCorrect + (isCorrect ? 1 : 0);

  // Voortschrijdend gemiddelde van de reactietijd (exponential moving average na eerste review)
  const avgResponseMs =
    card.totalReviews === 0
      ? clampedResponseMs
      : Math.round(card.avgResponseMs * 0.7 + clampedResponseMs * 0.3);

  // 1. Update FSRS Difficulty (schaal 1.0 - 10.0)
  const difficultyDelta = (3 - rating) * 0.65;
  const difficulty = Number(
    Math.min(10.0, Math.max(1.0, card.difficulty + difficultyDelta)).toFixed(2)
  );

  // 2. Update SM-2 Easiness Factor
  // SM-2 formule: EF' = EF + (0.1 - (4 - rating) * (0.08 + (4 - rating) * 0.02))
  const q = rating + 1; // Schaal 2..5 voor klassieke SM-2 vergelijking
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const easinessFactor = Number(
    Math.min(MAX_EASINESS, Math.max(MIN_EASINESS, card.easinessFactor + efDelta)).toFixed(2)
  );

  let repetitions = card.repetitions;
  let lapses = card.lapses;
  let correctStreak = card.correctStreak;
  let intervalDays = card.intervalDays;
  let stability = card.stability;
  let nextReviewAt = nowMs;
  let status: SrsStatus = card.status;

  if (!isCorrect) {
    // Fout beantwoord (Rating 1 - Again): kaart vervalt naar korte leer-interval (10 minuten)
    repetitions = 0;
    lapses = card.lapses + 1;
    correctStreak = 0;
    intervalDays = 0;
    stability = Number(Math.max(0.4, card.stability * 0.35).toFixed(2));
    status = "learning";
    nextReviewAt = nowMs + 10 * MS_PER_MINUTE;
  } else {
    // Correct beantwoord (Rating 2, 3 of 4)
    repetitions = card.repetitions + 1;
    correctStreak = card.correctStreak + 1;

    // Fluency modifier op basis van reactietijd
    const fluencyFactor = clampedResponseMs < 2200 ? 1.12 : clampedResponseMs > 8000 ? 0.88 : 1.0;

    if (repetitions === 1) {
      intervalDays = rating === 4 ? 3 : 1;
      stability = intervalDays;
    } else if (repetitions === 2) {
      intervalDays = rating === 4 ? 7 : rating === 3 ? 4 : 2;
      stability = intervalDays;
    } else {
      const ratingMultiplier = rating === 4 ? 1.3 : rating === 3 ? 1.0 : 0.78;
      const rawNextInterval =
        Math.max(1, card.intervalDays) * easinessFactor * ratingMultiplier * fluencyFactor;
      intervalDays = Math.min(365, Math.max(card.intervalDays + 1, Math.round(rawNextInterval)));
      stability = Number((intervalDays * (11 - difficulty) * 0.15).toFixed(2));
    }

    // Bepaal de status (New -> Learning -> Review -> Mastered)
    if (intervalDays >= 21 && correctStreak >= 4) {
      status = "mastered";
    } else if (repetitions >= 2) {
      status = "review";
    } else {
      status = "learning";
    }

    nextReviewAt = nowMs + intervalDays * MS_PER_DAY;
  }

  return {
    status,
    easinessFactor,
    stability,
    difficulty,
    intervalDays,
    repetitions,
    lapses,
    correctStreak,
    totalReviews,
    totalCorrect,
    avgResponseMs,
    lastReviewedAt: nowMs,
    nextReviewAt,
  };
}
