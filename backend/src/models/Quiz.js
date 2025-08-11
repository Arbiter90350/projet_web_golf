const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true
  },
  passingScore: {
    type: Number,
    required: [true, 'Passing score is required'],
    min: 0,
    max: 100,
    default: 80
  },
  // Each quiz is associated with one lesson.
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Lesson',
    unique: true // A lesson can only have one quiz
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }]
}, {
  timestamps: true
});

const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;
