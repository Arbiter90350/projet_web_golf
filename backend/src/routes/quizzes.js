const express = require('express');
const {
  getQuizForLesson,
  addQuiz,
  updateQuiz,
  deleteQuiz,
  submitQuiz
} = require('../controllers/quizController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Include other resource routers
const questionRouter = require('./questions');

// mergeParams: true allows us to access params from other routers (e.g., :lessonId)
const router = express.Router({ mergeParams: true });

// Re-route into other resource routers
router.use('/:quizId/questions', questionRouter);

// Route for getting the quiz for a lesson and adding one
router.route('/')
    .get(protect, getQuizForLesson)
    .post(protect, authorize('instructor', 'admin'), addQuiz);

// Routes for updating and deleting a single quiz
router.route('/:id')
  .put(protect, authorize('instructor', 'admin'), updateQuiz)
  .delete(protect, authorize('instructor', 'admin'), deleteQuiz);

// Route for a player to submit a quiz
router.route('/:id/submit').post(protect, authorize('player'), submitQuiz);

module.exports = router;
