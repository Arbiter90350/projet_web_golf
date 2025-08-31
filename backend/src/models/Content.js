const mongoose = require('mongoose');

// Schéma de contenu de leçon
// Sécurité: on ne stocke plus d'URL signée (temporaire) mais la clé interne du fichier (fileName)
const contentSchema = new mongoose.Schema({
  contentType: {
    type: String,
    required: true,
    enum: ['image', 'pdf', 'mp4'],
    message: 'Content type must be either image, pdf or mp4'
  },
  // Clé interne du fichier dans le stockage objet (ex: "uploads/2025/08/uuid.mp4")
  fileName: {
    type: String,
    required: [true, 'Content fileName is required'],
    trim: true
  },
  // Texte associé optionnel (légende / description)
  caption: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  // Référence à la leçon
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Lesson'
  }
}, {
  timestamps: true
});

// Unicité: un même fileName ne doit pas être dupliqué pour une leçon donnée
contentSchema.index({ lesson: 1, fileName: 1 }, { unique: true });

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;
