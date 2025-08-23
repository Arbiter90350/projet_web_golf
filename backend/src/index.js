// Limiteurs de débit (rate limiting)
const { generalLimiter } = require('./middleware/rateLimiters');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./db');
const logger = require('./utils/logger');
require('dotenv').config();

// Import des routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const lessonRoutes = require('./routes/lessons');
const quizRoutes = require('./routes/quizzes');
const questionRoutes = require('./routes/questions');
const answerRoutes = require('./routes/answers');
const contentRoutes = require('./routes/contents');
const progressRoutes = require('./routes/progress');

// Initialisation de l'application Express
const app = express();

// Optionnel: faire confiance au proxy (ex: Nginx) pour récupérer la bonne IP client
// Activez-le en production avec la variable d'environnement TRUST_PROXY=1
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Connexion à la base de données
connectDB();

// Middleware de sécurité
app.use(helmet());

// Configuration CORS (origines limitées via variables d'environnement)
// CORS_ORIGINS peut contenir une liste d'origines séparées par des virgules
// À défaut, FRONTEND_URL est utilisé. En développement, on autorise toutes les origines si non configuré.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    // Requêtes non-browser (ex: curl, Postman) ou absence de config => autoriser
    if (!origin || allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting global: protège l'ensemble de l'API
app.use(generalLimiter);

// Middleware de logging HTTP (morgan) relié à Winston
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// Routes d'API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/modules', courseRoutes); // alias des cours en tant que modules
app.use('/api/v1/lessons', lessonRoutes);
app.use('/api/v1/quizzes', quizRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/answers', answerRoutes);
app.use('/api/v1/contents', contentRoutes);
app.use('/api/v1/progress', progressRoutes);

// Routes de base
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Fairway Progress Hub API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// Route de santé
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({
    status: 'success',
    data: {
      server: 'running',
      database: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Gestion des erreurs globales (ne pas divulguer d'informations sensibles)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  logger.error(message, {
    statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Configuration du port
const PORT = process.env.PORT || 5000;

// Démarrer le serveur uniquement si ce fichier est exécuté directement
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Node.js version: ${process.version}`);
    logger.info(`MongoDB connected: ${mongoose.connection.readyState === 1 ? 'yes' : 'no'}`);
  });

  // Gestion des erreurs non capturées
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection', { error: err?.message, stack: err?.stack });
    server.close(() => process.exit(1));
  });

  // Gestion des signaux d'arrêt
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    });
  };

  // Écouter les signaux d'arrêt
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
