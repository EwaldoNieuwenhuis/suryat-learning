import { asc, eq, like, or, sql } from "drizzle-orm";
import { getDb, getRawSqlite } from "../client";
import {
  lessons,
  sentences,
  srsCards,
  verbConjugations,
  words,
  LessonRow,
  WordRow,
  SentenceRow,
  VerbConjugationRow,
} from "../schema";

export interface LessonWithProgress extends LessonRow {
  totalWords: number;
  learnedWords: number;
  masteredWords: number;
  progressPercent: number;
}

/**
 * Haalt alle 20 lessen op gesorteerd op order_index inclusief de voortgang per les.
 */
export async function getAllLessonsWithProgress(): Promise<LessonWithProgress[]> {
  const rawDb = getRawSqlite();
  const rows = rawDb.getAllSync<{
    id: string;
    slug: string;
    title_nl: string;
    title_surayt_lat: string;
    title_surayt_serto: string;
    location_theme: string;
    cefr_level: string;
    order_index: number;
    description_nl: string;
    total_words: number;
    learned_words: number;
    mastered_words: number;
  }>(`
    SELECT
      l.*,
      COUNT(w.id) AS total_words,
      SUM(CASE WHEN c.status IN ('learning', 'review', 'mastered') THEN 1 ELSE 0 END) AS learned_words,
      SUM(CASE WHEN c.status = 'mastered' THEN 1 ELSE 0 END) AS mastered_words
    FROM lessons l
    LEFT JOIN words w ON w.lesson_id = l.id
    LEFT JOIN srs_cards c ON c.item_id = w.id
    GROUP BY l.id
    ORDER BY l.order_index ASC, l.id ASC;
  `);

  return rows.map((r) => {
    const total = r.total_words || 0;
    const learned = r.learned_words || 0;
    return {
      id: r.id,
      slug: r.slug,
      titleNl: r.title_nl,
      titleSuraytLat: r.title_surayt_lat,
      titleSuraytSerto: r.title_surayt_serto,
      locationTheme: r.location_theme,
      cefrLevel: r.cefr_level,
      orderIndex: r.order_index,
      descriptionNl: r.description_nl,
      totalWords: total,
      learnedWords: learned,
      masteredWords: r.mastered_words || 0,
      progressPercent: total > 0 ? Math.round((learned / total) * 100) : 0,
    };
  });
}

export interface FullLessonBundle {
  lesson: LessonRow;
  words: WordRow[];
  sentences: SentenceRow[];
  conjugationsByWordId: Record<string, VerbConjugationRow[]>;
}

/**
 * Laadt een compleet lespakket (woorden, dialogen en werkwoordvervoegingen) voor lesson/[id].tsx.
 */
export async function getLessonBundleById(lessonId: string): Promise<FullLessonBundle | null> {
  const db = getDb();
  const lessonRows = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lessonRows.length) return null;

  const lessonWords = await db.select().from(words).where(eq(words.lessonId, lessonId));
  const lessonSentences = await db
    .select()
    .from(sentences)
    .where(eq(sentences.lessonId, lessonId));

  const conjugationsByWordId: Record<string, VerbConjugationRow[]> = {};
  for (const w of lessonWords) {
    const conjs = await db
      .select()
      .from(verbConjugations)
      .where(eq(verbConjugations.wordId, w.id));
    if (conjs.length > 0) {
      conjugationsByWordId[w.id] = conjs;
    }
  }

  return {
    lesson: lessonRows[0],
    words: lessonWords,
    sentences: lessonSentences,
    conjugationsByWordId,
  };
}

/**
 * Zoekt realtime in de 1.345+ Surayt woorden op:
 * - Diakriet-vrije Latijnse invoer ('slomo' of 'kthowo')
 * - Exacte Surayt transliteratie ('šlomo', 'kṯowo')
 * - West-Syrisch Serto (met of zonder Zow'e klinkerpunten)
 * - 3-radicale Aramese wortel ('k-ṯ-w')
 * - Nederlandse, Engelse of Duitse vertaling
 */
export async function searchDictionary(
  query: string,
  categoryFilter?: string | null,
  limit = 60
): Promise<WordRow[]> {
  const db = getDb();
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery && (!categoryFilter || categoryFilter === "all")) {
    return db.select().from(words).orderBy(asc(words.suraytLat)).limit(limit);
  }

  const pattern = `%${cleanQuery}%`;
  const searchCond = cleanQuery
    ? or(
        like(words.suraytLatSearch, pattern),
        like(words.suraytLat, pattern),
        like(words.suraytSerto, pattern),
        like(words.suraytSertoUnvocalized, pattern),
        like(words.rootRadicals, pattern),
        like(words.translationNl, pattern),
        like(words.translationEn, pattern),
        like(words.translationDe, pattern)
      )
    : undefined;

  if (categoryFilter && categoryFilter !== "all" && searchCond) {
    return db
      .select()
      .from(words)
      .where(sql`${searchCond} AND ${words.category} = ${categoryFilter}`)
      .limit(limit);
  }

  if (categoryFilter && categoryFilter !== "all") {
    return db
      .select()
      .from(words)
      .where(eq(words.category, categoryFilter))
      .orderBy(asc(words.suraytLat))
      .limit(limit);
  }

  return db.select().from(words).where(searchCond).limit(limit);
}
