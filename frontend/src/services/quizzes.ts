import api from './api';

// Types quiz minimalistes pour le FE
export interface QuizAnswerOption {
  _id: string;
  text: string;
  // isCorrect n'est jamais exposé au FE via getQuizForLesson (sécurité)
}

export interface QuizQuestion {
  _id: string;
  text: string;
  answers?: QuizAnswerOption[];
}

export interface Quiz {
  _id: string;
  title?: string;
  lesson: string; // ObjectId as string
  passingScore: number; // pourcentage requis pour valider
  questions: QuizQuestion[];
}

export interface SubmitAnswerItem {
  questionId: string;
  answerIds: string[]; // multi-réponses possibles
}

export interface SubmitQuizResult {
  score: number; // 0..100
  passed: boolean;
  userProgress: {
    _id?: string;
    user: string;
    lesson: string;
    status: 'not_started' | 'in_progress' | 'completed';
    score?: number;
    completedAt?: string;
  };
}

// Types de gestion (instructeur/admin) — incluent isCorrect
export interface ManageQuestion {
  _id: string;
  text: string;
  quiz: string;
}

export interface ManageAnswer {
  _id: string;
  text: string;
  isCorrect: boolean;
  question: string;
}

export interface CreateQuizPayload {
  title?: string;
  passingScore: number;
}

const QuizzesService = {
  // Récupère le quiz d'une leçon. Backend: GET /lessons/:lessonId/quiz
  async getQuizForLesson(lessonId: string) {
    const { data } = await api.get<{ status: string; data: Quiz }>(`/lessons/${lessonId}/quiz`);
    return data.data;
  },

  // Soumet les réponses d'un quiz. Backend: POST /quizzes/:id/submit
  async submitQuiz(quizId: string, answers: SubmitAnswerItem[]) {
    const { data } = await api.post<{ status: string; data: SubmitQuizResult }>(
      `/quizzes/${quizId}/submit`,
      { answers }
    );
    return data.data;
  },

  // Création d'un quiz pour une leçon. Backend: POST /lessons/:lessonId/quiz
  async createQuizForLesson(lessonId: string, payload: CreateQuizPayload) {
    const { data } = await api.post<{ status: string; data: Quiz }>(
      `/lessons/${lessonId}/quiz`,
      payload
    );
    return data.data;
  },

  // Questions d'un quiz (gestion). Backend: GET /quizzes/:quizId/questions
  async getQuestions(quizId: string) {
    const { data } = await api.get<{ status: string; data: ManageQuestion[] }>(
      `/quizzes/${quizId}/questions`
    );
    return data.data;
  },

  // Ajout d'une question. Backend: POST /quizzes/:quizId/questions
  async addQuestion(quizId: string, payload: { text: string }) {
    const { data } = await api.post<{ status: string; data: ManageQuestion }>(
      `/quizzes/${quizId}/questions`,
      payload
    );
    return data.data;
  },

  // Met à jour une question. Backend: PUT /questions/:questionId
  async updateQuestion(questionId: string, payload: { text: string }) {
    const { data } = await api.put<{ status: string; data: ManageQuestion }>(
      `/questions/${questionId}`,
      payload
    );
    return data.data;
  },

  // Supprime une question. Backend: DELETE /questions/:questionId
  async deleteQuestion(questionId: string) {
    const { data } = await api.delete<{ status: string; data: unknown }>(
      `/questions/${questionId}`
    );
    return data.status === 'success';
  },

  // Réponses d'une question (gestion). Backend: GET /questions/:questionId/answers
  async getAnswers(questionId: string) {
    const { data } = await api.get<{ status: string; data: ManageAnswer[] }>(
      `/questions/${questionId}/answers`
    );
    return data.data;
  },

  // Ajout d'une réponse. Backend: POST /questions/:questionId/answers
  async addAnswer(questionId: string, payload: { text: string; isCorrect: boolean }) {
    const { data } = await api.post<{ status: string; data: ManageAnswer }>(
      `/questions/${questionId}/answers`,
      payload
    );
    return data.data;
  },

  // Met à jour une réponse. Backend: PUT /answers/:answerId
  async updateAnswer(answerId: string, payload: { text: string; isCorrect: boolean }) {
    const { data } = await api.put<{ status: string; data: ManageAnswer }>(
      `/answers/${answerId}`,
      payload
    );
    return data.data;
  },

  // Supprime une réponse. Backend: DELETE /answers/:answerId
  async deleteAnswer(answerId: string) {
    const { data } = await api.delete<{ status: string; data: unknown }>(
      `/answers/${answerId}`
    );
    return data.status === 'success';
  },
};

export default QuizzesService;
