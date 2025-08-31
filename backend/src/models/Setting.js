// Modèle Mongoose pour des réglages simples par clé (tuiles dashboard)
// Clés prévues: 'dashboard.events', 'dashboard.green_card_schedule'
// Sécurité: pas d'informations sensibles, validations strictes

const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true, trim: true, maxlength: 120 },
    // Titre optionnel affiché sur les tuiles (remplace le libellé i18n si présent)
    title: { type: String, required: false, trim: true, maxlength: 160 },
    content: { type: String, required: false, trim: true, maxlength: 8000 },
    mediaFileName: { type: String, required: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

SettingSchema.index({ key: 1 });

module.exports = mongoose.model('Setting', SettingSchema);
