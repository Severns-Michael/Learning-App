import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  Course,
  KnowledgeUnit,
  ReviewLog,
  Section,
  StudyItem,
} from "./types";

const BASE = "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ----- Courses -----

export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: () => request<Course[]>("/courses/"),
  });
}

export function useCourse(id: number | undefined) {
  return useQuery({
    queryKey: ["courses", id],
    queryFn: () => request<Course>(`/courses/${id}/`),
    enabled: id !== undefined,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Course>) =>
      request<Course>("/courses/", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<void>(`/courses/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });
}

// ----- Sections -----

export function useSections(courseId: number | undefined) {
  return useQuery({
    queryKey: ["sections", { course: courseId }],
    queryFn: () => request<Section[]>(`/sections/?course=${courseId}`),
    enabled: courseId !== undefined,
  });
}

export function useSection(id: number | undefined) {
  return useQuery({
    queryKey: ["sections", id],
    queryFn: () => request<Section>(`/sections/${id}/`),
    enabled: id !== undefined,
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Section>) =>
      request<Section>("/sections/", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["sections", { course: created.course }] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

export function useUpdateSection(sectionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Section>) =>
      request<Section>(`/sections/${sectionId}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections", sectionId] });
      qc.invalidateQueries({ queryKey: ["sections"] });
    },
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<void>(`/sections/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

// ----- Knowledge Units -----

export function useKnowledgeUnits(sectionId: number | undefined) {
  return useQuery({
    queryKey: ["knowledge-units", { section: sectionId }],
    queryFn: () =>
      request<KnowledgeUnit[]>(`/knowledge-units/?section=${sectionId}`),
    enabled: sectionId !== undefined,
  });
}

export function useIngestNotes(sectionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { text?: string; replace?: boolean } = {}) =>
      request<{ created: KnowledgeUnit[] }>(
        `/sections/${sectionId}/ingest_notes/`,
        { method: "POST", body: JSON.stringify(opts) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["knowledge-units", { section: sectionId }],
      });
      qc.invalidateQueries({ queryKey: ["sections"] });
    },
  });
}

export function useGenerateSectionItems(sectionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { regenerate?: boolean } = {}) =>
      request<{
        generated: number;
        generated_ku_ids: number[];
        skipped: number;
        errors: { ku_id: number; message: string }[];
      }>(`/sections/${sectionId}/generate_items/`, {
        method: "POST",
        body: JSON.stringify(opts),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-units"] });
      qc.invalidateQueries({ queryKey: ["study-items"] });
    },
  });
}

export function useDeleteKnowledgeUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<void>(`/knowledge-units/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-units"] }),
  });
}

// ----- Study Items -----

export function useStudyItems(knowledgeUnitId: number | undefined) {
  return useQuery({
    queryKey: ["study-items", { ku: knowledgeUnitId }],
    queryFn: () =>
      request<StudyItem[]>(`/study-items/?knowledge_unit=${knowledgeUnitId}`),
    enabled: knowledgeUnitId !== undefined,
  });
}

export function useGenerateItems(knowledgeUnitId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ created: StudyItem[] }>(
        `/knowledge-units/${knowledgeUnitId}/generate_items/`,
        { method: "POST", body: "{}" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["study-items", { ku: knowledgeUnitId }],
      });
      qc.invalidateQueries({ queryKey: ["knowledge-units"] });
    },
  });
}

export function useDeleteStudyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<void>(`/study-items/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-items"] });
      qc.invalidateQueries({ queryKey: ["knowledge-units"] });
    },
  });
}

export function useSectionStudyItems(sectionId: number | undefined) {
  return useQuery({
    queryKey: ["study-items", { section: sectionId }],
    queryFn: () => request<StudyItem[]>(`/study-items/?section=${sectionId}`),
    enabled: sectionId !== undefined,
  });
}

export function useCourseStudyItems(courseId: number | undefined) {
  return useQuery({
    queryKey: ["study-items", { course: courseId }],
    queryFn: () => request<StudyItem[]>(`/study-items/?course=${courseId}`),
    enabled: courseId !== undefined,
  });
}

// ----- Review Logs -----

export function useCreateReviewLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { study_item: number; was_correct: boolean; user_rating?: number; response_time_ms?: number }) =>
      request<ReviewLog>("/review-logs/", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-logs"] });
    },
  });
}
