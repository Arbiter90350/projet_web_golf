const express = require('express');
const multer = require('multer');
const fileController = require('../controllers/fileController');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// Configuration de multer pour le stockage en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 50 * 1024 * 1024, // 50MB par défaut
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES 
      ? process.env.ALLOWED_FILE_TYPES.split(',').map(t => t.trim())
      : [];
    
    if (allowedTypes.length && !allowedTypes.includes(file.mimetype)) {
      const error = new Error('Type de fichier non autorisé');
      error.status = 400;
      return cb(error, false);
    }
    
    cb(null, true);
  },
});

// Routes protégées par authentification
router.use(protect);

// Lister les fichiers (listing complet, pagination côté contrôleur)
router.get(
  '/',
  authorize('instructor', 'admin'),
  fileController.listFiles
);

// Télécharger un fichier
// Seuls les utilisateurs avec le rôle 'instructor' ou 'admin' peuvent uploader des fichiers
router.post(
  '/upload',
  authorize('instructor', 'admin'),
  upload.single('file'),
  fileController.uploadFile
);

// Obtenir une URL pré-signée pour upload direct (PUT) vers OVH
// Même RBAC que l'upload classique
router.post(
  '/presign',
  authorize('instructor', 'admin'),
  fileController.presignUpload
);

// Enregistrer les métadonnées après un upload direct réussi
router.post(
  '/record',
  authorize('instructor', 'admin'),
  fileController.recordUpload
);

// Supprimer un fichier
// Seuls les utilisateurs avec le rôle 'instructor' ou 'admin' peuvent supprimer des fichiers
router.delete(
  '/delete',
  authorize('instructor', 'admin'),
  fileController.deleteFile
);

// Obtenir une URL signée pour un fichier privé
router.post('/signed-url', fileController.getSignedUrl);

module.exports = router;
