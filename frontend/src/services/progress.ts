import api from './api';

// Types minimalistes pour la progression utilisateur
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface UserProgressItem {
  _id?: string;
  user: string; // ObjectId as string
  lesson: string; // ObjectId as string
  status: ProgressStatus;
  score?: number; // pour les QCM
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Payload pour la validation par un instructeur
export interface ProValidatePayload {
  userId: string;
  status?: ProgressStatus;
  completed?: boolean;
}

// Représentation légère d'un joueur pour les vues instructeur
export interface PlayerLite {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive?: boolean;
  lastLogin?: string;
  assignedInstructor?: string;
}

// Forme retournée par le backend pour listMyPlayers
type BackendPlayerLite = {
  _id?: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive?: boolean;
  lastLogin?: string;
  assignedInstructor?: string;
};

// Service Progress — toutes les méthodes supposent un utilisateur authentifié (JWT via intercepteur)
const ProgressService = {
  // Récupère la progression de l'utilisateur courant (optionnel: filtrer par courseId)
  async getMyProgress(courseId?: string) {
    const params = courseId ? { courseId } : undefined;
    const { data } = await api.get<{ status: string; count: number; data: UserProgressItem[] }>(
      '/progress/me',
      { params }
    );
    return data.data;
  },

  // Marque une leçon comme lue (valide si validationMode === 'read' côté backend)
  async markLessonAsRead(lessonId: string) {
    const { data } = await api.patch<{ status: string; data: UserProgressItem }>(
      `/progress/lessons/${lessonId}/read`
    );
    return data.data;
  },

  // Valide/Dévalide une leçon pour un élève (rôle: instructor|admin)
  async proValidateLesson(lessonId: string, payload: ProValidatePayload) {
    const { data } = await api.patch<{ status: string; data: UserProgressItem }>(
      `/progress/lessons/${lessonId}/pro-validate`,
      payload
    );
    return data.data;
  },

  // Liste des joueurs assignés à l'instructeur connecté (admin: peut filtrer via ?instructorId=)
  async listAssignedPlayers(params?: { instructorId?: string }) {
    const { data } = await api.get<{ status: string; count: number; data: BackendPlayerLite[] }>(
      '/progress/players',
      { params }
    );
    const arr: BackendPlayerLite[] = Array.isArray(data?.data) ? data.data : [];
    const mapped: PlayerLite[] = arr
      .map((u): PlayerLite => ({
        id: (u._id || u.id || '') as string,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        isActive: u.isActive,
        lastLogin: u.lastLogin,
        assignedInstructor: u.assignedInstructor,
      }))
      .filter((u) => !!u.id);
    return mapped;
  },

  // Progression d'un joueur (restreint à l'instructeur assigné ou admin). Optionnel: filtrer par courseId
  async getPlayerProgress(userId: string, courseId?: string) {
    const params = courseId ? { courseId } : undefined;
    const { data } = await api.get<{ status: string; count: number; data: UserProgressItem[] }>(
      `/progress/players/${userId}`,
      { params }
    );
    return data.data;
  },
};

export default ProgressService;
