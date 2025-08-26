const express = require('express');
const { body, param, query } = require('express-validator');
const { listUsers, updateUserRole, deleteUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Routes d'administration des utilisateurs
// Sécurité: JWT + RBAC (admin uniquement)
const router = express.Router();

// Liste paginée des utilisateurs
router.get(
  '/',
  protect,
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('role').optional().isIn(['player', 'instructor', 'admin']),
    query('q').optional().isString().trim(),
  ],
  listUsers
);

// Mise à jour du rôle d'un utilisateur
router.patch(
  '/:id/role',
  protect,
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid user id'),
    body('role').isIn(['player', 'instructor', 'admin']).withMessage('Role invalide'),
  ],
  updateUserRole
);

// Suppression d'un utilisateur
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  [param('id').isMongoId().withMessage('Invalid user id')],
  deleteUser
);

module.exports = router;
