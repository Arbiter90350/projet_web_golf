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
