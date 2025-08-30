// Page instructeur: gestion du QCM d'une leçon (création du quiz, questions, réponses)
// Sécurité: routes protégées par JWT et RBAC; aucune donnée sensible affichée.
// Remarque: le GET public du quiz masque isCorrect; pour la gestion, on récupère les réponses via /questions/:id/answers.

import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import QuizzesService, { type Quiz, type ManageQuestion, type ManageAnswer } from '../services/quizzes';
import { isAxiosError } from 'axios';

// Schéma création du quiz
const quizSchema = z.object({
  title: z.string().min(3, 'Titre trop court').max(120, 'Titre trop long'),
  passingScore: z.coerce.number().int().min(0).max(100),
});

type QuizForm = z.infer<typeof quizSchema>;

// Schéma ajout question
const questionSchema = z.object({
  text: z.string().min(3, 'Question trop courte').max(500, 'Question trop longue'),
});

type QuestionForm = z.infer<typeof questionSchema>;

// Schéma ajout réponse
const answerSchema = z.object({
  text: z.string().min(1, 'Texte requis').max(300, 'Texte trop long'),
  isCorrect: z.boolean().default(false),
});

type AnswerForm = z.infer<typeof answerSchema>;

// Petit composant de formulaire pour ajouter une réponse à une question
const AddAnswerForm = ({
  questionId,
  onAdded,
}: {
  questionId: string;
  onAdded: (created: ManageAnswer) => void;
}) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<AnswerForm>({
    resolver: zodResolver(answerSchema),
    defaultValues: { text: '', isCorrect: false },
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (vals: AnswerForm) => {
    try {
      setSubmitting(true);
      const created = await QuizzesService.addAnswer(questionId, { text: vals.text.trim(), isCorrect: vals.isCorrect });
      onAdded(created);
      reset({ text: '', isCorrect: false });
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? "Impossible d'ajouter la réponse");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Nouvelle réponse" {...register('text')} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" {...register('isCorrect')} /> Bonne réponse
        </label>
        <button type="submit" disabled={submitting}>{submitting ? 'Ajout…' : '+ Ajouter'}</button>
      </div>
      {(errors.text || errors.isCorrect) && (
        <div style={{ color: 'crimson', marginTop: 4 }}>
          {errors.text?.message ?? errors.isCorrect?.message}
        </div>
      )}
    </form>
  );
};

// Type d'affichage combiné pour gestion
type ManagedQuestion = ManageQuestion & { answers: ManageAnswer[] };

// Élément triable pour une question, avec poignée et contenu d'édition
function SortableQuestionItem({
  q,
  editingQuestionId,
  editingQuestionText,
  onStartEditQuestion,
  onSaveEditQuestion,
  onCancelEditQuestion,
  onRemoveQuestion,
  editingAnswerId,
  editingAnswerDraft,
  onStartEditAnswer,
  onSaveEditAnswer,
  onCancelEditAnswer,
  onRemoveAnswer,
  onAnswerAdded,
}: {
  q: ManagedQuestion;
  editingQuestionId: string | null;
  editingQuestionText: string;
  onStartEditQuestion: (q: ManagedQuestion) => void;
  onSaveEditQuestion: () => void;
  onCancelEditQuestion: () => void;
  onRemoveQuestion: (id: string) => void;
  editingAnswerId: string | null;
  editingAnswerDraft: { text: string; isCorrect: boolean };
  onStartEditAnswer: (a: ManageAnswer) => void;
  onSaveEditAnswer: (answerId: string, parentQuestionId: string) => void;
  onCancelEditAnswer: () => void;
  onRemoveAnswer: (answerId: string, parentQuestionId: string) => void;
  onAnswerAdded: (created: ManageAnswer) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q._id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '0.75rem',
    background: '#fff',
  };
  return (
    <li ref={setNodeRef} style={style}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          title="Glisser pour réordonner"
          style={{ cursor: 'grab', userSelect: 'none', fontSize: 18, color: '#64748b', background: 'transparent', border: 'none', padding: 0 }}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          {editingQuestionId === q._id ? (
            <input
              type="text"
              value={editingQuestionText}
              onChange={(e) => (onStartEditQuestion({ ...q, text: e.target.value } as ManagedQuestion))}
              style={{ width: '100%' }}
            />
          ) : (
            q.text
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editingQuestionId === q._id ? (
            <>
              <button type="button" onClick={onSaveEditQuestion}>Enregistrer</button>
              <button type="button" onClick={onCancelEditQuestion}>Annuler</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onStartEditQuestion(q)}>Modifier</button>
              <button type="button" className="btn btn-danger" onClick={() => onRemoveQuestion(q._id)}>Supprimer</button>
            </>
          )}
        </div>
      </div>

      <div style={{ margin: '0.5rem 0' }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Réponses</div>
        {q.answers.length === 0 ? (
          <div>—</div>
        ) : (
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {q.answers.map((a) => (
              <li key={a._id} style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {editingAnswerId === a._id ? (
                  <>
                    <input
                      type="text"
                      value={editingAnswerDraft.text}
                      onChange={(e) => onStartEditAnswer({ ...a, text: e.target.value })}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={editingAnswerDraft.isCorrect}
                        onChange={(e) => onStartEditAnswer({ ...a, isCorrect: e.target.checked })}
                      /> Bonne réponse
                    </label>
                    <button type="button" onClick={() => onSaveEditAnswer(a._id, q._id)}>Enregistrer</button>
                    <button type="button" onClick={onCancelEditAnswer}>Annuler</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: a.isCorrect ? 700 : 400 }}>
                      {a.text}
                    </span>
                    {a.isCorrect && <span style={{ color: 'green', marginLeft: 6 }}>(correct)</span>}
                    <button type="button" onClick={() => onStartEditAnswer(a)}>Modifier</button>
                    <button type="button" className="btn btn-danger" onClick={() => onRemoveAnswer(a._id, q._id)}>Supprimer</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddAnswerForm
        questionId={q._id}
        onAdded={onAnswerAdded}
      />
    </li>
  );
}

const InstructorLessonQuizPage = () => {
  const { lessonId } = useParams<{ lessonId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<ManagedQuestion[]>([]);
  const [addingQuestionForQuiz, setAddingQuestionForQuiz] = useState(false);

  // Etats d'édition (questions)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');

  // Etats d'édition (réponses)
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editingAnswerDraft, setEditingAnswerDraft] = useState<{ text: string; isCorrect: boolean }>({ text: '', isCorrect: false });

  // Formulaires
  const { register: regQuiz, handleSubmit: handleQuizSubmit, formState: { errors: quizErrors }, reset: resetQuizForm } = useForm<QuizForm>({
    resolver: zodResolver(quizSchema),
    defaultValues: { title: '', passingScore: 70 },
  });

  const { register: regQuestion, handleSubmit: handleQuestionSubmit, formState: { errors: questionErrors }, reset: resetQuestionForm } = useForm<QuestionForm>({
    resolver: zodResolver(questionSchema),
    defaultValues: { text: '' },
  });

  // (supprimé) Formulaire partagé des réponses → déplacé dans AddAnswerForm pour éviter le bug "Expected boolean, received array"


  const loadAll = async () => {
    if (!lessonId) return;
    setError(null);
    setQuestions([]);
    try {
      // Tente de charger le quiz (GET /lessons/:lessonId/quiz)
      const q = await QuizzesService.getQuizForLesson(lessonId);
      setQuiz(q);

      // Charge les questions (gestion)
      const qs = await QuizzesService.getQuestions(q._id);

      // Pour chaque question, charger les réponses (gestion) incluant isCorrect
      const withAnswers: ManagedQuestion[] = [];
      for (const it of qs) {
        const ans = await QuizzesService.getAnswers(it._id);
        withAnswers.push({ ...it, answers: ans });
      }
      setQuestions(withAnswers);
    } catch (err: unknown) {
      // Si 404 quiz introuvable sur la leçon → état "pas de quiz"
      if (isAxiosError(err) && err.response?.status === 404) {
        setQuiz(null);
        setQuestions([]);
      } else {
        const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
        setError(msg ?? "Erreur lors du chargement du QCM");
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // Créer le quiz
  const onCreateQuiz = async (vals: QuizForm) => {
    if (!lessonId) return;
    try {
      await QuizzesService.createQuizForLesson(lessonId, {
        title: vals.title.trim(),
        passingScore: vals.passingScore,
      });
      resetQuizForm({ title: '', passingScore: 70 });
      await loadAll();
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de créer le quiz');
    }
  };

  // Ajouter une question
  const onAddQuestion = async (vals: QuestionForm) => {
    if (!quiz?._id) return;
    try {
      setAddingQuestionForQuiz(true);
      const q = await QuizzesService.addQuestion(quiz._id, { text: vals.text.trim() });
      resetQuestionForm({ text: '' });
      // Charger ses réponses (vide au départ)
      setQuestions((prev) => [...prev, { ...q, answers: [] }]);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible d\'ajouter la question');
    } finally {
      setAddingQuestionForQuiz(false);
    }
  };

  // Edition question
  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setEditingQuestionText('');
  };
  const saveEditQuestion = async () => {
    if (!editingQuestionId) return;
    const text = editingQuestionText.trim();
    if (text.length < 3) return alert('Question trop courte');
    try {
      const updated = await QuizzesService.updateQuestion(editingQuestionId, { text });
      setQuestions((prev) => prev.map((q) => q._id === updated._id ? { ...q, text: updated.text } : q));
      cancelEditQuestion();
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de modifier la question');
    }
  };
  const removeQuestion = async (id: string) => {
    if (!confirm('Supprimer cette question et ses réponses ?')) return;
    try {
      await QuizzesService.deleteQuestion(id);
      setQuestions((prev) => prev.filter((q) => q._id !== id));
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de supprimer la question');
    }
  };

  // Edition réponse
  const startEditAnswer = (a: ManageAnswer) => {
    setEditingAnswerId(a._id);
    setEditingAnswerDraft({ text: a.text, isCorrect: a.isCorrect });
  };
  const cancelEditAnswer = () => {
    setEditingAnswerId(null);
    setEditingAnswerDraft({ text: '', isCorrect: false });
  };
  const saveEditAnswer = async (answerId: string, parentQuestionId: string) => {
    try {
      const updated = await QuizzesService.updateAnswer(answerId, { text: editingAnswerDraft.text.trim(), isCorrect: editingAnswerDraft.isCorrect });
      setQuestions((prev) => prev.map((q) => q._id === parentQuestionId
        ? { ...q, answers: q.answers.map((a) => a._id === updated._id ? updated : a) }
        : q
      ));
      cancelEditAnswer();
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de modifier la réponse');
    }
  };
  const removeAnswer = async (answerId: string, parentQuestionId: string) => {
    if (!confirm('Supprimer cette réponse ?')) return;
    try {
      await QuizzesService.deleteAnswer(answerId);
      setQuestions((prev) => prev.map((q) => q._id === parentQuestionId
        ? { ...q, answers: q.answers.filter((a) => a._id !== answerId) }
        : q
      ));
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Impossible de supprimer la réponse');
    }
  };

  // dnd-kit sensors: activer le drag après un léger mouvement
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // DnD: réordonnancement optimiste puis persistance côté serveur
  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q._id === String(active.id));
    const newIndex = questions.findIndex((q) => q._id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const prev = questions;
    const nextArr = arrayMove(prev, oldIndex, newIndex);
    setQuestions(nextArr);
    if (!quiz?._id) return;
    try {
      await QuizzesService.reorderQuestions(quiz._id, nextArr.map((q) => q._id));
      // Option: toast succès (si provider)
    } catch (err: unknown) {
      // rollback si échec
      setQuestions(prev);
      const msg = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
      alert(msg ?? 'Réordonnancement impossible');
    }
  };

  if (loading) return <div>Chargement du QCM…</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div className="container" style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={-1 as unknown as string}>← Retour</Link>
      </div>
      <h2 style={{ marginTop: 0 }}>Gestion du QCM de la leçon</h2>

      {quiz ? (
        <>
          <section className="tile" style={{ margin: '1rem 0' }}>
            <h3 style={{ marginTop: 0 }}>Quiz</h3>
            <div style={{ fontSize: 14, color: '#475569' }}>
              <div><strong>Titre:</strong> {quiz.title ?? '—'}</div>
              <div><strong>Score requis:</strong> {quiz.passingScore}%</div>
            </div>
          </section>

          <section className="tile" style={{ margin: '1rem 0' }}>
            <h3 style={{ marginTop: 0 }}>Ajouter une question</h3>
            <form onSubmit={handleQuestionSubmit(onAddQuestion)}>
              <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
                <label>
                  <div>Intitulé</div>
                  <input type="text" placeholder="Saisir la question" {...regQuestion('text')} />
                  {questionErrors.text && <div style={{ color: 'crimson' }}>{questionErrors.text.message}</div>}
                </label>
                <div>
                  <button type="submit" disabled={addingQuestionForQuiz}>{addingQuestionForQuiz ? 'Ajout…' : '+ Ajouter la question'}</button>
                </div>
              </div>
            </form>
          </section>

          <section className="tile" style={{ margin: '1rem 0' }}>
            {questions.length === 0 ? (
              <div>Aucune question pour le moment.</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={questions.map((q) => q._id)} strategy={verticalListSortingStrategy}>
                  <ul style={{ padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
                    {questions.map((q) => (
                      <SortableQuestionItem
                        key={q._id}
                        q={q}
                        editingQuestionId={editingQuestionId}
                        editingQuestionText={editingQuestionText}
                        onStartEditQuestion={(qq) => {
                          // si on modifie le texte inline, mettre à jour l'état local d'édition
                          if (editingQuestionId === qq._id) {
                            // mise à jour du draft
                            setEditingQuestionText(qq.text);
                          } else {
                            // démarrer l'édition
                            setEditingQuestionId(qq._id);
                            setEditingQuestionText(qq.text);
                          }
                        }}
                        onSaveEditQuestion={saveEditQuestion}
                        onCancelEditQuestion={cancelEditQuestion}
                        onRemoveQuestion={removeQuestion}
                        editingAnswerId={editingAnswerId}
                        editingAnswerDraft={editingAnswerDraft}
                        onStartEditAnswer={(a) => {
                          if (editingAnswerId === a._id) {
                            setEditingAnswerDraft({ text: a.text, isCorrect: a.isCorrect });
                          } else {
                            startEditAnswer(a);
                          }
                        }}
                        onSaveEditAnswer={saveEditAnswer}
                        onCancelEditAnswer={cancelEditAnswer}
                        onRemoveAnswer={removeAnswer}
                        onAnswerAdded={(created) => setQuestions((prev) => prev.map((qq) => qq._id === q._id ? { ...qq, answers: [...qq.answers, created] } : qq))}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </section>
        </>
      ) : (
        <section className="tile" style={{ margin: '1rem 0' }}>
          <h3 style={{ marginTop: 0 }}>Créer le quiz</h3>
          <form onSubmit={handleQuizSubmit(onCreateQuiz)}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
              <label>
                <div>Titre</div>
                <input type="text" placeholder="Ex: Règles de base" {...regQuiz('title')} />
                {quizErrors.title && <div style={{ color: 'crimson' }}>{quizErrors.title.message}</div>}
              </label>
              <label>
                <div>Score de réussite (0-100)</div>
                <input type="number" min={0} max={100} step={1} {...regQuiz('passingScore', { valueAsNumber: true })} />
                {quizErrors.passingScore && <div style={{ color: 'crimson' }}>{quizErrors.passingScore.message}</div>}
              </label>
              <div>
                <button type="submit">+ Créer le quiz</button>
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};

export default InstructorLessonQuizPage;
