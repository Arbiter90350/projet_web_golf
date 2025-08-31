const { validationResult } = require('express-validator');
const Communication = require('../models/Communication');
const storageService = require('../services/storageService');
const logger = require('../utils/logger');

const MAX_TIME_MS = Number(process.env.DB_QUERY_MAX_TIME_MS || 15000);

// Contrôleur Communications (admin-only, plus lecture publique)
// - listCommunications: liste paginée, filtrable
// - createCommunication: création
// - getCommunication: lecture
// - updateCommunication: mise à jour
// - deleteCommunication: suppression

// GET /api/communications
// Accès: admin uniquement
exports.listCommunications = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    // Pagination & filtre plein texte (champ content)
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const q = (req.query.q || '').toString().trim();

    const filter = {};
    if (q) {
      // Échapper les métacaractères regex et effectuer une recherche insensible à la casse
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i');
      filter.content = regex;
    }

    const total = await Communication.countDocuments(filter).maxTimeMS(MAX_TIME_MS);
    const items = await Communication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'createdBy', select: 'firstName lastName email role' })
      .lean()
      .maxTimeMS(MAX_TIME_MS);

    const withSigned = await Promise.all(
      items.map(async (c) => ({
        id: c._id,
        content: c.content,
        mediaFileName: c.mediaFileName || null,
        mediaUrl: c.mediaFileName ? await storageService.getSignedUrl(c.mediaFileName) : null,
        visibleFrom: c.visibleFrom || null,
        visibleUntil: c.visibleUntil || null,
        createdBy: c.createdBy ? {
          id: c.createdBy._id,
          firstName: c.createdBy.firstName,
          lastName: c.createdBy.lastName,
        } : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
    );

    return res.status(200).json({
      status: 'success',
      data: {
        communications: withSigned,
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

// GET /api/public/communications
// Accès: public (lecture uniquement)
// Règles de visibilité: visibleFrom <= now (ou absent) ET (visibleUntil >= now ou absent)
exports.listPublicCommunications = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const q = (req.query.q || '').toString().trim();

    const now = new Date();
    const filter = {
      $and: [
        { $or: [{ visibleFrom: null }, { visibleFrom: { $lte: now } }] },
        { $or: [{ visibleUntil: null }, { visibleUntil: { $gte: now } }] },
      ],
    };

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i');
      filter.content = regex;
    }

    const total = await Communication.countDocuments(filter).maxTimeMS(MAX_TIME_MS);
    const items = await Communication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .maxTimeMS(MAX_TIME_MS);

    const withSigned = await Promise.all(
      items.map(async (c) => ({
        id: c._id,
        content: c.content,
        mediaFileName: c.mediaFileName || null,
        mediaUrl: c.mediaFileName ? await storageService.getSignedUrl(c.mediaFileName) : null,
        visibleFrom: c.visibleFrom || null,
        visibleUntil: c.visibleUntil || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
    );

    return res.status(200).json({
      status: 'success',
      data: {
        communications: withSigned,
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

// POST /api/communications
// Accès: admin uniquement
exports.createCommunication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const { content, mediaFileName, visibleFrom, visibleUntil } = req.body || {};

    const created = await Communication.create({
      content,
      mediaFileName: mediaFileName || undefined,
      visibleFrom: visibleFrom || undefined,
      visibleUntil: visibleUntil || undefined,
      createdBy: req.user._id,
    });

    const mediaUrl = created.mediaFileName ? await storageService.getSignedUrl(created.mediaFileName) : null;

    logger.info('Admin create communication', {
      actorId: req.user._id,
      commId: created._id,
    });

    return res.status(201).json({
      status: 'success',
      data: {
        communication: {
          id: created._id,
          content: created.content,
          mediaFileName: created.mediaFileName || null,
          mediaUrl,
          visibleFrom: created.visibleFrom || null,
          visibleUntil: created.visibleUntil || null,
          createdBy: { id: req.user._id },
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/communications/:id
// Accès: admin uniquement
exports.getCommunication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;
    const c = await Communication.findById(id)
      .populate({ path: 'createdBy', select: 'firstName lastName email role' })
      .maxTimeMS(MAX_TIME_MS);

    if (!c) return res.status(404).json({ status: 'error', message: 'Communication introuvable' });

    const mediaUrl = c.mediaFileName ? await storageService.getSignedUrl(c.mediaFileName) : null;

    return res.status(200).json({
      status: 'success',
      data: {
        communication: {
          id: c._id,
          content: c.content,
          mediaFileName: c.mediaFileName || null,
          mediaUrl,
          visibleFrom: c.visibleFrom || null,
          visibleUntil: c.visibleUntil || null,
          createdBy: c.createdBy ? { id: c.createdBy._id, firstName: c.createdBy.firstName, lastName: c.createdBy.lastName } : null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/communications/:id
// Accès: admin uniquement
exports.updateCommunication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;
    const payload = {};
    if (typeof req.body.content === 'string') payload.content = req.body.content;
    if (typeof req.body.mediaFileName === 'string' || req.body.mediaFileName === null) payload.mediaFileName = req.body.mediaFileName || undefined;
    if (req.body.visibleFrom !== undefined) payload.visibleFrom = req.body.visibleFrom || undefined;
    if (req.body.visibleUntil !== undefined) payload.visibleUntil = req.body.visibleUntil || undefined;

    const updated = await Communication.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).maxTimeMS(MAX_TIME_MS);

    if (!updated) return res.status(404).json({ status: 'error', message: 'Communication introuvable' });

    const mediaUrl = updated.mediaFileName ? await storageService.getSignedUrl(updated.mediaFileName) : null;

    logger.info('Admin update communication', {
      actorId: req.user._id,
      commId: updated._id,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        communication: {
          id: updated._id,
          content: updated.content,
          mediaFileName: updated.mediaFileName || null,
          mediaUrl,
          visibleFrom: updated.visibleFrom || null,
          visibleUntil: updated.visibleUntil || null,
          createdBy: { id: updated.createdBy },
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/communications/:id
// Accès: admin uniquement
exports.deleteCommunication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;
    const existing = await Communication.findById(id).maxTimeMS(MAX_TIME_MS);
    if (!existing) return res.status(404).json({ status: 'error', message: 'Communication introuvable' });

    await existing.deleteOne();

    logger.info('Admin delete communication', {
      actorId: req.user._id,
      commId: id,
    });

    return res.status(200).json({ status: 'success', message: 'Communication supprimée' });
  } catch (error) {
    next(error);
  }
};
