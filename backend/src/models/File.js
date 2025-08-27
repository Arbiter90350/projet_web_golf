// Modèle Mongoose pour la gestion des fichiers stockés sur OVH Object Storage
// Règles: sécurité et minimalisme des données (aucune info sensible), commentaires en français

const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema(
  {
    // Clé/nom du fichier dans l'Object Storage (unique, générée côté serveur)
    fileName: { type: String, required: true, index: true, unique: true },

    // Nom original fourni par l'utilisateur (display)
    originalName: { type: String, required: true },

    // Type MIME
    mimeType: { type: String, required: true },

    // Taille en octets
    size: { type: Number, required: true, min: 0 },

    // Propriétaire / uploader (pour audit et RBAC futur)
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Lien logique optionnel (extensions futures)
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: false },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: false },
  },
  {
    timestamps: true, // createdAt / updatedAt
    versionKey: false,
  }
);

// Index pour requêtes fréquentes
FileSchema.index({ createdAt: -1 });
FileSchema.index({ uploader: 1, createdAt: -1 });

module.exports = mongoose.model('File', FileSchema);
