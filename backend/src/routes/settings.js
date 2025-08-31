const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getSettingAdmin,
  upsertSettingAdmin,
  getSettingPublic,
  getSettingsByPrefixAdmin,
  getSettingsByPrefixPublic,
  validateKeyParam,
  validateUpsert,
} = require('../controllers/settingsController');

const router = express.Router();

// Lecture publique pour clés autorisées et préfixes autorisés
router.get('/public/:key', validateKeyParam, getSettingPublic);
router.get('/public-by-prefix/:prefix', getSettingsByPrefixPublic);

// Espace admin: JWT + RBAC admin
router.use(protect, authorize('admin'));
router.get('/list', getSettingsByPrefixAdmin);
router.get('/:key', validateKeyParam, getSettingAdmin);
router.put('/:key', [...validateKeyParam, ...validateUpsert], upsertSettingAdmin);

module.exports = router;
