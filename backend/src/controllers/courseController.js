const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Create a new course
// @route   POST /api/v1/courses
// @access  Private (Instructor, Admin)
exports.createCourse = async (req, res, next) => {
  try {
    // The user's ID is added to req.user by the 'protect' middleware
    req.body.instructor = req.user.id;

    const course = await Course.create(req.body);

    res.status(201).json({
      status: 'success',
      data: course
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all courses
// @route   GET /api/v1/courses
// @access  Public (with filtering for players)
exports.getCourses = async (req, res, next) => {
  try {
    let query;

    // If the user is a player, only show published courses
    if (req.user && req.user.role === 'player') {
      query = Course.find({ isPublished: true });
    } else {
      // Instructors and Admins can see all courses
      query = Course.find();
    }

    const courses = await query.populate('instructor', 'firstName lastName');

    res.status(200).json({
      status: 'success',
      count: courses.length,
      data: courses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single course by ID
// @route   GET /api/v1/courses/:id
// @access  Public (with filtering for players)
exports.getCourseById = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).populate('lessons');

    if (!course) {
      return res.status(404).json({ status: 'error', message: 'Course not found' });
    }

    // Players can only view published courses
    if (req.user && req.user.role === 'player' && !course.isPublished) {
        return res.status(403).json({ status: 'error', message: 'You are not authorized to view this course' });
    }

    res.status(200).json({
      status: 'success',
      data: course
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a course
// @route   PUT /api/v1/courses/:id
// @access  Private (Instructor, Admin)
exports.updateCourse = async (req, res, next) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ status: 'error', message: 'Course not found' });
    }

    // Check if the user is the course owner or an admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'User not authorized to update this course' });
    }

    course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: course
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a course
// @route   DELETE /api/v1/courses/:id
// @access  Private (Instructor, Admin)
exports.deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ status: 'error', message: 'Course not found' });
    }

    // Check if the user is the course owner or an admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'User not authorized to delete this course' });
    }

    await course.remove();

    res.status(200).json({
      status: 'success',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
