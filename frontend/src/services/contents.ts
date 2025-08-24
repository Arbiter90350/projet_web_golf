// Services API pour les contenus d'une leçon (instructeur/admin)
// Endpoints: list/create sous /lessons/:lessonId/contents, update/delete via /contents/:id
// Zod pour validations côté UI.

import api from './api';
import { z } from 'zod';

// --- Types backend
export type BackendContent = {
  _id?: string;
  id?: string;
  contentType: 'video' | 'pdf' | 'doc';
  url: string;
};

// --- Types frontend
export type ContentItem = {
  id: string;
  contentType: 'video' | 'pdf' | 'doc';
  url: string;
};

// --- Schémas Zod
export const ContentCreateSchema = z.object({
  contentType: z.enum(['video', 'pdf', 'doc']),
  url: z.string().url('URL invalide (https://...)'),
});
export type ContentCreate = z.infer<typeof ContentCreateSchema>;

export const ContentUpdateSchema = ContentCreateSchema.partial();
export type ContentUpdate = z.infer<typeof ContentUpdateSchema>;

// --- Helpers
const mapContent = (c: BackendContent): ContentItem | null => ({
  id: c._id ?? c.id ?? '',
  contentType: c.contentType,
  url: c.url,
});

// --- Services
export async function listContents(lessonId: string): Promise<ContentItem[]> {
  const { data } = await api.get(`/lessons/${lessonId}/contents`);
  const arr = Array.isArray(data?.data) ? (data.data as BackendContent[]) : [];
  return arr.map(mapContent).filter((c): c is ContentItem => !!c && !!c.id);
}

export async function createContent(lessonId: string, payload: ContentCreate): Promise<ContentItem> {
  const body = ContentCreateSchema.parse(payload);
  const { data } = await api.post(`/lessons/${lessonId}/contents`, body);
  const mapped = mapContent(data?.data as BackendContent);
  if (!mapped || !mapped.id) throw new Error('Création du contenu: réponse invalide');
  return mapped;
}

export async function updateContent(contentId: string, payload: ContentUpdate): Promise<ContentItem> {
  const body = ContentUpdateSchema.parse(payload);
  const { data } = await api.put(`/contents/${contentId}`, body);
  const mapped = mapContent(data?.data as BackendContent);
  if (!mapped || !mapped.id) throw new Error('Mise à jour du contenu: réponse invalide');
  return mapped;
}

export async function deleteContent(contentId: string): Promise<void> {
  await api.delete(`/contents/${contentId}`);
}
