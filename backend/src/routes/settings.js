const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getSettingAdmin,
  upsertSettingAdmin,
  getSettingPublic,
  validateKeyParam,
  validateUpsert,
} = require('../controllers/settingsController');

const router = express.Router();

// Lecture publique mais uniquement pour clés autorisées (whitelist dans controller)
router.get('/public/:key', validateKeyParam, getSettingPublic);

// Espace admin: JWT + RBAC admin
router.use(protect, authorize('admin'));
router.get('/:key', validateKeyParam, getSettingAdmin);
router.put('/:key', [...validateKeyParam, ...validateUpsert], upsertSettingAdmin);

module.exports = router;
