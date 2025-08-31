// Contrôleur Settings (réglages simples par clé) — Admin et Public
// Clés ciblées pour les tuiles du dashboard:
//  - 'dashboard.events'
//  - 'dashboard.green_card_schedule'
// Règles: RBAC admin pour écriture; lecture publique pour endpoints dédiés

const { param, body, validationResult } = require('express-validator');
const Setting = require('../models/Setting');
const storageService = require('../services/storageService');
const logger = require('../utils/logger');

const MAX_TIME_MS = Number(process.env.DB_QUERY_MAX_TIME_MS || 15000);
const ALLOWED_TILE_KEYS = new Set(['dashboard.events', 'dashboard.green_card_schedule']);

// Validators (exported for routes)
exports.validateKeyParam = [
  param('key').isString().trim().isLength({ min: 3, max: 120 }),
];

exports.validateUpsert = [
  body('content').optional({ values: 'falsy' }).isString().trim().isLength({ max: 8000 }),
  body('mediaFileName').optional({ values: 'falsy' }).isString().trim(),
];

// GET /api/settings/:key (admin)
exports.getSettingAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });

    const { key } = req.params;
    const s = await Setting.findOne({ key }).maxTimeMS(MAX_TIME_MS);
    if (!s) return res.status(200).json({ status: 'success', data: { setting: null } });

    const mediaUrl = s.mediaFileName ? await storageService.getSignedUrl(s.mediaFileName) : null;
    return res.status(200).json({ status: 'success', data: { setting: { key: s.key, content: s.content || '', mediaFileName: s.mediaFileName || null, mediaUrl, updatedAt: s.updatedAt } } });
  } catch (error) { next(error); }
};

// PUT /api/settings/:key (admin) — upsert
exports.upsertSettingAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });

    const { key } = req.params;
    const { content, mediaFileName } = req.body || {};
    const payload = {
      key,
      content: typeof content === 'string' ? content : undefined,
      mediaFileName: typeof mediaFileName === 'string' && mediaFileName ? mediaFileName : undefined,
      updatedBy: req.user?._id,
    };

    const updated = await Setting.findOneAndUpdate(
      { key },
      { $set: payload },
      { upsert: true, new: true, runValidators: true }
    ).maxTimeMS(MAX_TIME_MS);

    const mediaUrl = updated.mediaFileName ? await storageService.getSignedUrl(updated.mediaFileName) : null;

    logger.info('Admin upsert setting', { key, actorId: req.user?._id });

    return res.status(200).json({ status: 'success', data: { setting: { key: updated.key, content: updated.content || '', mediaFileName: updated.mediaFileName || null, mediaUrl, updatedAt: updated.updatedAt } } });
  } catch (error) { next(error); }
};

// GET /api/public/settings/:key — lecture publique MAIS key limitée aux tuiles autorisées
exports.getSettingPublic = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });

    const { key } = req.params;
    if (!ALLOWED_TILE_KEYS.has(key)) return res.status(404).json({ status: 'error', message: 'Setting not found' });

    const s = await Setting.findOne({ key }).lean().maxTimeMS(MAX_TIME_MS);
    if (!s) return res.status(200).json({ status: 'success', data: { setting: null } });

    const mediaUrl = s.mediaFileName ? await storageService.getSignedUrl(s.mediaFileName) : null;
    return res.status(200).json({ status: 'success', data: { setting: { key: s.key, content: s.content || '', mediaFileName: s.mediaFileName || null, mediaUrl, updatedAt: s.updatedAt } } });
  } catch (error) { next(error); }
};
