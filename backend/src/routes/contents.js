const express = require('express');
const {
  getContents,
  addContent,
  getContent,
  updateContent,
  deleteContent
} = require('../controllers/contentController');

const { protect, authorize } = require('../middleware/authMiddleware');

// mergeParams: true allows us to access params from other routers (e.g., :lessonId)
const router = express.Router({ mergeParams: true });

// Routes for getting all content for a lesson and adding new content
router.route('/')
    .get(protect, getContents)
    .post(protect, authorize('instructor', 'admin'), addContent);

// Routes for a single content item
router.route('/:id')
  .get(protect, getContent)
  .put(protect, authorize('instructor', 'admin'), updateContent)
  .delete(protect, authorize('instructor', 'admin'), deleteContent);

module.exports = router;
