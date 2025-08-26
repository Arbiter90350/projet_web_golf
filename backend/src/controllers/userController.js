const { validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');

// Contrôleur Admin Utilisateurs
// - listUsers: liste paginée, filtrable, sans champs sensibles
// - updateUserRole: mise à jour sécurisée du rôle avec garde-fous (RBAC)

// GET /api/v1/users
// Accès: admin uniquement (protégé par middleware)
const listUsers = async (req, res, next) => {
  try {
    // Validation (si des règles ont été posées côté route)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const role = req.query.role;
    const q = (req.query.q || '').toString().trim();

    const filter = {};
    if (role && ['player', 'instructor', 'admin'].includes(role)) {
      filter.role = role;
    }
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
      ];
    }

    const total = await User.countDocuments(filter);
    const items = await User.find(filter)
      .select('email firstName lastName role isActive isEmailVerified createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const users = items.map((u) => ({
      id: u._id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      isEmailVerified: u.isEmailVerified,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/users/:id/role
// Accès: admin uniquement (protégé par middleware)
const updateUserRole = async (req, res, next) => {
  try {
    // Validation (si des règles ont été posées côté route)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;
    const { role } = req.body || {};

    if (!['player', 'instructor', 'admin'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Role invalide' });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ status: 'error', message: 'Utilisateur introuvable' });
    }

    // Protection: empêcher un admin de se retirer lui-même du rôle admin (auto-verrouillage)
    if (String(req.user._id) === String(id) && role !== 'admin') {
      return res.status(400).json({ status: 'error', message: 'Un admin ne peut pas retirer son propre rôle administrateur.' });
    }

    // Protection: ne pas supprimer le dernier admin actif
    if (target.role === 'admin' && role !== 'admin') {
      const otherAdmins = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: target._id } });
      if (otherAdmins === 0) {
        return res.status(400).json({ status: 'error', message: 'Impossible de retirer le dernier administrateur actif.' });
      }
    }

    target.role = role;
    await target.save({ validateBeforeSave: false });

    logger.info('Admin role change', {
      actorId: req.user._id,
      targetId: target._id,
      newRole: role,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: target._id,
          email: target.email,
          firstName: target.firstName,
          lastName: target.lastName,
          role: target.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/users/:id
// Accès: admin uniquement
const deleteUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;

    // Empêche la suppression de soi-même
    if (String(req.user._id) === String(id)) {
      return res.status(400).json({ status: 'error', message: 'Un administrateur ne peut pas se supprimer lui-même.' });
    }

    const target = await User.findById(id).select('role email firstName lastName');
    if (!target) {
      return res.status(404).json({ status: 'error', message: 'Utilisateur introuvable' });
    }

    // Empêcher la suppression du dernier administrateur actif
    if (target.role === 'admin') {
      const otherAdmins = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: target._id } });
      if (otherAdmins === 0) {
        return res.status(400).json({ status: 'error', message: 'Impossible de supprimer le dernier administrateur actif.' });
      }
    }

    await target.deleteOne();

    logger.info('Admin delete user', {
      actorId: req.user._id,
      targetId: target._id,
    });

    return res.status(200).json({ status: 'success', message: 'Utilisateur supprimé' });
  } catch (error) {
    next(error);
  }
};

module.exports = { listUsers, updateUserRole, deleteUser };
