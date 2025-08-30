const express = require('express');
const { body, param, query } = require('express-validator');
const {
  listCommunications,
  createCommunication,
  getCommunication,
  updateCommunication,
  deleteCommunication,
} = require('../controllers/communicationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Routes d'administration des communications (admin uniquement)
const router = express.Router();

// Appliquer JWT + RBAC admin pour toutes les routes ici
router.use(protect, authorize('admin'));

// Liste paginée des communications
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('q').optional().isString().trim(),
  ],
  listCommunications
);

// Créer une communication
router.post(
  '/',
  [
    body('content').isString().trim().isLength({ min: 1, max: 5000 }),
    body('mediaFileName').optional({ values: 'falsy' }).isString().trim(),
    body('visibleFrom').optional({ values: 'falsy' }).isISO8601().toDate(),
    body('visibleUntil').optional({ values: 'falsy' }).isISO8601().toDate(),
    // Validation croisée simple (si fournis)
    body('visibleUntil').custom((value, { req }) => {
      if (!value) return true;
      const vf = req.body.visibleFrom ? new Date(req.body.visibleFrom) : null;
      const vu = new Date(value);
      if (vf && vu < vf) {
        throw new Error('visibleUntil ne peut pas être antérieur à visibleFrom');
      }
      return true;
    }),
  ],
  createCommunication
);

// Lire une communication
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid communication id')],
  getCommunication
);

// Mettre à jour une communication
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid communication id'),
    body('content').optional().isString().trim().isLength({ min: 1, max: 5000 }),
    body('mediaFileName').optional({ values: 'falsy' }).isString().trim(),
    body('visibleFrom').optional({ values: 'falsy' }).isISO8601().toDate(),
    body('visibleUntil').optional({ values: 'falsy' }).isISO8601().toDate(),
    body('visibleUntil').custom((value, { req }) => {
      if (value === undefined || value === null || value === '') return true;
      const vf = req.body.visibleFrom ? new Date(req.body.visibleFrom) : null;
      const vu = new Date(value);
      if (vf && vu < vf) {
        throw new Error('visibleUntil ne peut pas être antérieur à visibleFrom');
      }
      return true;
    }),
  ],
  updateCommunication
);

// Supprimer une communication
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid communication id')],
  deleteCommunication
);

module.exports = router;
