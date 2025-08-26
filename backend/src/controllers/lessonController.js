const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const UserProgress = require('../models/UserProgress');
const Content = require('../models/Content');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const logger = require('../utils/logger');

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

    // Règle produit: ignorer tout "order" fourni par le client et ajouter en fin de liste
    const last = await Lesson.find({ course: req.params.courseId }).sort('-order').limit(1);
    const nextOrder = last.length ? (Number(last[0].order) + 1) : 1;

    const payload = {
      title: req.body.title,
      validationMode: req.body.validationMode || 'read',
      description: req.body.description,
      course: req.params.courseId,
      order: nextOrder,
    };

    const lesson = await Lesson.create(payload);

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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid lesson id' });
        }
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
// @desc    Réordonner les leçons d'un cours par liste d'IDs (ordre croissant 1..n)
// @route   PATCH /api/v1/courses/:courseId/lessons/reorder
// @access  Private (Instructor, Admin)
exports.reorderLessons = async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { orderedIds } = req.body || {};
  
      // Valider courseId pour éviter les CastError 500
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid courseId parameter' });
      }
  
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ status: 'error', message: 'orderedIds must be a non-empty array' });
      }
  
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ status: 'error', message: 'Course not found' });
      }
  
      // Charger les leçons existantes du cours
      const lessons = await Lesson.find({ course: courseId }).select('_id order');
      const existingIds = new Set(lessons.map(l => String(l._id)));
  
      // Valider que tous les IDs proposés existent et appartiennent au cours
      for (const id of orderedIds) {
        if (!existingIds.has(String(id))) {
          return res.status(400).json({ status: 'error', message: `Invalid lesson id in orderedIds: ${id}` });
        }
      }
  
      // Optionnel: si certains existants ne sont pas dans orderedIds, on les place après, en conservant leur ordre relatif
      const missing = lessons.map(l => String(l._id)).filter(id => !orderedIds.includes(id));
      const finalOrder = [...orderedIds.map(String), ...missing];
  
      // Pour éviter les collisions sur l'index unique (course, order), on procède en deux phases:
      // 1) Ordres temporaires élevés et uniques (ex: 1000+idx)
      const tempOps = finalOrder.map((id, idx) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order: 1000 + idx } },
        }
      }));
      await Lesson.bulkWrite(tempOps);
  
      // 2) Ordres finaux 1..n
      const finalOps = finalOrder.map((id, idx) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order: idx + 1 } },
        }
      }));
      await Lesson.bulkWrite(finalOps);
  
      const updated = await Lesson.find({ course: courseId }).sort('order');
      return res.status(200).json({ status: 'success', count: updated.length, data: updated });
    } catch (error) {
      next(error);
    }
};    

// @desc    Update a lesson
// @route   PUT /api/v1/lessons/:id
// @access  Private (Instructor, Admin)
exports.updateLesson = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid lesson id' });
        }
        let lesson = await Lesson.findById(req.params.id);

        if (!lesson) {
            return res.status(404).json({ status: 'error', message: 'Lesson not found' });
        }

        const course = await Course.findById(lesson.course);

        // Sécurité produit: la modification de l'ordre se fait uniquement via l'endpoint de réordonnancement
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'order')) {
            delete req.body.order;
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
        logger.info('Lesson delete requested', { lessonId: req.params.id, userId: req.user?.id });
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            logger.warn('Invalid lesson id on delete', { lessonId: req.params.id });
            return res.status(400).json({ status: 'error', message: 'Invalid lesson id' });
        }
        const lesson = await Lesson.findById(req.params.id);

        if (!lesson) {
            logger.warn('Lesson not found on delete', { lessonId: req.params.id });
            return res.status(404).json({ status: 'error', message: 'Lesson not found' });
        }

        const course = await Course.findById(lesson.course);

        // Supprimer les contenus et progressions liés à cette leçon
        logger.debug('Deleting lesson related contents and progress', { lessonId: String(lesson._id) });
        await Promise.all([
            Content.deleteMany({ lesson: lesson._id }),
            UserProgress.deleteMany({ lesson: lesson._id }),
        ]);

        // Supprimer le quiz de la leçon et ses questions/réponses
        logger.debug('Deleting lesson quiz and Q&A if present', { lessonId: String(lesson._id) });
        const quiz = await Quiz.findOne({ lesson: lesson._id }).select('_id');
        if (quiz) {
            const questions = await Question.find({ quiz: quiz._id }).select('_id');
            const questionIds = questions.map(q => q._id);
            if (questionIds.length) {
                await Answer.deleteMany({ question: { $in: questionIds } });
                await Question.deleteMany({ _id: { $in: questionIds } });
            }
            await Quiz.deleteOne({ _id: quiz._id });
        }

        // Mongoose v7+: utiliser deleteOne
        await Lesson.deleteOne({ _id: lesson._id });

        logger.info('Lesson deleted successfully', { lessonId: String(lesson._id), courseId: String(lesson.course) });

        res.status(200).json({
            status: 'success',
            data: {}
        });
    } catch (error) {
        logger.error('Error while deleting lesson', { lessonId: req.params?.id, error: error?.message });        
        next(error);
    }
};
