const Content = require('../models/Content');
const Lesson = require('../models/Lesson');

// @desc    Get all content for a specific lesson
// @route   GET /api/v1/lessons/:lessonId/contents
// @access  Private
exports.getContents = async (req, res, next) => {
  try {
    // Si le contrôleur est appelé sans lessonId (ex: via /api/v1/contents),
    // retourner une erreur claire au lieu d'une exception Mongo (CastError).
    if (!req.params.lessonId) {
      return res.status(400).json({ status: 'error', message: 'Missing lessonId in route params' });
    }
    const lesson = await Lesson.findById(req.params.lessonId);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    const contents = await Content.find({ lesson: req.params.lessonId });

    res.status(200).json({
      status: 'success',
      count: contents.length,
      data: contents
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add content to a lesson
// @route   POST /api/v1/lessons/:lessonId/contents
// @access  Private (Instructor, Admin)
exports.addContent = async (req, res, next) => {
  try {
    // Sécurité/robustesse: s'assurer que lessonId est présent (route imbriquée attendue)
    if (!req.params.lessonId) {
      return res.status(400).json({ status: 'error', message: 'Missing lessonId in route params' });
    }
    req.body.lesson = req.params.lessonId;

    const lesson = await Lesson.findById(req.params.lessonId).populate({ path: 'course' });
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    // Check if the user is the course owner or an admin
    if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to add content to this lesson' });
    }

    const content = await Content.create(req.body);

    res.status(201).json({
      status: 'success',
      data: content
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single content
// @route   GET /api/v1/contents/:id
// @access  Private
exports.getContent = async (req, res, next) => {
    try {
        const content = await Content.findById(req.params.id).populate({ path: 'lesson', select: 'title' });

        if (!content) {
            return res.status(404).json({ status: 'error', message: 'Content not found' });
        }

        res.status(200).json({
            status: 'success',
            data: content
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update content
// @route   PUT /api/v1/contents/:id
// @access  Private (Instructor, Admin)
exports.updateContent = async (req, res, next) => {
    try {
        let content = await Content.findById(req.params.id);

        if (!content) {
            return res.status(404).json({ status: 'error', message: 'Content not found' });
        }

        const lesson = await Lesson.findById(content.lesson).populate({ path: 'course' });

        // Check if the user is the course owner or an admin
        if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to update this content' });
        }

        content = await Content.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            status: 'success',
            data: content
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete content
// @route   DELETE /api/v1/contents/:id
// @access  Private (Instructor, Admin)
exports.deleteContent = async (req, res, next) => {
    try {
        const content = await Content.findById(req.params.id);

        if (!content) {
            return res.status(404).json({ status: 'error', message: 'Content not found' });
        }

        const lesson = await Lesson.findById(content.lesson).populate({ path: 'course' });

        // Check if the user is the course owner or an admin
        if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to delete this content' });
        }

        await content.remove();

        res.status(200).json({
            status: 'success',
            data: {}
        });
    } catch (error) {
        next(error);
    }
};
