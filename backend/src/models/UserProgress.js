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
  }
}, {
  timestamps: true
});

// A user can only have one progress entry per lesson.
userProgressSchema.index({ user: 1, lesson: 1 }, { unique: true });

const UserProgress = mongoose.model('UserProgress', userProgressSchema);

module.exports = UserProgress;
