// Modèle Mongoose pour les abonnements Web Push
// Commentaires en français (règle projet)

const mongoose = require('mongoose');

const PushSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  ua: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastSuccessfulAt: { type: Date },
  lastErrorAt: { type: Date },
  errorCode: { type: String },
});

module.exports = mongoose.model('PushSubscription', PushSubscriptionSchema);
