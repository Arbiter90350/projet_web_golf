const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const pushCtrl = require('../controllers/pushController');

// Config (clé publique VAPID, icône par défaut)
router.get('/config', pushCtrl.config);

// Abonnement / désabonnement (auth requis)
router.post('/subscribe', protect, pushCtrl.validateSubscribe, pushCtrl.subscribe);
router.post('/unsubscribe', protect, pushCtrl.unsubscribe);

module.exports = router;
