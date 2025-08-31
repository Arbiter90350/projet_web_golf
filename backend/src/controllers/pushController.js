// Contrôleur Web Push — abonnement, envoi, historique
// Commentaires en français (règle projet)

const { validationResult, body, query } = require('express-validator');
const PushSubscription = require('../models/PushSubscription');
const PushMessage = require('../models/PushMessage');
const { sendToSubscription, ensureConfigured } = require('../services/pushService');
const logger = require('../utils/logger');

// Validation middlewares
exports.validateSubscribe = [
  body('endpoint').isString().isLength({ min: 10 }),
  body('keys.p256dh').isString().isLength({ min: 10 }),
  body('keys.auth').isString().isLength({ min: 10 }),
];

exports.validateCreateMessage = [
  body('title').isString().isLength({ min: 1, max: 120 }),
  body('body').isString().isLength({ min: 1, max: 4000 }),
  body('icon').isString().isLength({ min: 1, max: 1000 }),
  body('clickUrl').optional().isString().isLength({ min: 1, max: 2000 }),
  body('actions').optional().isArray({ max: 2 }),
  body('actions.*.title').optional().isString().isLength({ min: 1, max: 40 }),
  body('actions.*.action').optional().isString().isLength({ min: 1, max: 40 }),
  body('actions.*.url').optional().isString().isLength({ min: 1, max: 2000 }),
];

exports.config = async (req, res) => {
  try {
    const { pub } = ensureConfigured();
    const defaultIcon = `${process.env.PUBLIC_ORIGIN || ''}/icons/icon-192.png`;
    res.json({ status: 'success', data: { publicKey: pub, defaultIcon } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
};

exports.subscribe = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ status: 'error', errors: errors.array() });

  const { endpoint, keys } = req.body;
  const ua = req.headers['user-agent'] || '';
  const userId = req.user?._id || null;

  const upsert = await PushSubscription.findOneAndUpdate(
    { endpoint },
    { endpoint, keys, ua, userId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ status: 'success', data: { id: upsert._id } });
};

exports.unsubscribe = async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ status: 'error', message: 'endpoint requis' });
  await PushSubscription.deleteOne({ endpoint });
  res.json({ status: 'success' });
};

exports.listMessages = async (req, res) => {
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
  const items = await PushMessage.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ status: 'success', data: { items } });
};

exports.createAndSend = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ status: 'error', errors: errors.array() });
  const { title, body, icon, actions = [], clickUrl } = req.body;

  const msg = await PushMessage.create({
    title, body, icon, actions, clickUrl,
    createdBy: req.user?._id || null,
    status: 'queued',
  });

  const subs = await PushSubscription.find({}).lean();
  let success = 0; let failure = 0;
  const payload = { title, body, icon, actions, clickUrl };

  await Promise.all(subs.map(async (s) => {
    try {
      await sendToSubscription({ endpoint: s.endpoint, keys: s.keys }, payload);
      success += 1;
      await PushSubscription.updateOne({ _id: s._id }, { $set: { lastSuccessfulAt: new Date(), errorCode: null } });
    } catch (e) {
      failure += 1;
      const code = e?.statusCode || e?.code || 'ERR';
      await PushSubscription.updateOne({ _id: s._id }, { $set: { lastErrorAt: new Date(), errorCode: String(code) } });
      // Nettoyage si endpoint invalide
      if (code === 404 || code === 410) {
        await PushSubscription.deleteOne({ _id: s._id });
      }
      logger.warn('web-push failure', { endpoint: s.endpoint, code });
    }
  }));

  const status = failure === 0 ? 'sent' : (success > 0 ? 'partial' : 'failed');
  await PushMessage.updateOne({ _id: msg._id }, { $set: { status, counters: { total: subs.length, success, failure } } });

  res.json({ status: 'success', data: { message: { id: msg._id, status, counters: { total: subs.length, success, failure } } } });
};

exports.testToSelf = async (req, res) => {
  const userId = req.user?._id;
  const sub = await PushSubscription.findOne({ userId }).lean();
  if (!sub) return res.status(400).json({ status: 'error', message: 'Aucune souscription pour cet utilisateur' });
  const payload = {
    title: 'Test notification',
    body: 'Ceci est un test',
    icon: `${process.env.PUBLIC_ORIGIN || ''}/icons/icon-192.png`,
    clickUrl: `${process.env.PUBLIC_ORIGIN || ''}/`,
    actions: [{ action: 'open', title: 'Ouvrir', url: `${process.env.PUBLIC_ORIGIN || ''}/` }],
  };
  try {
    await sendToSubscription({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastSuccessfulAt: new Date(), errorCode: null } });
    return res.json({ status: 'success' });
  } catch (e) {
    const code = e?.statusCode || e?.code || 'ERR';
    await PushSubscription.updateOne({ _id: sub._id }, { $set: { lastErrorAt: new Date(), errorCode: String(code) } });
    if (code === 404 || code === 410) await PushSubscription.deleteOne({ _id: sub._id });
    return res.status(500).json({ status: 'error', message: 'Échec envoi', code });
  }
};
