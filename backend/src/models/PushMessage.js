// Modèle Mongoose pour journaliser les envois de notifications
// Commentaires en français (règle projet)

const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  action: { type: String, required: true },
  url: { type: String, required: true },
}, { _id: false });

const PushMessageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  icon: { type: String, required: true }, // URL absolue recommandée
  clickUrl: { type: String },
  actions: { type: [ActionSchema], default: [] },
  filters: {
    roles: { type: [String], default: [] },
    users: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  status: { type: String, enum: ['queued', 'sent', 'partial', 'failed'], default: 'queued' },
  counters: {
    total: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    failure: { type: Number, default: 0 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PushMessage', PushMessageSchema);
