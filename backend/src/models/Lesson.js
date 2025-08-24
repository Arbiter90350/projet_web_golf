const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Lesson title is required'],
    trim: true
  },
  order: {
    type: Number,
    required: [true, 'Lesson order is required']
  },
  // Mode de validation de la sous-partie: lecture simple, validation par instructeur, ou QCM
  validationMode: {
    type: String,
    enum: ['read', 'pro', 'qcm'],
    default: 'read'
  },
  // Contenu texte/HTML affiché dans la modale (pas de PDF requis)
  description: {
    type: String,
    trim: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Course'
  }
}, {
  timestamps: true
});

// Create a compound index to ensure lesson order is unique within a course
lessonSchema.index({ course: 1, order: 1 }, { unique: true });

const Lesson = mongoose.model('Lesson', lessonSchema);

module.exports = Lesson;
