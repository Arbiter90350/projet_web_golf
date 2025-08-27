const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const logger = require('../utils/logger');

// Configuration du client S3 pour OVH Object Storage
// Autoriser OVH_ENDPOINT au format avec ou sans schéma (http/https)
function buildOvhEndpoint(raw) {
  if (!raw) return undefined;
  const trimmed = raw.replace(/\s+/g, '').replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

const s3Client = new S3Client({
  // Normaliser la région OVH en minuscule (OVH attend des régions en lowercase dans la signature)
  region: (process.env.OVH_REGION || '').toLowerCase(),
  endpoint: buildOvhEndpoint(process.env.OVH_ENDPOINT),
  credentials: {
    accessKeyId: process.env.OVH_ACCESS_KEY,
    secretAccessKey: process.env.OVH_SECRET_KEY,
  },
  forcePathStyle: true, // Nécessaire pour OVH
});

class StorageService {
  constructor() {
    this.bucketName = process.env.OVH_CONTAINER;
    this.allowedTypes = process.env.ALLOWED_FILE_TYPES
      ? process.env.ALLOWED_FILE_TYPES.split(',').map(t => t.trim())
      : [];
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE, 10) || 50 * 1024 * 1024; // 50MB par défaut
  }

  /**
   * Vérifie si le type de fichier est autorisé
   * @param {string} mimeType - Le type MIME du fichier
   * @returns {boolean}
   */
  isFileTypeAllowed(mimeType) {
    if (!this.allowedTypes.length) return true; // Si aucun type n'est spécifié, tout est autorisé
    return this.allowedTypes.includes(mimeType);
  }

  /**
   * Vérifie si la taille du fichier est acceptable
   * @param {number} size - Taille du fichier en octets
   * @returns {boolean}
   */
  isFileSizeValid(size) {
    return size <= this.maxFileSize;
  }

  /**
   * Génère un nom de fichier unique
   * @param {string} originalName - Nom original du fichier
   * @returns {string} - Nouveau nom de fichier unique
   */
  generateUniqueFilename(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const uniqueId = uuidv4();
    return `${uniqueId}${ext}`;
  }

  /**
   * Télécharge un fichier vers OVH Object Storage
   * @param {Buffer} fileBuffer - Le contenu du fichier en buffer
   * @param {string} fileName - Le nom du fichier dans le stockage
   * @param {string} mimeType - Le type MIME du fichier
   * @returns {Promise<Object>} - Les métadonnées du fichier uploadé
   */
  async uploadFile(fileBuffer, fileName, mimeType) {
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType,
      // Modèle privé: pas d'ACL public-read. L'accès se fait via URL signée.
    };

    try {
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
      
      // Retourne l'URL publique du fichier
      return {
        fileName,
        url: `${process.env.OVH_BASE_URL}/${fileName}`,
        mimeType,
        size: fileBuffer.length,
      };
    } catch (error) {
      logger.error('Erreur lors de l\'upload vers OVH Object Storage:', error);
      throw new Error('Échec de l\'upload du fichier');
    }
  }

  /**
   * Génère une URL pré-signée (PUT) pour téléverser directement vers OVH depuis le client
   * @param {string} fileName - Le nom/clé du fichier cible dans le conteneur
   * @param {string} mimeType - Le type MIME du fichier
   * @param {number} expiresIn - Durée de validité en secondes (défaut 15 minutes)
   * @returns {Promise<{ url: string }>} - URL pré-signée PUT
   */
  async getUploadPresignedUrl(fileName, mimeType, expiresIn = 900) {
    // Important: ne pas inclure ContentType dans les paramètres signés.
    // Certains fournisseurs S3 compatibles (OVH) retournent une erreur si l'en-tête
    // envoyé lors du PUT ne correspond pas exactement à celui signé. En n'incluant pas
    // ContentType dans la signature, on évite les divergences côté client.
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
      // Modèle privé: ne pas définir d'ACL publique
    };

    try {
      const command = new PutObjectCommand(params);
      // OVH compat: exclure x-amz-content-sha256 de la signature pour éviter les 400 Bad Request
      const url = await getSignedUrl(s3Client, command, {
        expiresIn,
        unsignableHeaders: new Set(['x-amz-content-sha256'])
      });
      return { url };
    } catch (error) {
      logger.error('Erreur lors de la génération de l\'URL pré-signée d\'upload:', error);
      throw new Error('Impossible de générer l\'URL pré-signée');
    }
  }

  /**
   * Supprime un fichier d'OVH Object Storage
   * @param {string} fileName - Le nom du fichier à supprimer
   * @returns {Promise<boolean>}
   */
  async deleteFile(fileName) {
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
    };

    try {
      const command = new DeleteObjectCommand(params);
      await s3Client.send(command);
      return true;
    } catch (error) {
      logger.error('Erreur lors de la suppression du fichier OVH Object Storage:', error);
      throw new Error('Échec de la suppression du fichier');
    }
  }

  /**
   * Génère une URL signée pour accéder à un fichier privé
   * @param {string} fileName - Le nom du fichier
   * @param {number} expiresIn - Durée de validité en secondes (par défaut 1h)
   * @returns {Promise<string>} - URL signée
   */
  async getSignedUrl(fileName, expiresIn = 3600) {
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
    };

    try {
      const command = new GetObjectCommand(params);
      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      logger.error('Erreur lors de la génération de l\'URL signée:', error);
      throw new Error('Impossible de générer l\'URL signée');
    }
  }

  /**
   * Extrait la clé du fichier à partir d'une URL complète
   * @param {string} url - URL complète du fichier
   * @returns {string} - Clé du fichier
   */
  extractFileKeyFromUrl(url) {
    if (!url) return null;
    // Supprime la base de l'URL pour ne garder que la clé du fichier
    return url.replace(`${process.env.OVH_BASE_URL}/`, '');
  }
}

module.exports = new StorageService();
