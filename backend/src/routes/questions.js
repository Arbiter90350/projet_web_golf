const express = require('express');
const {
  getQuestions,
  addQuestion,
  getQuestion,
  updateQuestion,
  deleteQuestion
} = require('../controllers/questionController');

const { protect, authorize } = require('../middleware/authMiddleware');
const answerRouter = require('./answers');

// mergeParams: true allows us to access params from other routers (e.g., :quizId)
const router = express.Router({ mergeParams: true });

// Re-route into other resource routers
router.use('/:questionId/answers', answerRouter);

// Routes for getting all questions for a quiz and adding a new one
router.route('/')
    .get(protect, getQuestions)
    .post(protect, authorize('instructor', 'admin'), addQuestion);

// Routes for a single question
router.route('/:id')
  .get(protect, getQuestion)
  .put(protect, authorize('instructor', 'admin'), updateQuestion)
  .delete(protect, authorize('instructor', 'admin'), deleteQuestion);

module.exports = router;
