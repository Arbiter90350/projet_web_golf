const Content = require('../models/Content');
const Lesson = require('../models/Lesson');
const storageService = require('../services/storageService');
const MAX_TIME_MS = Number(process.env.DB_QUERY_MAX_TIME_MS || 15000);

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
    const lesson = await Lesson.findById(req.params.lessonId).maxTimeMS(MAX_TIME_MS);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    const contents = await Content.find({ lesson: req.params.lessonId }).maxTimeMS(MAX_TIME_MS);

    // Génère des URLs signées pour chaque élément (lecture privée)
    const withSigned = await Promise.all(contents.map(async (c) => {
      const signedUrl = await storageService.getSignedUrl(c.fileName);
      return {
        _id: c._id,
        contentType: c.contentType,
        fileName: c.fileName,
        caption: c.caption ?? '',
        // compat FE: expose aussi `url` pour lien direct temporaire
        url: signedUrl,
        lesson: c.lesson,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    }));

    res.status(200).json({
      status: 'success',
      count: withSigned.length,
      data: withSigned,
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

    const lesson = await Lesson.findById(req.params.lessonId).populate({ path: 'course' }).maxTimeMS(MAX_TIME_MS);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    // Check if the user is the course owner or an admin
    if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'User not authorized to add content to this lesson' });
    }

    // Validation d'entrée: on attend fileName (clé interne), pas d'URL publique
    const { contentType, fileName } = req.body || {};
    if (!contentType || !fileName) {
      return res.status(400).json({ status: 'error', message: 'contentType et fileName sont requis' });
    }

    const content = await Content.create({
      contentType,
      fileName,
      caption: typeof req.body.caption === 'string' ? req.body.caption : '',
      lesson: req.params.lessonId,
    });

    const signedUrl = await storageService.getSignedUrl(content.fileName);
    res.status(201).json({
      status: 'success',
      data: {
        _id: content._id,
        contentType: content.contentType,
        fileName: content.fileName,
        caption: content.caption ?? '',
        url: signedUrl,
        lesson: content.lesson,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
      }
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
        const content = await Content.findById(req.params.id).populate({ path: 'lesson', select: 'title' }).maxTimeMS(MAX_TIME_MS);

        if (!content) {
            return res.status(404).json({ status: 'error', message: 'Content not found' });
        }

        const signedUrl = await storageService.getSignedUrl(content.fileName);
        res.status(200).json({
            status: 'success',
            data: {
              _id: content._id,
              contentType: content.contentType,
              fileName: content.fileName,
              caption: content.caption ?? '',
              url: signedUrl,
              lesson: content.lesson,
              createdAt: content.createdAt,
              updatedAt: content.updatedAt,
            }
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
        let content = await Content.findById(req.params.id).maxTimeMS(MAX_TIME_MS);

        if (!content) {
            return res.status(404).json({ status: 'error', message: 'Content not found' });
        }

        const lesson = await Lesson.findById(content.lesson).populate({ path: 'course' }).maxTimeMS(MAX_TIME_MS);

        // Check if the user is the course owner or an admin
        if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to update this content' });
        }

        // N'autoriser que contentType, fileName et caption à être modifiés (pas de lesson)
        const payload = {};
        if (typeof req.body.contentType === 'string') payload.contentType = req.body.contentType;
        if (typeof req.body.fileName === 'string') payload.fileName = req.body.fileName;
        if (typeof req.body.caption === 'string') payload.caption = req.body.caption;

        content = await Content.findByIdAndUpdate(req.params.id, payload, {
            new: true,
            runValidators: true
        }).maxTimeMS(MAX_TIME_MS);

        const signedUrl = await storageService.getSignedUrl(content.fileName);
        res.status(200).json({
            status: 'success',
            data: {
              _id: content._id,
              contentType: content.contentType,
              fileName: content.fileName,
              caption: content.caption ?? '',
              url: signedUrl,
              lesson: content.lesson,
              createdAt: content.createdAt,
              updatedAt: content.updatedAt,
            }
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
        const content = await Content.findById(req.params.id).maxTimeMS(MAX_TIME_MS);

        if (!content) {
            return res.status(404).json({ status: 'error', message: 'Content not found' });
        }

        const lesson = await Lesson.findById(content.lesson).populate({ path: 'course' }).maxTimeMS(MAX_TIME_MS);

        // Check if the user is the course owner or an admin
        if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ status: 'error', message: 'User not authorized to delete this content' });
        }

        await Content.deleteOne({ _id: content._id }).maxTimeMS(MAX_TIME_MS);

        res.status(200).json({
            status: 'success',
            data: {}
        });
    } catch (error) {
        next(error);
    }
};
