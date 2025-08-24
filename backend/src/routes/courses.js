const express = require('express');
const mongoose = require('mongoose');
const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  reorderCourses
} = require('../controllers/courseController');

const { protect, authorize } = require('../middleware/authMiddleware');

const lessonRouter = require('./lessons');

const router = express.Router();

// Re-route into other resource routers
router.use('/:courseId/lessons', lessonRouter);

// Route to get all courses and create a new course
router.route('/')
  .get(protect, getCourses) // Protect to identify user role for filtering
  .post(protect, authorize('instructor', 'admin'), createCourse);

// Batch reorder (must be before /:id)
router.put('/reorder', protect, authorize('instructor', 'admin'), reorderCourses);

// Guard: validate ':id' as a Mongo ObjectId to avoid CastErrors
router.param('id', (req, res, next, value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ status: 'error', message: 'Invalid id parameter' });
  }
  next();
});

// Route for single course operations
router.route('/:id')
  .get(protect, getCourseById) // Protect to identify user role for filtering
  .put(protect, authorize('instructor', 'admin'), updateCourse)
  .delete(protect, authorize('instructor', 'admin'), deleteCourse);

module.exports = router;
