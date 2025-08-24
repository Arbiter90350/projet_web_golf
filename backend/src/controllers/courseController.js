const Course = require('../models/Course');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Create a new course
// @route   POST /api/v1/courses
// @access  Private (Instructor, Admin)
exports.createCourse = async (req, res, next) => {
  try {
    // The user's ID is added to req.user by the 'protect' middleware
    req.body.instructor = req.user.id;
    // Assigner un ordre par défaut à la fin de la liste de l'instructeur
    const last = await Course.find({ instructor: req.user.id }).sort({ order: -1 }).limit(1);
    const nextOrder = (last?.[0]?.order ?? -1) + 1;
    if (typeof req.body.order !== 'number') {
      req.body.order = nextOrder;
    }

    const course = await Course.create(req.body);

    res.status(201).json({
      status: 'success',
      data: course
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder courses (batch) for an instructor (or all for admin)
// @route   PUT /api/v1/courses/reorder
// @access  Private (Instructor, Admin)
exports.reorderCourses = async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.some((v) => typeof v !== 'string')) {
      return res.status(400).json({ status: 'error', message: 'Invalid payload: expected { ids: string[] }' });
    }

    const stringIds = ids.map(String);
    const validIds = stringIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== stringIds.length) {
      return res.status(400).json({ status: 'error', message: 'Invalid course IDs in payload' });
    }

    const isAdmin = req.user && req.user.role === 'admin';
    const scopeFilter = isAdmin ? {} : { instructor: req.user.id };

    // Verify authorization for each id
    const authorized = await Course.find({ _id: { $in: validIds }, ...scopeFilter }).select('_id');
    const allowedSet = new Set(authorized.map((c) => c._id.toString()));

    const ops = validIds
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => allowedSet.has(id))
      .map(({ id, index }) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order: index } },
        },
      }));

    if (ops.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No authorized courses to reorder' });
    }

    await Course.bulkWrite(ops);

    res.status(200).json({ status: 'success', data: { updated: ops.length } });
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

    // Filtrage selon le rôle et tri par ordre puis date de création
    if (req.user && req.user.role === 'player') {
      query = Course.find({ isPublished: true });
    } else if (req.user && req.user.role === 'instructor') {
      query = Course.find({ instructor: req.user.id });
    } else {
      // Admins can see all courses
      query = Course.find();
    }

    const courses = await query.sort({ order: 1, createdAt: 1 }).populate('instructor', 'firstName lastName');

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
