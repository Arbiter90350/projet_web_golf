const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const Answer = require('../models/Answer');

// @desc    Get all questions for a specific quiz
// @route   GET /api/v1/quizzes/:quizId/questions
// @access  Private
exports.getQuestions = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    const found = await Question.find({ quiz: req.params.quizId });
    // Ordonner selon l'ordre stocké dans quiz.questions si disponible
    const map = new Map(found.map((q) => [q._id.toString(), q]));
    const orderedIds = Array.isArray(quiz.questions) && quiz.questions.length > 0
      ? quiz.questions.map((id) => id.toString()).filter((id) => map.has(id))
      : found.map((q) => q._id.toString());
    const questions = orderedIds.map((id) => map.get(id));

    res.status(200).json({
      status: 'success',
      count: questions.length,
      data: questions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a question to a quiz
// @route   POST /api/v1/quizzes/:quizId/questions
// @access  Private (Instructor, Admin)
exports.addQuestion = async (req, res, next) => {
  try {
    req.body.quiz = req.params.quizId;

    const quiz = await Quiz.findById(req.params.quizId).populate({ path: 'lesson', populate: { path: 'course' } });
    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    // Check if the user is the course owner or an admin
    if (quiz.lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to add a question to this quiz' });
    }

    const question = await Question.create(req.body);

    // Keep quiz.questions in sync so player GET /lessons/:lessonId/quiz works with populate
    await Quiz.findByIdAndUpdate(req.params.quizId, { $addToSet: { questions: question._id } });

    res.status(201).json({
      status: 'success',
      data: question
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single question
// @route   GET /api/v1/questions/:id
// @access  Private
exports.getQuestion = async (req, res, next) => {
    try {
        const question = await Question.findById(req.params.id).populate({ path: 'quiz', select: 'title' });

        if (!question) {
            return res.status(404).json({ status: 'error', message: 'Question not found' });
        }

        res.status(200).json({
            status: 'success',
            data: question
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a question
// @route   PUT /api/v1/questions/:id
// @access  Private (Instructor, Admin)
exports.updateQuestion = async (req, res, next) => {
    try {
        let question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({ status: 'error', message: 'Question not found' });
        }

        const quiz = await Quiz.findById(question.quiz).populate({ path: 'lesson', populate: { path: 'course' } });

        // Check if the user is the course owner or an admin
        if (quiz.lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to update this question' });
        }

        question = await Question.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            status: 'success',
            data: question
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a question
// @route   DELETE /api/v1/questions/:id
// @access  Private (Instructor, Admin)
exports.deleteQuestion = async (req, res, next) => {
    try {
        const question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({ status: 'error', message: 'Question not found' });
        }

        const quiz = await Quiz.findById(question.quiz).populate({ path: 'lesson', populate: { path: 'course' } });

        // Check if the user is the course owner or an admin
        if (quiz.lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to delete this question' });
        }

        // Remove this question reference from quiz.questions (once)
        await Quiz.findByIdAndUpdate(question.quiz, { $pull: { questions: question._id } });

        // Clean up related answers to avoid orphans
        await Answer.deleteMany({ question: question._id });

        // Delete the question document with a supported API
        await Question.deleteOne({ _id: question._id });

        res.status(200).json({
            status: 'success',
            data: {}
        });
    } catch (error) {
        next(error);
    }
};
