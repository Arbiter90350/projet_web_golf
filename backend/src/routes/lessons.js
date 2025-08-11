const express = require('express');
const {
  getLessons,
  addLesson,
  getLesson,
  updateLesson,
  deleteLesson
} = require('../controllers/lessonController');

const { protect, authorize } = require('../middleware/authMiddleware');
const quizRouter = require('./quizzes');
const contentRouter = require('./contents');

// mergeParams: true allows us to access params from other routers (e.g., :courseId)
const router = express.Router({ mergeParams: true });

// Re-route into other resource routers
router.use('/:lessonId/quiz', quizRouter);
router.use('/:lessonId/contents', contentRouter);

// Routes for getting all lessons for a course and adding a new one
router.route('/')
    .get(protect, getLessons)
    .post(protect, authorize('instructor', 'admin'), addLesson);

// Routes for a single lesson
router.route('/:id')
  .get(protect, getLesson)
  .put(protect, authorize('instructor', 'admin'), updateLesson)
  .delete(protect, authorize('instructor', 'admin'), deleteLesson);

module.exports = router;
