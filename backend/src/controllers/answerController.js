const Answer = require('../models/Answer');
const Question = require('../models/Question');

// @desc    Get all answers for a specific question
// @route   GET /api/v1/questions/:questionId/answers
// @access  Private
exports.getAnswers = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.questionId);
    if (!question) {
      return res.status(404).json({ status: 'error', message: 'Question not found' });
    }

    const answers = await Answer.find({ question: req.params.questionId });

    res.status(200).json({
      status: 'success',
      count: answers.length,
      data: answers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add an answer to a question
// @route   POST /api/v1/questions/:questionId/answers
// @access  Private (Instructor, Admin)
exports.addAnswer = async (req, res, next) => {
  try {
    req.body.question = req.params.questionId;

    const question = await Question.findById(req.params.questionId).populate({ path: 'quiz', populate: { path: 'lesson', populate: { path: 'course' } } });
    if (!question) {
      return res.status(404).json({ status: 'error', message: 'Question not found' });
    }

    // Check if the user is the course owner or an admin
    if (question.quiz.lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to add an answer to this question' });
    }

    const answer = await Answer.create(req.body);

    res.status(201).json({
      status: 'success',
      data: answer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single answer
// @route   GET /api/v1/answers/:id
// @access  Private
exports.getAnswer = async (req, res, next) => {
    try {
        const answer = await Answer.findById(req.params.id).populate({ path: 'question', select: 'text' });

        if (!answer) {
            return res.status(404).json({ status: 'error', message: 'Answer not found' });
        }

        res.status(200).json({
            status: 'success',
            data: answer
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update an answer
// @route   PUT /api/v1/answers/:id
// @access  Private (Instructor, Admin)
exports.updateAnswer = async (req, res, next) => {
    try {
        let answer = await Answer.findById(req.params.id);

        if (!answer) {
            return res.status(404).json({ status: 'error', message: 'Answer not found' });
        }

        const question = await Question.findById(answer.question).populate({ path: 'quiz', populate: { path: 'lesson', populate: { path: 'course' } } });

        // Check if the user is the course owner or an admin
        if (question.quiz.lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to update this answer' });
        }

        answer = await Answer.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            status: 'success',
            data: answer
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete an answer
// @route   DELETE /api/v1/answers/:id
// @access  Private (Instructor, Admin)
exports.deleteAnswer = async (req, res, next) => {
    try {
        const answer = await Answer.findById(req.params.id);

        if (!answer) {
            return res.status(404).json({ status: 'error', message: 'Answer not found' });
        }

        const question = await Question.findById(answer.question).populate({ path: 'quiz', populate: { path: 'lesson', populate: { path: 'course' } } });

        // Check if the user is the course owner or an admin
        if (question.quiz.lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to delete this answer' });
        }

        // Remove reference from question.answers
        await Question.findByIdAndUpdate(question._id, { $pull: { answers: answer._id } });

        await Answer.deleteOne({ _id: answer._id });

        res.status(200).json({
            status: 'success',
            data: {}
        });
    } catch (error) {
        next(error);
    }
};
