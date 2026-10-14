import { getRawSqlite } from "../client";
import { SkillPillar, WordRow } from "../schema";

export interface DueReviewCard {
  word: WordRow;
  status: string;
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  avgResponseMs: number;
}

/**
 * Haalt alle kaarten op die nu (of eerder) aan de beurt zijn voor SRS-herhaling,
 * aangevuld met nieuwe woorden als de gebruiker zijn dagelijkse wachtrij wil vullen.
 */
export function getDueReviewQueue(limit = 25): DueReviewCard[] {
  const rawDb = getRawSqlite();
  const nowMs = Date.now();

  const rows = rawDb.getAllSync<any>(
    `
    SELECT
      w.*,
      c.status AS srs_status,
      c.easiness_factor,
      c.interval_days,
      c.repetitions,
      c.lapses,
      c.avg_response_ms
    FROM srs_cards c
    INNER JOIN words w ON w.id = c.item_id
    WHERE c.next_review_at <= ?
    ORDER BY
      CASE c.status
        WHEN 'learning' THEN 1
        WHEN 'review' THEN 2
        WHEN 'new' THEN 3
        ELSE 4
      END ASC,
      c.lapses DESC,
      c.next_review_at ASC
    LIMIT ?;
    `,
    [nowMs, limit]
  );

  return rows.map((r) => ({
    word: {
      id: r.id,
      lessonId: r.lesson_id,
      suraytLat: r.surayt_lat,
      suraytLatSearch: r.surayt_lat_search,
      suraytSerto: r.surayt_serto,
      suraytSertoUnvocalized: r.surayt_serto_unvocalized,
      rootRadicals: r.root_radicals,
      partOfSpeech: r.part_of_speech,
      gender: r.gender,
      pluralLat: r.plural_lat,
      pluralSerto: r.plural_serto,
      translationNl: r.translation_nl,
      translationEn: r.translation_en,
      translationDe: r.translation_de,
      audioUrl: r.audio_url,
      audioLocal: r.audio_local,
      cefrLevel: r.cefr_level,
      category: r.category,
    },
    status: r.srs_status,
    easinessFactor: r.easiness_factor,
    intervalDays: r.interval_days,
    repetitions: r.repetitions,
    lapses: r.lapses,
    avgResponseMs: r.avg_response_ms,
  }));
}

export interface VocabularyBreakdown {
  total: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  masteredCount: number;
  dueNowCount: number;
  avgFluencyMs: number;
}

/**
 * Berekent de volledige Woordenschat Breakdown en gemiddelde reactiesnelheid (fluency in ms).
 */
export function getVocabularyBreakdown(): VocabularyBreakdown {
  const rawDb = getRawSqlite();
  const nowMs = Date.now();

  const row = rawDb.getFirstSync<{
    total: number;
    new_count: number;
    learning_count: number;
    review_count: number;
    mastered_count: number;
    due_now: number;
    avg_ms: number | null;
  }>(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
      SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) AS learning_count,
      SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS review_count,
      SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) AS mastered_count,
      SUM(CASE WHEN status != 'new' AND next_review_at <= ? THEN 1 ELSE 0 END) AS due_now,
      AVG(CASE WHEN avg_response_ms > 0 THEN avg_response_ms ELSE NULL END) AS avg_ms
    FROM srs_cards;
    `,
    [nowMs]
  );

  return {
    total: row?.total ?? 0,
    newCount: row?.new_count ?? 0,
    learningCount: row?.learning_count ?? 0,
    reviewCount: row?.review_count ?? 0,
    masteredCount: row?.mastered_count ?? 0,
    dueNowCount: row?.due_now ?? 0,
    avgFluencyMs: Math.round(row?.avg_ms ?? 0),
  };
}

export interface SkillMatrixScores {
  serto_reading: number;   // 0 - 100%
  listening: number;       // 0 - 100%
  vocabulary: number;      // 0 - 100%
  grammar_roots: number;   // 0 - 100%
}

/**
 * Berekent de 4-Pijler Vaardigheidsmatrix (0-100%) op basis van nauwkeurigheid
 * én reactiesnelheid (fluency) uit de srs_review_logs.
 */
export function getFourPillarSkillMatrix(): SkillMatrixScores {
  const rawDb = getRawSqlite();
  const rows = rawDb.getAllSync<{
    skill_pillar: SkillPillar;
    total_attempts: number;
    accuracy_ratio: number;
    avg_ms: number;
  }>(`
    SELECT
      skill_pillar,
      COUNT(*) AS total_attempts,
      AVG(is_correct) AS accuracy_ratio,
      AVG(response_time_ms) AS avg_ms
    FROM srs_review_logs
    GROUP BY skill_pillar;
  `);

  const scores: SkillMatrixScores = {
    serto_reading: 15,
    listening: 15,
    vocabulary: 15,
    grammar_roots: 15,
  };

  for (const r of rows) {
    if (!r.total_attempts) continue;
    // Weeg nauwkeurigheid (80%) + snelheid/fluency onder 6 seconden (20%) + volume-groei
    const accuracyScore = r.accuracy_ratio * 80;
    const speedScore = Math.max(0, Math.min(20, ((6500 - r.avg_ms) / 5000) * 20));
    const confidenceFactor = Math.min(1, r.total_attempts / 15);
    const computed = Math.round(15 + (accuracyScore + speedScore - 15) * confidenceFactor);
    scores[r.skill_pillar] = Math.max(10, Math.min(100, computed));
  }

  return scores;
}

export interface StruggleWordItem {
  id: string;
  suraytLat: string;
  suraytSerto: string;
  translationNl: string;
  rootRadicals: string | null;
  lapses: number;
  errorRatePercent: number;
  avgResponseMs: number;
}

/**
 * Haalt de 'Struggle Words' op: woorden met het hoogste aantal lapses of foutpercentage.
 */
export function getStruggleWords(limit = 10): StruggleWordItem[] {
  const rawDb = getRawSqlite();
  const rows = rawDb.getAllSync<{
    id: string;
    surayt_lat: string;
    surayt_serto: string;
    translation_nl: string;
    root_radicals: string | null;
    lapses: number;
    total_reviews: number;
    total_correct: number;
    avg_response_ms: number;
  }>(
    `
    SELECT
      w.id,
      w.surayt_lat,
      w.surayt_serto,
      w.translation_nl,
      w.root_radicals,
      c.lapses,
      c.total_reviews,
      c.total_correct,
      c.avg_response_ms
    FROM srs_cards c
    INNER JOIN words w ON w.id = c.item_id
    WHERE c.total_reviews > 0 AND (c.lapses > 0 OR c.total_correct < c.total_reviews)
    ORDER BY
      c.lapses DESC,
      (CAST(c.total_reviews - c.total_correct AS REAL) / c.total_reviews) DESC,
      c.avg_response_ms DESC
    LIMIT ?;
    `,
    [limit]
  );

  return rows.map((r) => ({
    id: r.id,
    suraytLat: r.surayt_lat,
    suraytSerto: r.surayt_serto,
    translationNl: r.translation_nl,
    rootRadicals: r.root_radicals,
    lapses: r.lapses,
    errorRatePercent:
      r.total_reviews > 0
        ? Math.round(((r.total_reviews - r.total_correct) / r.total_reviews) * 100)
        : 0,
    avgResponseMs: r.avg_response_ms,
  }));
}

export interface HeatmapDayCell {
  dateIso: string;
  studySeconds: number;
  reviewsCompleted: number;
  xpEarned: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

/**
 * Genereert de 365-dagen GitHub-stijl activiteitenmatrix voor de StreakHeatmap component.
 */
export function getYearlyActivityHeatmap(daysCount = 140): HeatmapDayCell[] {
  const rawDb = getRawSqlite();
  const existingRows = rawDb.getAllSync<{
    date_iso: string;
    study_seconds: number;
    reviews_completed: number;
    xp_earned: number;
  }>(`
    SELECT date_iso, study_seconds, reviews_completed, xp_earned
    FROM daily_activity
    ORDER BY date_iso DESC
    LIMIT 366;
  `);

  const activityMap = new Map(existingRows.map((r) => [r.date_iso, r]));
  const result: HeatmapDayCell[] = [];
  const today = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const entry = activityMap.get(iso);

    const reviews = entry?.reviews_completed ?? 0;
    const xp = entry?.xp_earned ?? 0;
    let intensity: 0 | 1 | 2 | 3 | 4 = 0;

    if (reviews >= 35 || xp >= 300) intensity = 4;
    else if (reviews >= 20 || xp >= 150) intensity = 3;
    else if (reviews >= 8 || xp >= 60) intensity = 2;
    else if (reviews >= 1 || xp > 0) intensity = 1;

    result.push({
      dateIso: iso,
      studySeconds: entry?.study_seconds ?? 0,
      reviewsCompleted: reviews,
      xpEarned: xp,
      intensity,
    });
  }

  return result;
}
