const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { markAsRead, proValidate, getMyProgress } = require('../controllers/progressController');

const router = express.Router();

// Progress routes
router.patch('/lessons/:lessonId/read', protect, authorize('player'), markAsRead);
router.patch('/lessons/:lessonId/pro-validate', protect, authorize('instructor', 'admin'), proValidate);
router.get('/me', protect, getMyProgress);

module.exports = router;
