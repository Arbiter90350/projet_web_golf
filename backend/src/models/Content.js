const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  contentType: {
    type: String,
    required: true,
    enum: ['video', 'pdf', 'doc'],
    message: 'Content type must be either video, pdf or doc'
  },
  url: {
    type: String,
    required: [true, 'Content URL is required'],
    trim: true
  },
  // Storing a reference to the lesson this content belongs to.
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Lesson'
  }
}, {
  timestamps: true
});

// To ensure a lesson doesn't have duplicate content for the same URL.
contentSchema.index({ lesson: 1, url: 1 }, { unique: true });

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;
