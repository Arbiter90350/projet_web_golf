const storageService = require('../services/storageService');
const logger = require('../utils/logger');
const File = require('../models/File');

class FileController {
  /**
   * Télécharge un fichier vers OVH Object Storage
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @param {Function} next - Middleware suivant
   */
  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun fichier fourni' 
        });
      }

      const { buffer, originalname, mimetype, size } = req.file;

      // Vérification du type de fichier
      if (!storageService.isFileTypeAllowed(mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Type de fichier non autorisé. Types autorisés: ${process.env.ALLOWED_FILE_TYPES}`,
        });
      }

      // Vérification de la taille du fichier
      if (!storageService.isFileSizeValid(size)) {
        const maxSizeMB = Math.floor(parseInt(process.env.MAX_FILE_SIZE, 10) / (1024 * 1024));
        return res.status(400).json({
          success: false,
          message: `Fichier trop volumineux. Taille maximale: ${maxSizeMB} Mo`,
        });
      }

      // Génération d'un nom de fichier unique
      const fileName = storageService.generateUniqueFilename(originalname);
      
      // Upload du fichier
      const fileData = await storageService.uploadFile(buffer, fileName, mimetype);

      // Enregistrer les métadonnées en base (modèle privé)
      await File.create({
        fileName,
        originalName: originalname,
        mimeType: mimetype,
        size,
        uploader: req.user && req.user.id,
      });

      res.status(201).json({
        success: true,
        data: fileData,
      });
    } catch (error) {
      logger.error('Erreur lors du téléchargement du fichier:', error);
      next(error);
    }
  }

  /**
   * Supprime un fichier d'OVH Object Storage
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @param {Function} next - Middleware suivant
   */
  async deleteFile(req, res, next) {
    try {
      const { fileUrl, fileName } = req.body;
      
      if (!fileUrl && !fileName) {
        return res.status(400).json({
          success: false,
          message: 'Paramètres manquants: fournir fileUrl ou fileName',
        });
      }

      // Extraction de la clé du fichier à partir de l'URL
      const fileKey = fileName || storageService.extractFileKeyFromUrl(fileUrl);
      
      if (!fileKey) {
        return res.status(400).json({
          success: false,
          message: 'URL de fichier invalide',
        });
      }

      // Suppression du fichier
      await storageService.deleteFile(fileKey);

      // Supprimer l'enregistrement en base si présent
      await File.deleteOne({ fileName: fileKey }).catch(() => {});

      res.status(200).json({
        success: true,
        message: 'Fichier supprimé avec succès',
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression du fichier:', error);
      next(error);
    }
  }

  /**
   * Génère une URL pré-signée pour upload direct vers OVH (PUT)
   * Valide le type MIME et la taille côté serveur avant de signer
   * @param {Object} req
   * @param {Object} res
   * @param {Function} next
   */
  async presignUpload(req, res, next) {
    try {
      const { mimeType, size, originalName } = req.body || {};

      if (!mimeType || typeof size !== 'number' || size <= 0 || !originalName) {
        return res.status(400).json({
          success: false,
          message: 'Paramètres invalides: mimeType, size et originalName requis',
        });
      }

      // Vérifications côté serveur
      if (!storageService.isFileTypeAllowed(mimeType)) {
        return res.status(400).json({
          success: false,
          message: `Type de fichier non autorisé. Types autorisés: ${process.env.ALLOWED_FILE_TYPES}`,
        });
      }

      if (!storageService.isFileSizeValid(size)) {
        const maxSizeMB = Math.floor(parseInt(process.env.MAX_FILE_SIZE, 10) / (1024 * 1024));
        return res.status(400).json({
          success: false,
          message: `Fichier trop volumineux. Taille maximale: ${maxSizeMB} Mo`,
        });
      }

      // Génère un nom/clé unique conservant l'extension
      const fileName = storageService.generateUniqueFilename(originalName);

      // Génère l'URL pré-signée (modèle privé)
      const { url } = await storageService.getUploadPresignedUrl(fileName, mimeType);

      return res.status(200).json({
        success: true,
        // NB: En modèle privé, l'objet n'est pas publiquement accessible. Utiliser /files/signed-url pour lecture.
        data: { url, fileName, mimeType, size },
      });
    } catch (error) {
      logger.error('Erreur lors de la génération de l\'URL présignée d\'upload:', error);
      next(error);
    }
  }

  /**
   * Génère une URL signée pour accéder à un fichier privé
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @param {Function} next - Middleware suivant
   */
  async getSignedUrl(req, res, next) {
    try {
      const { fileUrl, fileName } = req.body || {};

      let fileKey = null;
      if (fileName) {
        fileKey = fileName;
      } else if (fileUrl) {
        // Extraction de la clé du fichier à partir de l'URL complète
        fileKey = storageService.extractFileKeyFromUrl(fileUrl);
      }
      
      if (!fileKey) {
        return res.status(400).json({
          success: false,
          message: 'Paramètre invalide: fournir fileName ou fileUrl',
        });
      }

      // Génération d'une URL signée valide 1h
      const signedUrl = await storageService.getSignedUrl(fileKey);

      res.status(200).json({
        success: true,
        data: { signedUrl },
      });
    } catch (error) {
      logger.error('Erreur lors de la génération de l\'URL signée:', error);
      next(error);
    }
  }

  /**
   * Enregistre en base les métadonnées d'un fichier après upload direct (PUT) réussi
   * @param {Object} req
   * @param {Object} res
   * @param {Function} next
   */
  async recordUpload(req, res, next) {
    try {
      const { fileName, originalName, mimeType, size, courseId, lessonId } = req.body || {};

      if (!fileName || !originalName || !mimeType || typeof size !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Paramètres invalides: fileName, originalName, mimeType et size requis',
        });
      }

      const payload = {
        fileName,
        originalName,
        mimeType,
        size,
        uploader: req.user && req.user.id,
      };
      if (courseId) payload.courseId = courseId;
      if (lessonId) payload.lessonId = lessonId;

      const created = await File.findOneAndUpdate(
        { fileName },
        payload,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json({ success: true, data: created });
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement des métadonnées de fichier:', error);
      next(error);
    }
  }

  /**
   * Liste paginée des fichiers avec recherche et filtres
   * Query:
   *  - page, limit
   *  - q: recherche texte (originalName, fileName)
   *  - type: 'image' | 'video' | 'pdf' | '<mime-type>' (ex: 'application/pdf', 'image/png')
   */
  async listFiles(req, res, next) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

      // Construction du filtre
      const filter = {};
      const qRaw = (req.query.q || '').toString();
      const typeRaw = (req.query.type || '').toString();
      const q = qRaw.trim();
      const type = typeRaw.trim().toLowerCase();

      // Recherche simple (regex insensible à la casse) sur originalName et fileName
      if (q) {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { originalName: { $regex: escaped, $options: 'i' } },
          { fileName: { $regex: escaped, $options: 'i' } },
        ];
      }

      // Filtrage par type
      if (type) {
        if (type === 'image') {
          filter.mimeType = { $regex: '^image\/' };
        } else if (type === 'video') {
          filter.mimeType = { $regex: '^video\/' };
        } else if (type === 'pdf') {
          filter.mimeType = 'application/pdf';
        } else if (type.includes('/')) {
          // Type MIME exact ou préfixe (ex: image/)
          const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (escapedType.endsWith('\/')) {
            filter.mimeType = { $regex: `^${escapedType}` };
          } else {
            filter.mimeType = escapedType;
          }
        }
      }

      const [items, total] = await Promise.all([
        File.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        File.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: { items, page, limit, total },
      });
    } catch (error) {
      logger.error('Erreur lors du listing des fichiers:', error);
      next(error);
    }
  }
}

module.exports = new FileController();
