export type Course = {
  id: number;
  title: string;
  exam_date: string | null;
  daily_minutes_goal: number | null;
  mastery_threshold: number;
  priority_weight: number;
  sections_count: number;
  created_at: string;
};

export type Section = {
  id: number;
  course: number;
  parent: number | null;
  title: string;
  order: number;
  difficulty: number;
  estimated_mastery_min: number | null;
  notes: string;
  knowledge_units_count: number;
};

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type KnowledgeUnit = {
  id: number;
  section: number;
  source_text: string;
  concept_summary: string;
  key_terms: { term: string; definition: string }[];
  blooms_level: BloomLevel;
  connection_tags: string[];
  common_misconceptions: string[];
  study_items_count: number;
  created_at: string;
};

export type StudyMode =
  | "flashcard"
  | "mc"
  | "scenario"
  | "fill_blank"
  | "free_response"
  | "matching";

export type Distractor = { text: string; why_wrong: string };

export type StudyItem = {
  id: number;
  knowledge_unit: number;
  mode: StudyMode;
  prompt: string;
  // Shape varies by mode — see StudyItem docstring in learning/models.py.
  expected_answer: Record<string, unknown>;
  distractors: Distractor[];
  blooms_level: BloomLevel;
  last_reviewed_at: string | null;
  created_at: string;
};

export const STUDY_MODES: StudyMode[] = [
  "flashcard",
  "mc",
  "scenario",
  "fill_blank",
  "free_response",
  "matching",
];

export const MODE_LABELS: Record<StudyMode, string> = {
  flashcard: "Flashcard",
  mc: "Multiple choice",
  scenario: "Scenario",
  fill_blank: "Fill in the blank",
  free_response: "Free response",
  matching: "Matching",
};

export type ReviewLog = {
  id: number;
  study_item: number;
  reviewed_at: string;
  was_correct: boolean;
  user_rating: number | null;
  response_time_ms: number | null;
};

export type ScopeStats = {
  total_kus: number;
  reviewed_kus: number;
  mastered_kus: number;
  mastery_pct: number;
  accuracy_pct: number;
  total_items: number;
  items_reviewed: number;
  total_reviews: number;
  last_reviewed_at: string | null;
};

export type ModeCount = { mode: StudyMode; count: number; pct: number };

export type SectionStatsRow = ScopeStats & {
  id: number;
  title: string;
  order: number;
};

export type CourseStatsResponse = {
  course: Course;
  overall: ScopeStats;
  sections: SectionStatsRow[];
  weakest_sections: SectionStatsRow[];
  mode_distribution_7d: ModeCount[];
  reviews_today: number;
};

export type DashboardCourse = Course & { stats: ScopeStats };

export type DashboardResponse = {
  courses: DashboardCourse[];
  reviews_today: number;
  mode_distribution_7d: ModeCount[];
};
