const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Answer text is required'],
    trim: true
  },
  isCorrect: {
    type: Boolean,
    required: true,
    default: false
  },
  // Each answer belongs to one question.
  question: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Question'
  }
}, {
  timestamps: true
});

const Answer = mongoose.model('Answer', answerSchema);

module.exports = Answer;
