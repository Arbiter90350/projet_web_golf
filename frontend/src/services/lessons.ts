// Services API pour les leçons d'un cours (instructeur/admin)
// Les endpoints sont protégés par JWT (intercepteur Axios).
// Validations: schémas Zod exportés.

import api from './api';
import { z } from 'zod';

// --- Types backend
export type BackendLesson = {
  _id?: string;
  id?: string;
  title: string;
  order: number;
  validationMode: 'read' | 'pro' | 'qcm';
  description?: string;
};

// --- Types frontend
export type Lesson = {
  id: string;
  title: string;
  order: number;
  validationMode: 'read' | 'pro' | 'qcm';
  description?: string;
};

// --- Schémas
export const LessonCreateSchema = z.object({
  title: z.string().min(3, 'Titre trop court'),
  validationMode: z.enum(['read', 'pro', 'qcm']).default('read'),
  description: z.string().optional(),
});
export type LessonCreate = z.infer<typeof LessonCreateSchema>;

// Pour update, l'ordre n'est pas modifiable côté client (endpoint dédié)
export const LessonUpdateSchema = z.object({
  title: z.string().min(3, 'Titre trop court').optional(),
  validationMode: z.enum(['read', 'pro', 'qcm']).optional(),
  description: z.string().optional(),
});
export type LessonUpdate = z.infer<typeof LessonUpdateSchema>;

// --- Helpers
const mapLesson = (l: BackendLesson): Lesson | null => ({
  id: l._id ?? l.id ?? '',
  title: l.title,
  order: l.order,
  validationMode: l.validationMode,
  description: l.description,
});

// --- Services
export async function listLessons(courseId: string): Promise<Lesson[]> {
  const { data } = await api.get(`/courses/${courseId}/lessons`);
  const arr = Array.isArray(data?.data) ? (data.data as BackendLesson[]) : [];
  return arr.map(mapLesson).filter((l): l is Lesson => !!l && !!l.id);
}

export async function createLesson(courseId: string, payload: LessonCreate): Promise<Lesson> {
  const body = LessonCreateSchema.parse(payload);
  const { data } = await api.post(`/courses/${courseId}/lessons`, body);
  const mapped = mapLesson(data?.data as BackendLesson);
  if (!mapped || !mapped.id) throw new Error('Création de la leçon: réponse invalide');
  return mapped;
}

export async function updateLesson(lessonId: string, payload: LessonUpdate): Promise<Lesson> {
  const body = LessonUpdateSchema.parse(payload);
  const { data } = await api.put(`/lessons/${lessonId}`, body);
  const mapped = mapLesson(data?.data as BackendLesson);
  if (!mapped || !mapped.id) throw new Error('Mise à jour de la leçon: réponse invalide');
  return mapped;
}

export async function deleteLesson(lessonId: string): Promise<void> {
  await api.delete(`/lessons/${lessonId}`);
}

// Réordonnancement des leçons pour un cours
export async function reorderLessons(courseId: string, orderedIds: string[]): Promise<Lesson[]> {
  const { data } = await api.patch(`/courses/${courseId}/lessons/reorder`, { orderedIds });
  const arr = Array.isArray(data?.data) ? (data.data as BackendLesson[]) : [];
  return arr.map(mapLesson).filter((l): l is Lesson => !!l && !!l.id);
}
