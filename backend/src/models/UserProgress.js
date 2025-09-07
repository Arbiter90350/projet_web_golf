const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Lesson'
  },
  status: {
    type: String,
    required: true,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  // Champs spécifiques au QCM (verrouillage et dernières réponses)
  // Date jusqu'à laquelle un nouvel essai est bloqué (échec => +24h)
  quizLockedUntil: {
    type: Date,
    default: null
  },
  // Date de réussite (bloque définitivement les nouveaux essais)
  passedAt: {
    type: Date,
    default: null
  },
  // Dernier score obtenu au QCM
  lastQuizScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  // Date du dernier essai
  lastQuizAttemptAt: {
    type: Date,
    default: null
  },
  // Détails du dernier essai (persistés pour visualisation)
  // Chaque entrée contient: question, selectedIds, correctIds, isCorrect
  lastQuizDetails: [
    {
      question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
      selectedIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Answer' }],
      correctIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Answer' }],
      isCorrect: { type: Boolean, default: false },
    }
  ]
}, {
  timestamps: true
});

// A user can only have one progress entry per lesson.
userProgressSchema.index({ user: 1, lesson: 1 }, { unique: true });

const UserProgress = mongoose.model('UserProgress', userProgressSchema);

module.exports = UserProgress;
