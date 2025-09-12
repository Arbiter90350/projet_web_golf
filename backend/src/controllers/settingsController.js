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
const ALLOWED_TILE_KEYS = new Set([
  'dashboard.events',
  'dashboard.green_card_schedule',
  // Image d'en-tête du dashboard (lecture publique autorisée)
  'dashboard.header_image',
]);
const ALLOWED_PUBLIC_PREFIXES = ['dashboard.tile.'];

// Validators (exported for routes)
exports.validateKeyParam = [
  param('key').isString().trim().isLength({ min: 3, max: 120 }),
];

exports.validateUpsert = [
  body('title').optional({ values: 'falsy' }).isString().trim().isLength({ max: 160 }),
  body('content').optional({ values: 'falsy' }).isString().trim().isLength({ max: 8000 }),
  body('mediaFileName').optional({ values: 'falsy' }).isString().trim(),
  body('linkUrl').optional({ values: 'falsy' }).isString().trim().isLength({ max: 512 }),
];

// GET /api/settings/list?prefix=... (admin)
exports.getSettingsByPrefixAdmin = async (req, res, next) => {
  try {
    const prefix = (req.query?.prefix || '').toString();
    if (!prefix || prefix.length < 3 || prefix.length > 120) {
      return res.status(400).json({ status: 'error', message: 'Invalid prefix' });
    }
    const docs = await Setting.find({ key: { $regex: `^${prefix}` } })
      .sort('key')
      .lean()
      .maxTimeMS(MAX_TIME_MS);
    const results = await Promise.all(
      docs.map(async (s) => ({
        key: s.key,
        title: s.title || null,
        content: s.content || '',
        mediaFileName: s.mediaFileName || null,
        mediaUrl: s.mediaFileName ? await storageService.getSignedUrl(s.mediaFileName) : null,
        linkUrl: s.linkUrl || null,
        updatedAt: s.updatedAt,
      }))
    );
    return res.status(200).json({ status: 'success', data: { settings: results } });
  } catch (error) { next(error); }
};

// DELETE /api/settings/:key (admin) — suppression restreinte aux tuiles dynamiques
exports.deleteSettingAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }

    const { key } = req.params;
    // Par sécurité, on n'autorise la suppression que pour les clés dynamiques
    if (!key || !key.startsWith('dashboard.tile.')) {
      return res.status(403).json({ status: 'error', message: 'Deletion not allowed for this key' });
    }

    const deleted = await Setting.findOneAndDelete({ key }).maxTimeMS(MAX_TIME_MS);

    logger.info('Admin delete setting', { key, actorId: req.user?._id, found: Boolean(deleted) });

    return res
      .status(200)
      .json({ status: 'success', data: { deleted: Boolean(deleted) } });
  } catch (error) {
    next(error);
  }
};

// GET /api/settings/:key (admin)
exports.getSettingAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });

    const { key } = req.params;
    const s = await Setting.findOne({ key }).maxTimeMS(MAX_TIME_MS);
    if (!s) return res.status(200).json({ status: 'success', data: { setting: null } });

    const mediaUrl = s.mediaFileName ? await storageService.getSignedUrl(s.mediaFileName) : null;
    return res.status(200).json({ status: 'success', data: { setting: { key: s.key, title: s.title || null, content: s.content || '', mediaFileName: s.mediaFileName || null, mediaUrl, linkUrl: s.linkUrl || null, updatedAt: s.updatedAt } } });
  } catch (error) { next(error); }
};

// GET /api/settings/public-by-prefix/:prefix — lecture publique limitée à certains préfixes
exports.getSettingsByPrefixPublic = async (req, res, next) => {
  try {
    const prefix = req.params?.prefix || '';
    if (!ALLOWED_PUBLIC_PREFIXES.includes(prefix)) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    const docs = await Setting.find({ key: { $regex: `^${prefix}` } })
      .lean()
      .sort('key')
      .maxTimeMS(MAX_TIME_MS);
    const results = await Promise.all(
      docs.map(async (s) => ({
        key: s.key,
        title: s.title || null,
        content: s.content || '',
        mediaFileName: s.mediaFileName || null,
        mediaUrl: s.mediaFileName ? await storageService.getSignedUrl(s.mediaFileName) : null,
        linkUrl: s.linkUrl || null,
        updatedAt: s.updatedAt,
      }))
    );
    return res.status(200).json({ status: 'success', data: { settings: results } });
  } catch (error) { next(error); }
};

// PUT /api/settings/:key (admin) — upsert
exports.upsertSettingAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });

    const { key } = req.params;
    const { title, content, mediaFileName, linkUrl } = req.body || {};
    // Construction précise de l'update:
    // - $set pour les champs fournis
    // - $unset si mediaFileName === null ou '' afin de SUPPRIMER le média associé
    const updateDoc = { $set: { key, updatedBy: req.user?._id } };
    if (typeof title === 'string') updateDoc.$set.title = title;
    if (typeof content === 'string') updateDoc.$set.content = content;
    if (mediaFileName === null || mediaFileName === '') {
      updateDoc.$unset = { ...(updateDoc.$unset || {}), mediaFileName: '' };
    } else if (typeof mediaFileName === 'string' && mediaFileName) {
      updateDoc.$set.mediaFileName = mediaFileName;
    }
    if (linkUrl === null || linkUrl === '') {
      updateDoc.$unset = { ...(updateDoc.$unset || {}), linkUrl: '' };
    } else if (typeof linkUrl === 'string') {
      updateDoc.$set.linkUrl = linkUrl;
    }

    const updated = await Setting.findOneAndUpdate(
      { key },
      updateDoc,
      { upsert: true, new: true, runValidators: true }
    ).maxTimeMS(MAX_TIME_MS);

    const mediaUrl = updated.mediaFileName ? await storageService.getSignedUrl(updated.mediaFileName) : null;

    logger.info('Admin upsert setting', { key, actorId: req.user?._id });

    return res.status(200).json({ status: 'success', data: { setting: { key: updated.key, title: updated.title || null, content: updated.content || '', mediaFileName: updated.mediaFileName || null, mediaUrl, linkUrl: updated.linkUrl || null, updatedAt: updated.updatedAt } } });
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
    return res.status(200).json({ status: 'success', data: { setting: { key: s.key, title: s.title || null, content: s.content || '', mediaFileName: s.mediaFileName || null, mediaUrl, linkUrl: s.linkUrl || null, updatedAt: s.updatedAt } } });
  } catch (error) { next(error); }
};
