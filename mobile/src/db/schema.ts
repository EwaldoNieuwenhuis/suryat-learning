import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey().notNull(),
  value: text("value").notNull(),
});

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey().notNull(),
  slug: text("slug").notNull().unique(),
  titleNl: text("title_nl").notNull(),
  titleSuraytLat: text("title_surayt_lat").notNull(),
  titleSuraytSerto: text("title_surayt_serto").notNull(),
  locationTheme: text("location_theme").notNull(),
  cefrLevel: text("cefr_level").notNull().default("A1"),
  orderIndex: integer("order_index").notNull(),
  descriptionNl: text("description_nl").notNull(),
});

export const words = sqliteTable(
  "words",
  {
    id: text("id").primaryKey().notNull(),
    lessonId: text("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    suraytLat: text("surayt_lat").notNull(),
    suraytLatSearch: text("surayt_lat_search").notNull(),
    suraytSerto: text("surayt_serto").notNull(),
    suraytSertoUnvocalized: text("surayt_serto_unvocalized").notNull(),
    rootRadicals: text("root_radicals"),
    partOfSpeech: text("part_of_speech").notNull(),
    gender: text("gender"),
    pluralLat: text("plural_lat"),
    pluralSerto: text("plural_serto"),
    translationNl: text("translation_nl").notNull(),
    translationEn: text("translation_en").notNull(),
    translationDe: text("translation_de").notNull(),
    audioUrl: text("audio_url"),
    audioLocal: text("audio_local"),
    cefrLevel: text("cefr_level").notNull().default("A1"),
    category: text("category").notNull().default("alledaags"),
  },
  (table) => ({
    latSearchIdx: index("idx_words_lat_search").on(table.suraytLatSearch),
    sertoUnvocIdx: index("idx_words_serto_unvoc").on(table.suraytSertoUnvocalized),
    rootIdx: index("idx_words_root").on(table.rootRadicals),
    categoryIdx: index("idx_words_category").on(table.category),
    lessonIdx: index("idx_words_lesson").on(table.lessonId),
  })
);

export const verbConjugations = sqliteTable(
  "verb_conjugations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    wordId: text("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    tense: text("tense").notNull(),
    person: text("person").notNull(),
    suraytLat: text("surayt_lat").notNull(),
    suraytSerto: text("surayt_serto").notNull(),
  },
  (table) => ({
    wordIdIdx: index("idx_conj_word_id").on(table.wordId),
  })
);

export const sentences = sqliteTable("sentences", {
  id: text("id").primaryKey().notNull(),
  lessonId: text("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  suraytLat: text("surayt_lat").notNull(),
  suraytSerto: text("surayt_serto").notNull(),
  suraytSertoUnvocalized: text("surayt_serto_unvocalized").notNull(),
  translationNl: text("translation_nl").notNull(),
  translationEn: text("translation_en").notNull(),
  translationDe: text("translation_de").notNull(),
  cefrLevel: text("cefr_level").notNull().default("A1"),
  category: text("category").notNull(),
  audioUrl: text("audio_url"),
  audioLocal: text("audio_local"),
  wordTokensJson: text("word_tokens_json").notNull(),
});

export type SrsStatus = "new" | "learning" | "review" | "mastered";
export type SrsItemType = "word" | "sentence" | "conjugation";
export type SkillPillar = "serto_reading" | "listening" | "vocabulary" | "grammar_roots";

export const srsCards = sqliteTable(
  "srs_cards",
  {
    itemId: text("item_id").primaryKey().notNull(),
    itemType: text("item_type").$type<SrsItemType>().notNull().default("word"),
    status: text("status").$type<SrsStatus>().notNull().default("new"),
    easinessFactor: real("easiness_factor").notNull().default(2.5),
    stability: real("stability").notNull().default(0.0),
    difficulty: real("difficulty").notNull().default(5.0),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    correctStreak: integer("correct_streak").notNull().default(0),
    totalReviews: integer("total_reviews").notNull().default(0),
    totalCorrect: integer("total_correct").notNull().default(0),
    avgResponseMs: integer("avg_response_ms").notNull().default(0),
    lastReviewedAt: integer("last_reviewed_at"),
    nextReviewAt: integer("next_review_at").notNull(),
  },
  (table) => ({
    nextReviewIdx: index("idx_srs_next_review").on(table.nextReviewAt),
    statusIdx: index("idx_srs_status").on(table.status),
  })
);

export const srsReviewLogs = sqliteTable(
  "srs_review_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: text("item_id").notNull(),
    skillPillar: text("skill_pillar").$type<SkillPillar>().notNull(),
    rating: integer("rating").notNull(), // 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
    isCorrect: integer("is_correct").notNull(), // 1 of 0
    responseTimeMs: integer("response_time_ms").notNull(),
    reviewedAt: integer("reviewed_at").notNull(), // Unix timestamp in ms
  },
  (table) => ({
    reviewedAtIdx: index("idx_logs_reviewed_at").on(table.reviewedAt),
    itemIdIdx: index("idx_logs_item_id").on(table.itemId),
  })
);

export const dailyActivity = sqliteTable("daily_activity", {
  dateIso: text("date_iso").primaryKey().notNull(), // YYYY-MM-DD
  studySeconds: integer("study_seconds").notNull().default(0),
  reviewsCompleted: integer("reviews_completed").notNull().default(0),
  lessonsCompleted: integer("lessons_completed").notNull().default(0),
  xpEarned: integer("xp_earned").notNull().default(0),
});

export type LessonRow = typeof lessons.$inferSelect;
export type WordRow = typeof words.$inferSelect;
export type VerbConjugationRow = typeof verbConjugations.$inferSelect;
export type SentenceRow = typeof sentences.$inferSelect;
export type SrsCardRow = typeof srsCards.$inferSelect;
export type SrsReviewLogRow = typeof srsReviewLogs.$inferSelect;
export type DailyActivityRow = typeof dailyActivity.$inferSelect;
