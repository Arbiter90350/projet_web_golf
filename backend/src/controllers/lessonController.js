const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const UserProgress = require('../models/UserProgress');

// @desc    Get all lessons for a specific course
// @route   GET /api/v1/courses/:courseId/lessons
// @access  Private
exports.getLessons = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) {
        return res.status(404).json({ status: 'error', message: 'Course not found' });
    }

    // Free navigation: return all lessons sorted by order for any authenticated user
    const lessons = await Lesson.find({ course: req.params.courseId }).sort('order');
    return res.status(200).json({
        status: 'success',
        count: lessons.length,
        data: lessons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a lesson to a course
// @route   POST /api/v1/courses/:courseId/lessons
// @access  Private (Instructor, Admin)
exports.addLesson = async (req, res, next) => {
  try {
    req.body.course = req.params.courseId;

    const course = await Course.findById(req.params.courseId);
    if (!course) {
        return res.status(404).json({ status: 'error', message: 'Course not found' });
    }

    // Check if the user is the course owner or an admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'User not authorized to add a lesson to this course' });
    }

    const lesson = await Lesson.create(req.body);

    res.status(201).json({
      status: 'success',
      data: lesson
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single lesson
// @route   GET /api/v1/lessons/:id
// @access  Private
exports.getLesson = async (req, res, next) => {
    try {
        const lesson = await Lesson.findById(req.params.id).populate('course', 'title');

        if (!lesson) {
            return res.status(404).json({ status: 'error', message: 'Lesson not found' });
        }

        res.status(200).json({
            status: 'success',
            data: lesson
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a lesson
// @route   PUT /api/v1/lessons/:id
// @access  Private (Instructor, Admin)
exports.updateLesson = async (req, res, next) => {
    try {
        let lesson = await Lesson.findById(req.params.id);

        if (!lesson) {
            return res.status(404).json({ status: 'error', message: 'Lesson not found' });
        }

        const course = await Course.findById(lesson.course);

        // Check if the user is the course owner or an admin
        if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to update this lesson' });
        }

        lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            status: 'success',
            data: lesson
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a lesson
// @route   DELETE /api/v1/lessons/:id
// @access  Private (Instructor, Admin)
exports.deleteLesson = async (req, res, next) => {
    try {
        const lesson = await Lesson.findById(req.params.id);

        if (!lesson) {
            return res.status(404).json({ status: 'error', message: 'Lesson not found' });
        }

        const course = await Course.findById(lesson.course);

        // Check if the user is the course owner or an admin
        if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to delete this lesson' });
        }

        await lesson.remove();

        res.status(200).json({
            status: 'success',
            data: {}
        });
    } catch (error) {
        next(error);
    }
};
