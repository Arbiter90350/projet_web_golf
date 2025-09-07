// Contrôleur de progression des élèves
// Règles: validation par lecture (read) ou par instructeur (pro)
// QCM géré via quizController.submitQuiz

const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const MAX_TIME_MS = Number(process.env.DB_QUERY_MAX_TIME_MS || 15000);

// @desc    Marquer une leçon comme lue (=> acquis) pour l'utilisateur courant
// @route   PATCH /api/v1/progress/lessons/:lessonId/read
// @access  Private (Player)
exports.markAsRead = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findById(lessonId).maxTimeMS(MAX_TIME_MS);
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
    ).maxTimeMS(MAX_TIME_MS);

    return res.status(200).json({ status: 'success', data: userProgress });
  } catch (error) {
    next(error);
  }
};

// @desc    Récapitulatif progression: totaux (toutes les leçons) + dernières mises à jour
// @route   GET /api/v1/progress/summary
// @access  Private (Player)
exports.getMySummary = async (req, res, next) => {
  try {
    // Tous les joueurs ont le même cursus => total = nb total de leçons toutes courses confondues
    const totalLessons = await Lesson.countDocuments({}).maxTimeMS(MAX_TIME_MS);

    // Comptages utilisateur
    const [completedCount, inProgressCount] = await Promise.all([
      UserProgress.countDocuments({ user: req.user.id, status: 'completed' }).maxTimeMS(MAX_TIME_MS),
      UserProgress.countDocuments({ user: req.user.id, status: 'in_progress' }).maxTimeMS(MAX_TIME_MS),
    ]);

    // 3 dernières mises à jour (quel que soit le statut)
    const latest = await UserProgress.find({ user: req.user.id })
      .sort('-updatedAt')
      .limit(3)
      // Populate de la leçon + du module (course) pour récupérer les titres
      .populate({
        path: 'lesson',
        select: 'title order course',
        populate: { path: 'course', select: 'title order' },
      })
      .lean()
      .maxTimeMS(MAX_TIME_MS);

    const latestChanges = latest.map((p) => ({
      lessonId: p.lesson?._id || null,
      lessonTitle: p.lesson?.title || '—',
      order: typeof p.lesson?.order === 'number' ? p.lesson.order : null,
      // Champs supplémentaires côté client: informations de module (course)
      courseTitle: typeof p.lesson?.course === 'object' && p.lesson?.course?.title ? p.lesson.course.title : null,
      courseOrder: typeof p.lesson?.course === 'object' && typeof p.lesson?.course?.order === 'number' ? p.lesson.course.order : null,
      status: p.status,
      updatedAt: p.updatedAt,
    }));

    // Étape la plus avancée en cours: plus grand order parmi les "in_progress"
    const inProg = await UserProgress.find({ user: req.user.id, status: 'in_progress' })
      .populate({
        path: 'lesson',
        select: 'title order course',
        populate: { path: 'course', select: 'title order' },
      })
      .lean()
      .maxTimeMS(MAX_TIME_MS);
    let mostAdvancedInProgress = null;
    for (const p of inProg) {
      if (!p.lesson || typeof p.lesson.order !== 'number') continue;
      if (!mostAdvancedInProgress || p.lesson.order > mostAdvancedInProgress.order) {
        mostAdvancedInProgress = {
          lessonId: p.lesson._id,
          lessonTitle: p.lesson.title,
          order: p.lesson.order,
          // Exposition des infos module (course)
          courseTitle: typeof p.lesson.course === 'object' && p.lesson.course?.title ? p.lesson.course.title : null,
          courseOrder: typeof p.lesson.course === 'object' && typeof p.lesson.course?.order === 'number' ? p.lesson.course.order : null,
          status: p.status,
          updatedAt: p.updatedAt,
        };
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        totals: {
          totalLessons,
          completedCount,
          inProgressCount,
        },
        mostAdvancedInProgress,
        latestChanges,
      },
    });
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

    const lesson = await Lesson.findById(lessonId).maxTimeMS(MAX_TIME_MS);
    if (!lesson) {
      return res.status(404).json({ status: 'error', message: 'Lesson not found' });
    }

    // Produit: lever le blocage — un instructeur/admin peut désormais forcer le statut
    // de n'importe quelle leçon (read, quiz, pro) pour un élève ciblé.

    // Sécurité RBAC: instructeur ou admin peuvent valider pour n'importe quel joueur (règle produit)
    const player = await User.findById(userId).select('_id role assignedInstructor').maxTimeMS(MAX_TIME_MS);
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
    ).maxTimeMS(MAX_TIME_MS);

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
      const lessons = await Lesson.find({ course: courseId }).select('_id').maxTimeMS(MAX_TIME_MS);
      const lessonIds = lessons.map((l) => l._id);
      filter.lesson = { $in: lessonIds };
    }

    const progress = await UserProgress.find(filter).maxTimeMS(MAX_TIME_MS);

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
    // Nouvelle implémentation: retourne aussi
    // - lastProgressAt: dernière maj de progression (UserProgress.updatedAt max)
    // - mostAdvancedInProgress: leçon en cours avec l'ordre maximum et son module (course)
    const pipeline = [
      { $match: { role: 'player', isEmailVerified: true } },
      // Dernière progression (tous statuts)
      {
        $lookup: {
          from: 'userprogresses',
          localField: '_id',
          foreignField: 'user',
          as: 'allProgress',
          pipeline: [ { $project: { updatedAt: 1 } } ]
        }
      },
      { $addFields: { lastProgressAt: { $max: '$allProgress.updatedAt' } } },
      // Plus grande étape en cours (status = in_progress), avec jointures Lesson->Course
      {
        $lookup: {
          from: 'userprogresses',
          let: { uid: '$_id' },
          as: 'advInProg',
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$user', '$$uid'] }, { $eq: ['$status', 'in_progress'] } ] } } },
            { $lookup: { from: 'lessons', localField: 'lesson', foreignField: '_id', as: 'lesson' } },
            { $unwind: '$lesson' },
            { $lookup: { from: 'courses', localField: 'lesson.course', foreignField: '_id', as: 'course' } },
            { $unwind: '$course' },
            { $sort: { 'lesson.order': -1 } },
            { $limit: 1 },
            { $project: {
              lessonId: '$lesson._id',
              lessonTitle: '$lesson.title',
              order: '$lesson.order',
              courseId: '$course._id',
              courseTitle: '$course.title',
              updatedAt: 1,
            } }
          ]
        }
      },
      { $addFields: { mostAdvancedInProgress: { $first: '$advInProg' } } },
      // Module le plus avancé (progress > 0%).
      // Règle métier: le rang du module est porté par Course.order (1 = moins avancé).
      // On sélectionne le module ayant progressé avec l'ordre le plus élevé.
      {
        $lookup: {
          from: 'userprogresses',
          let: { uid: '$_id' },
          as: 'advAnyCourse',
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$user', '$$uid'] }, { $in: ['$status', ['in_progress','completed']] } ] } } },
            { $lookup: { from: 'lessons', localField: 'lesson', foreignField: '_id', as: 'lesson' } },
            { $unwind: '$lesson' },
            { $group: { _id: '$lesson.course' } },
            { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
            { $unwind: '$course' },
            { $sort: { 'course.order': -1 } },
            { $limit: 1 },
            { $project: { courseId: '$_id', courseTitle: '$course.title', courseOrder: '$course.order' } }
          ]
        }
      },
      { $addFields: { topCourseByProgress: { $first: '$advAnyCourse' } } },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          isActive: 1,
          isEmailVerified: 1,
          lastLogin: 1,
          assignedInstructor: 1,
          lastProgressAt: 1,
          mostAdvancedInProgress: 1,
          topCourseByProgress: 1,
        }
      }
    ];

    // Mongoose Aggregate ne supporte pas maxTimeMS() partout: utiliser option({ maxTimeMS })
    const players = await User.aggregate(pipeline).option({ maxTimeMS: MAX_TIME_MS });
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

    const player = await User.findById(userId).select('_id role assignedInstructor').maxTimeMS(MAX_TIME_MS);
    if (!player || player.role !== 'player') {
      return res.status(404).json({ status: 'error', message: 'Player not found' });
    }
    // Instructeur: accès à tous les joueurs (règle produit)

    let filter = { user: userId };
    if (courseId) {
      const lessons = await Lesson.find({ course: courseId }).select('_id').maxTimeMS(MAX_TIME_MS);
      filter.lesson = { $in: lessons.map(l => l._id) };
    }

    const progress = await UserProgress.find(filter).maxTimeMS(MAX_TIME_MS);
    return res.status(200).json({ status: 'success', count: progress.length, data: progress });
  } catch (error) {
    next(error);
  }
};
