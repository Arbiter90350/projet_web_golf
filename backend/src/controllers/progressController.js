// Contrôleur de progression des élèves
// Règles: validation par lecture (read) ou par instructeur (pro)
// QCM géré via quizController.submitQuiz

const Lesson = require('../models/Lesson');
const UserProgress = require('../models/UserProgress');

// @desc    Marquer une leçon comme lue (=> acquis) pour l'utilisateur courant
// @route   PATCH /api/v1/progress/lessons/:lessonId/read
// @access  Private (Player)
exports.markAsRead = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    if (lesson.validationMode !== 'read') {
      return res.status(400).json({ status: 'error', message: 'This lesson is not validated by reading' });
    }

    const userProgress = await UserProgress.findOneAndUpdate(
      { user: req.user.id, lesson: lessonId },
      { status: 'completed' },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({ status: 'success', data: userProgress });
  } catch (error) {
    next(error);
  }
};

// @desc    Valider/Dévalider une leçon pour un élève (action instructeur/admin)
// @route   PATCH /api/v1/progress/lessons/:lessonId/pro-validate
// @access  Private (Instructor, Admin)
exports.proValidate = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { userId, completed, status } = req.body || {};

    if (!userId) {
      return res.status(400).json({ status: 'error', message: 'userId is required' });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    if (lesson.validationMode !== 'pro') {
      return res.status(400).json({ status: 'error', message: 'This lesson is not validated by instructor' });
    }

    // Déterminer le statut à appliquer
    let newStatus = 'not_started';
    if (typeof status === 'string' && ['not_started', 'in_progress', 'completed'].includes(status)) {
      newStatus = status;
    } else if (typeof completed === 'boolean') {
      newStatus = completed ? 'completed' : 'not_started';
    } else {
      newStatus = 'completed'; // défaut: marquer acquis
    }

    const userProgress = await UserProgress.findOneAndUpdate(
      { user: userId, lesson: lessonId },
      { status: newStatus },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({ status: 'success', data: userProgress });
  } catch (error) {
    next(error);
  }
};

// @desc    Récupérer la progression de l'utilisateur connecté (option: filtrer par courseId)
// @route   GET /api/v1/progress/me
// @access  Private
exports.getMyProgress = async (req, res, next) => {
  try {
    const { courseId } = req.query || {};

    let filter = { user: req.user.id };

    if (courseId) {
      // Récupérer les lessons de ce cours pour filtrer
      const lessons = await Lesson.find({ course: courseId }).select('_id');
      const lessonIds = lessons.map((l) => l._id);
      filter.lesson = { $in: lessonIds };
    }

    const progress = await UserProgress.find(filter);

    return res.status(200).json({ status: 'success', count: progress.length, data: progress });
  } catch (error) {
    next(error);
  }
};
