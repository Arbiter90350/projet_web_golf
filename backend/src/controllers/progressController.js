// Contrôleur de progression des élèves
// Règles: validation par lecture (read) ou par instructeur (pro)
// QCM géré via quizController.submitQuiz

const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const User = require('../models/User');
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

    // Produit: lever le blocage — un instructeur/admin peut désormais forcer le statut
    // de n'importe quelle leçon (read, quiz, pro) pour un élève ciblé.

    // Sécurité RBAC: instructeur ou admin peuvent valider pour n'importe quel joueur (règle produit)
    const player = await User.findById(userId).select('_id role assignedInstructor');
    if (!player || player.role !== 'player') {
      return res.status(404).json({ status: 'error', message: 'Target player not found' });
    }
    // Plus de restriction par assignation/propriété de cours pour l'instructeur

    // Déterminer le statut à appliquer
    let newStatus = 'not_started';
    if (typeof status === 'string' && ['not_started', 'in_progress', 'completed'].includes(status)) {
      newStatus = status;
    } else if (typeof completed === 'boolean') {
      newStatus = completed ? 'completed' : 'not_started';
    } else {
      newStatus = 'completed'; // défaut: marquer acquis
    }

    // Construire la mise à jour: si reset (not_started), on supprime le score
    let updateDoc;
    if (newStatus === 'not_started') {
      updateDoc = { $set: { status: newStatus }, $unset: { score: '' } };
    } else {
      updateDoc = { $set: { status: newStatus } };
    }

    const userProgress = await UserProgress.findOneAndUpdate(
      { user: userId, lesson: lessonId },
      updateDoc,
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

// @desc    Lister les élèves (tous les comptes 'player')
//          Nouvelle règle produit: instructeurs et admins voient TOUS les joueurs
// @route   GET /api/v1/progress/players
// @access  Private (Instructor, Admin)
exports.listMyPlayers = async (req, res, next) => {
  try {
    // Tous les joueurs
    const filter = { role: 'player' };
    const players = await User.find(filter)
      .select('_id firstName lastName email isActive lastLogin assignedInstructor')
      .lean();
    return res.status(200).json({ status: 'success', count: players.length, data: players });
  } catch (error) {
    next(error);
  }
};

// @desc    Récupérer la progression d'un joueur (restreint à l'instructeur assigné ou admin)
// @route   GET /api/v1/progress/players/:userId
// @access  Private (Instructor, Admin)
exports.getPlayerProgress = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { courseId } = req.query || {};

    const player = await User.findById(userId).select('_id role assignedInstructor');
    if (!player || player.role !== 'player') {
      return res.status(404).json({ status: 'error', message: 'Player not found' });
    }
    // Instructeur: accès à tous les joueurs (règle produit)

    let filter = { user: userId };
    if (courseId) {
      const lessons = await Lesson.find({ course: courseId }).select('_id');
      filter.lesson = { $in: lessons.map(l => l._id) };
    }

    const progress = await UserProgress.find(filter);
    return res.status(200).json({ status: 'success', count: progress.length, data: progress });
  } catch (error) {
    next(error);
  }
};
