const Quiz = require('../models/Quiz');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const UserProgress = require('../models/UserProgress');

// @desc    Get quiz for a specific lesson
// @route   GET /api/v1/lessons/:lessonId/quiz
// @access  Private
exports.getQuizForLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.lessonId);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    const quiz = await Quiz.findOne({ lesson: req.params.lessonId }).populate('questions');

    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found for this lesson' });
    }

    res.status(200).json({
      status: 'success',
      data: quiz
    });
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

    const lesson = await Lesson.findById(req.params.lessonId).populate('course');
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
    let quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    const lesson = await Lesson.findById(quiz.lesson).populate('course');

    // Check if the user is the course owner or an admin
    if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to update this quiz' });
    }

    quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

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
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    const lesson = await Lesson.findById(quiz.lesson).populate('course');

    // Check if the user is the course owner or an admin
    if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to delete this quiz' });
    }

    await Quiz.deleteOne({ _id: quiz._id });

    res.status(200).json({
      status: 'success',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit answers for a quiz
// @route   POST /api/v1/quizzes/:id/submit
// @access  Private (Player)
exports.submitQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate({
      path: 'questions',
      populate: { path: 'answers', select: 'isCorrect' }
    });

    if (!quiz) {
      return res.status(404).json({ status: 'error', message: 'Quiz not found' });
    }

    const userAnswers = req.body.answers; // Expected format: [{ questionId: '...', answerId: '...' }]

    let correctAnswersCount = 0;
    quiz.questions.forEach(question => {
      const userAnswer = userAnswers.find(ua => ua.questionId === question._id.toString());
      if (userAnswer) {
        const correctAnswer = question.answers.find(ans => ans.isCorrect);
        if (correctAnswer && userAnswer.answerId === correctAnswer._id.toString()) {
          correctAnswersCount++;
        }
      }
    });

    const score = (correctAnswersCount / quiz.questions.length) * 100;
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
    );

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
