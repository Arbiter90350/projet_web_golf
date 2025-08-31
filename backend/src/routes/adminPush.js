const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const pushCtrl = require('../controllers/pushController');

// Historique
router.get('/messages', protect, authorize('admin'), pushCtrl.listMessages);

// Création + envoi immédiat
router.post('/messages', protect, authorize('admin'), pushCtrl.validateCreateMessage, pushCtrl.createAndSend);

// Test vers l'admin courant
router.post('/test', protect, authorize('admin'), pushCtrl.testToSelf);

module.exports = router;
