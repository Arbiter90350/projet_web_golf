const Quiz = require('../models/Quiz');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const UserProgress = require('../models/UserProgress');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const MAX_TIME_MS = Number(process.env.DB_QUERY_MAX_TIME_MS || 15000);

// @desc    Get quiz for a specific lesson
// @route   GET /api/v1/lessons/:lessonId/quiz
// @access  Private
exports.getQuizForLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.lessonId).maxTimeMS(MAX_TIME_MS);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    const baseQuiz = await Quiz.findOne({ lesson: req.params.lessonId }).maxTimeMS(MAX_TIME_MS);
    if (!baseQuiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found for this lesson' });
    }

    // Robust assembly that does not rely on possibly missing refs in Question.answers
    // 1) Fetch all questions by quiz
    const questions = await Question.find({ quiz: baseQuiz._id }).maxTimeMS(MAX_TIME_MS).lean();
    // 2) Fetch all answers for these questions using Answer.question
    const questionIds = questions.map((q) => q._id);
    const allAnswers = questionIds.length > 0
      ? await Answer.find({ question: { $in: questionIds } }).select('text question').maxTimeMS(MAX_TIME_MS).lean()
      : [];
    const answersByQuestion = new Map();
    for (const ans of allAnswers) {
      const key = ans.question.toString();
      if (!answersByQuestion.has(key)) answersByQuestion.set(key, []);
      // Expose only safe fields to the player (no isCorrect)
      answersByQuestion.get(key).push({ _id: ans._id, text: ans.text });
    }
    // Ordonner selon l'ordre des ObjectIds dans quiz.questions si présent
    const byId = new Map(questions.map((q) => [q._id.toString(), q]));
    const orderedQuestionIds = Array.isArray(baseQuiz.questions) && baseQuiz.questions.length > 0
      ? baseQuiz.questions.map((id) => id.toString()).filter((id) => byId.has(id))
      : questions.map((q) => q._id.toString());
    const questionsWithAnswers = orderedQuestionIds.map((id) => {
      const q = byId.get(id);
      return {
        _id: q._id,
        text: q.text,
        answers: answersByQuestion.get(q._id.toString()) || []
      };
    });

    const quizPayload = {
      _id: baseQuiz._id,
      title: baseQuiz.title,
      passingScore: baseQuiz.passingScore,
      lesson: baseQuiz.lesson,
      questions: questionsWithAnswers,
    };

    res.status(200).json({
      status: 'success',
      data: quizPayload
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder questions within a quiz by orderedIds
// @route   PATCH /api/v1/quizzes/:id/questions/reorder
// @access  Private (Instructor, Admin)
exports.reorderQuizQuestions = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate({ path: 'lesson', populate: { path: 'course' } }).maxTimeMS(MAX_TIME_MS);
    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    // Autorisation: propriétaire du cours ou admin
    if (quiz.lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to reorder questions for this quiz' });
    }

    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(String) : [];
    if (orderedIds.length === 0) {
      return res.status(400).json({ status: 'error', message: 'orderedIds is required' });
    }

    // Vérifier que toutes les IDs appartiennent au quiz
    const existingQuestions = await Question.find({ quiz: quiz._id }).select('_id').lean();
    const existingSet = new Set(existingQuestions.map((q) => q._id.toString()));

    // Filtrer aux IDs valides, puis vérifier qu'on a bien couvert toutes les questions existantes (même nombre)
    const filtered = orderedIds.filter((id) => existingSet.has(id));
    if (filtered.length !== existingSet.size) {
      return res.status(400).json({ status: 'error', message: 'orderedIds must include exactly all question ids for this quiz' });
    }

    // Persister l'ordre dans quiz.questions
    quiz.questions = filtered;
    await quiz.save();

    return res.status(200).json({ status: 'success', data: quiz.questions });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a quiz to a lesson
// @route   POST /api/v1/lessons/:lessonId/quiz
// @access  Private (Instructor, Admin)
exports.addQuiz = async (req, res, next) => {
  try {
    req.body.lesson = req.params.lessonId;

    const lesson = await Lesson.findById(req.params.lessonId).populate('course').maxTimeMS(MAX_TIME_MS);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    // Check if the user is the course owner or an admin
    if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to add a quiz to this lesson' });
    }

    const quiz = await Quiz.create(req.body);

    res.status(201).json({
      status: 'success',
      data: quiz
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a quiz
// @route   PUT /api/v1/quizzes/:id
// @access  Private (Instructor, Admin)
exports.updateQuiz = async (req, res, next) => {
  try {
    let quiz = await Quiz.findById(req.params.id).maxTimeMS(MAX_TIME_MS);

    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    const lesson = await Lesson.findById(quiz.lesson).populate('course').maxTimeMS(MAX_TIME_MS);

    // Check if the user is the course owner or an admin
    if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to update this quiz' });
    }

    quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).maxTimeMS(MAX_TIME_MS);

    res.status(200).json({
      status: 'success',
      data: quiz
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a quiz
// @route   DELETE /api/v1/quizzes/:id
// @access  Private (Instructor, Admin)
exports.deleteQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).maxTimeMS(MAX_TIME_MS);

    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    const lesson = await Lesson.findById(quiz.lesson).populate('course').maxTimeMS(MAX_TIME_MS);

    // Check if the user is an instructor or an admin
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to delete this quiz' });
    }

    await Quiz.deleteOne({ _id: quiz._id }).maxTimeMS(MAX_TIME_MS);

    res.status(200).json({
      status: 'success',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit answers for a quiz (multi-réponses)
// @route   POST /api/v1/quizzes/:id/submit
// @access  Private (Player)
exports.submitQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).maxTimeMS(MAX_TIME_MS);

    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    // Expected format: [{ questionId: '...', answerIds: ['...', ...] }]
    const userAnswers = Array.isArray(req.body.answers) ? req.body.answers : [];
    // Robust: always fetch questions by quiz id, then answers by Answer.question
    const questions = await Question.find({ quiz: quiz._id }).maxTimeMS(MAX_TIME_MS).lean();
    const questionIds = questions.map((q) => q._id);
    const allAnswers = questionIds.length > 0
      ? await Answer.find({ question: { $in: questionIds } }).select('isCorrect question').maxTimeMS(MAX_TIME_MS).lean()
      : [];
    const correctIdsByQuestion = new Map();
    for (const ans of allAnswers) {
      if (ans.isCorrect) {
        const key = ans.question.toString();
        if (!correctIdsByQuestion.has(key)) correctIdsByQuestion.set(key, []);
        correctIdsByQuestion.get(key).push(ans._id.toString());
      }
    }

    let correctAnswersCount = 0;
    questions.forEach((question) => {
      const userAnswer = userAnswers.find((ua) => ua.questionId === question._id.toString());
      const correctIds = (correctIdsByQuestion.get(question._id.toString()) || []).sort();
      const selectedIds = Array.isArray(userAnswer?.answerIds)
        ? userAnswer.answerIds.map(String).sort()
        : [];

      // Réponse juste si l'ensemble des réponses sélectionnées == ensemble des bonnes réponses
      const isCorrect = correctIds.length === selectedIds.length &&
        correctIds.every((id, idx) => id === selectedIds[idx]);

      if (isCorrect) correctAnswersCount++;
    });

    const total = questions.length;
    const score = total > 0
      ? (correctAnswersCount / total) * 100
      : 0;
    const passed = score >= quiz.passingScore;

    const progressData = {
      user: req.user.id,
      lesson: quiz.lesson,
      score,
      status: passed ? 'completed' : 'in_progress',
    };

    if (passed) {
      progressData.completedAt = Date.now();
    }

    const userProgress = await UserProgress.findOneAndUpdate(
      { user: req.user.id, lesson: quiz.lesson },
      progressData,
      { new: true, upsert: true, runValidators: true }
    ).maxTimeMS(MAX_TIME_MS);

    res.status(200).json({
      status: 'success',
      data: {
        score,
        passed,
        userProgress
      }
    });

  } catch (error) {
    next(error);
  }
};
