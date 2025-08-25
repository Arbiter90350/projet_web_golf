import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import QuizzesService, { type Quiz, type SubmitAnswerItem } from '../services/quizzes';

// Page de QCM minimaliste (joueur)
// - Récupère le quiz d'une leçon
// - Affiche les questions et réponses (choix multiples)
// - Soumet les réponses et affiche le score/résultat
const QuizPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [score, setScore] = useState<number | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);

  // Nombre total de questions
  const totalQuestions = useMemo(() => quiz?.questions?.length ?? 0, [quiz]);

  useEffect(() => {
    if (!lessonId) return;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const q = await QuizzesService.getQuizForLesson(lessonId);
        setQuiz(q);
        // Initialise l'état des réponses sélectionnées
        const initial: Record<string, Set<string>> = {};
        for (const question of q.questions || []) {
          initial[question._id] = new Set<string>();
        }
        setSelected(initial);
      } catch (err: unknown) {
        const fallback = t('quiz.error_loading');
        if (isAxiosError(err)) {
          const msg = (err.response?.data as { message?: string } | undefined)?.message;
          setError(msg ?? fallback);
        } else {
          setError(fallback);
        }
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [lessonId, t]);

  const toggleAnswer = (questionId: string, answerId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[questionId] ?? []);
      if (set.has(answerId)) {
        set.delete(answerId);
      } else {
        set.add(answerId);
      }
      next[questionId] = set;
      return next;
    });
  };

  const onSubmit = async () => {
    if (!quiz) return;
    try {
      setSubmitting(true);
      setError(null);
      const payload: SubmitAnswerItem[] = quiz.questions.map((q) => ({
        questionId: q._id,
        answerIds: Array.from(selected[q._id] ?? new Set<string>()),
      }));
      const result = await QuizzesService.submitQuiz(quiz._id, payload);
      setScore(result.score);
      setPassed(result.passed);
    } catch (err: unknown) {
      const fallback = t('quiz.error_submit');
      if (isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string } | undefined)?.message;
        setError(msg ?? fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>{t('quiz.loading')}</div>;
  if (error) return (
    <div>
      <div style={{ color: 'crimson' }}>{error}</div>
      <button onClick={() => navigate(-1)} className="btn" style={{ marginTop: 8 }}>{t('quiz.back')}</button>
    </div>
  );
  if (!quiz) return (
    <div>
      <div>{t('quiz.no_quiz')}</div>
      <button onClick={() => navigate(-1)} className="btn" style={{ marginTop: 8 }}>{t('quiz.back')}</button>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => navigate(-1)} className="btn">← {t('quiz.back')}</button>
      </div>
      <h2>{quiz.title || t('quiz.title')}</h2>
      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        {t('quiz.passing_score', { score: quiz.passingScore })}
      </div>

      {/* Affiche le résultat si déjà disponible */}
      {score !== null && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <strong>{t('quiz.your_score', { score })}</strong>
            <span style={{ color: passed ? 'green' : 'crimson' }}>
              {passed ? t('quiz.passed') : t('quiz.failed')}
            </span>
          </div>
        </div>
      )}

      {/* Questions */}
      <div style={{ display: 'grid', gap: 16 }}>
        {quiz.questions.map((q, idx) => (
          <div className="card" key={q._id}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {t('quiz.question_label', { index: idx + 1, total: totalQuestions })} — {q.text}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {(q.answers || []).map((a) => (
                <label key={a._id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selected[q._id]?.has(a._id) ?? false}
                    onChange={() => toggleAnswer(q._id, a._id)}
                  />
                  <span>{a.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Boutons d'action */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onSubmit} className="btn btn-primary" disabled={submitting}>
          {submitting ? t('quiz.submitting') : t('quiz.submit')}
        </button>
        <Link to={"/courses"} className="btn">{t('quiz.back_to_courses')}</Link>
      </div>
    </div>
  );
};

export default QuizPage;
