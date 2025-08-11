const express = require('express');
const {
  getAnswers,
  addAnswer,
  getAnswer,
  updateAnswer,
  deleteAnswer
} = require('../controllers/answerController');

const { protect, authorize } = require('../middleware/authMiddleware');

// mergeParams: true allows us to access params from other routers (e.g., :questionId)
const router = express.Router({ mergeParams: true });

// Routes for getting all answers for a question and adding a new one
router.route('/')
    .get(protect, getAnswers)
    .post(protect, authorize('instructor', 'admin'), addAnswer);

// Routes for a single answer
router.route('/:id')
  .get(protect, getAnswer)
  .put(protect, authorize('instructor', 'admin'), updateAnswer)
  .delete(protect, authorize('instructor', 'admin'), deleteAnswer);

module.exports = router;
