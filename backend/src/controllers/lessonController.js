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

    // If user is instructor of the course or admin, return all lessons
    if (req.user.role === 'admin' || (req.user.role === 'instructor' && course.instructor.toString() === req.user.id)) {
        const lessons = await Lesson.find({ course: req.params.courseId }).sort('order');
        return res.status(200).json({
            status: 'success',
            count: lessons.length,
            data: lessons
        });
    }

    // For players, implement sequential progression logic
    const allLessons = await Lesson.find({ course: req.params.courseId }).sort('order');
    const lessonIds = allLessons.map(lesson => lesson._id);

    const userProgress = await UserProgress.find({
        user: req.user.id,
        lesson: { $in: lessonIds }
    });

    const progressMap = new Map();
    userProgress.forEach(progress => {
        progressMap.set(progress.lesson.toString(), progress.status);
    });

    const accessibleLessons = [];
    for (let i = 0; i < allLessons.length; i++) {
        const lesson = allLessons[i];
        if (i === 0) { // First lesson is always accessible
            accessibleLessons.push(lesson);
        } else {
            const previousLesson = allLessons[i - 1];
            const previousLessonProgress = progressMap.get(previousLesson._id.toString());

            if (previousLessonProgress === 'completed') {
                accessibleLessons.push(lesson);
            } else {
                // Stop here, user can't access further lessons
                break;
            }
        }
    }

    res.status(200).json({
      status: 'success',
      count: accessibleLessons.length,
      data: accessibleLessons
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
