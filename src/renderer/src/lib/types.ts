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
  created_at: string;
};
