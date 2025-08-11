const mongoose = require('mongoose');
const logger = require('./utils/logger');
require('dotenv').config();

const connectDB = async () => {
  try {
    const isProd = (process.env.NODE_ENV || 'development') === 'production';
    await mongoose.connect(process.env.MONGO_URI, {
      // Options modernes Mongoose v8
      maxPoolSize: 10,
      autoIndex: !isProd, // index automatiques en dev uniquement
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed', { message: error.message });
    // Sortie avec échec
    process.exit(1);
  }
};

// Gestion des événements de connexion
mongoose.connection.on('error', err => {
  logger.error('MongoDB connection error', { message: err?.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

// Gestion des signaux d'arrêt
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = connectDB;
