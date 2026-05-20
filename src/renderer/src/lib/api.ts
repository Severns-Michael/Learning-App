import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { Course, KnowledgeUnit, Section } from "./types";

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
    mutationFn: (text: string) =>
      request<{ created: KnowledgeUnit[] }>(
        `/sections/${sectionId}/ingest_notes/`,
        { method: "POST", body: JSON.stringify({ text }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-units", { section: sectionId }] });
      qc.invalidateQueries({ queryKey: ["sections", { course: undefined }] });
      qc.invalidateQueries({ queryKey: ["sections", sectionId] });
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
