// Limiteurs de débit (rate limiting)
const { generalLimiter } = require('./middleware/rateLimiters');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
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
const userRoutes = require('./routes/users');
const fileRoutes = require('./routes/files');

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

// Middleware pour corréler les requêtes (X-Request-Id)
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Rate limiting global: protège l'ensemble de l'API
app.use(generalLimiter);

// Middleware de logging HTTP (morgan) relié à Winston
// Ajoute un token morgan pour l'identifiant de requête
morgan.token('id', (req) => req.id);
const httpLogFormat = ':remote-addr - :method :url :status :res[content-length] - :response-time ms reqId=:id';
app.use(
  morgan(httpLogFormat, {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// Routes d'API
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/contents', contentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);

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
    path: req.originalUrl,
    requestId: req.id
  });
});

// Gestion des erreurs globales (ne pas divulguer d'informations sensibles)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  // Log l'objet Error pour capturer la stack via Winston, avec méta non sensible
  logger.error(err, {
    statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    reqId: req.id,
  });
  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    requestId: req.id,
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

  // Configuration des timeouts HTTP pour éviter les requêtes pendantes (DoS, clients lents)
  // Valeurs par défaut raisonnables; ajustables via variables d'environnement
  const REQUEST_TIMEOUT_MS = Number(process.env.SERVER_REQUEST_TIMEOUT_MS || 60000); // temps total d'une requête
  const HEADERS_TIMEOUT_MS = Number(process.env.SERVER_HEADERS_TIMEOUT_MS || 65000); // doit être >= keepAlive + marge
  const KEEPALIVE_TIMEOUT_MS = Number(process.env.SERVER_KEEPALIVE_TIMEOUT_MS || 60000);
  const SOCKET_TIMEOUT_MS = Number(process.env.SERVER_SOCKET_TIMEOUT_MS || 0); // 0 = désactivé

  try {
    // Node >= 18: propriétés supportées
    server.requestTimeout = REQUEST_TIMEOUT_MS;
    server.headersTimeout = HEADERS_TIMEOUT_MS;
    server.keepAliveTimeout = KEEPALIVE_TIMEOUT_MS;
    if (SOCKET_TIMEOUT_MS > 0) server.setTimeout(SOCKET_TIMEOUT_MS);
    logger.info('HTTP timeouts configured', {
      requestTimeoutMs: server.requestTimeout,
      headersTimeoutMs: server.headersTimeout,
      keepAliveTimeoutMs: server.keepAliveTimeout,
      socketTimeoutMs: SOCKET_TIMEOUT_MS,
    });
  } catch (e) {
    logger.warn('Failed to configure HTTP timeouts; using Node defaults', { error: e?.message });
  }

  // Gestion des erreurs non capturées
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection', { error: err?.message, stack: err?.stack });
    server.close(() => process.exit(1));
  });

  // Gestion des exceptions non interceptées
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err?.message, stack: err?.stack });
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
