// Services API pour les modules/cours (instructeur/admin)
// Sécurité: appels via instance Axios `api` avec intercepteur JWT.
// Validation: schémas Zod exportés pour réutilisation côté UI.
// Commentaires en français conformément aux règles du projet.

import api from './api';
import { z } from 'zod';

// --- Types côté backend (shape des documents)
export type BackendCourse = {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  isPublished?: boolean;
};

// --- Types côté frontend
export type Course = {
  id: string;
  title: string;
  description: string;
  isPublished: boolean;
};

// --- Schémas de validation Zod
export const CourseCreateSchema = z.object({
  title: z.string().min(3, 'Titre trop court').max(100, 'Titre trop long'),
  description: z.string().min(10, 'Description trop courte'),
  isPublished: z.boolean().optional().default(false),
});
export type CourseCreate = z.infer<typeof CourseCreateSchema>;

export const CourseUpdateSchema = CourseCreateSchema.partial();
export type CourseUpdate = z.infer<typeof CourseUpdateSchema>;

// --- Helpers
const mapCourse = (c: BackendCourse): Course | null => ({
  id: c._id ?? c.id ?? '',
  title: c.title,
  description: c.description,
  isPublished: !!c.isPublished,
});

// --- Services
export async function listCourses(): Promise<Course[]> {
  const { data } = await api.get('/modules');
  const arr = Array.isArray(data?.data) ? (data.data as BackendCourse[]) : [];
  return arr.map(mapCourse).filter((c): c is Course => !!c && !!c.id);
}

export async function getCourse(id: string): Promise<Course> {
  const { data } = await api.get(`/modules/${id}`);
  const mapped = mapCourse(data?.data as BackendCourse);
  if (!mapped || !mapped.id) throw new Error('Course not found');
  return mapped;
}

export async function createCourse(payload: CourseCreate): Promise<Course> {
  const body = CourseCreateSchema.parse(payload);
  const { data } = await api.post('/modules', body);
  const mapped = mapCourse(data?.data as BackendCourse);
  if (!mapped || !mapped.id) throw new Error('Création du module: réponse invalide');
  return mapped;
}

export async function updateCourse(id: string, payload: CourseUpdate): Promise<Course> {
  const body = CourseUpdateSchema.parse(payload);
  const { data } = await api.put(`/modules/${id}`, body);
  const mapped = mapCourse(data?.data as BackendCourse);
  if (!mapped || !mapped.id) throw new Error('Mise à jour du module: réponse invalide');
  return mapped;
}

export async function deleteCourse(id: string): Promise<void> {
  await api.delete(`/modules/${id}`);
}
