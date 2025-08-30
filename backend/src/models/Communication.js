// Modèle Mongoose pour les communications administrateur
// Règles: sécurité, données minimales, commentaires en français

const mongoose = require('mongoose');

const CommunicationSchema = new mongoose.Schema(
  {
    // Contenu texte de l'annonce / communication
    content: { type: String, required: true, trim: true, maxlength: 5000 },

    // Fichier média optionnel (clé/nom du fichier dans l'Object Storage)
    mediaFileName: { type: String, required: false, index: true },

    // Fenêtre de visibilité optionnelle
    visibleFrom: { type: Date, required: false },
    visibleUntil: { type: Date, required: false },

    // Auteur (administrateur) pour l'audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true, // createdAt / updatedAt
    versionKey: false,
  }
);

// Validation personnalisée: si visibleUntil < visibleFrom -> invalide
CommunicationSchema.pre('validate', function(next) {
  if (this.visibleFrom && this.visibleUntil && this.visibleUntil < this.visibleFrom) {
    return next(new Error('visibleUntil ne peut pas être antérieur à visibleFrom'));
  }
  next();
});

// Index pour requêtes fréquentes
CommunicationSchema.index({ createdAt: -1 });
CommunicationSchema.index({ visibleFrom: 1, visibleUntil: 1 });
CommunicationSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('Communication', CommunicationSchema);
