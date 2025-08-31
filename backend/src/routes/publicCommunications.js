const express = require('express');
const { query } = require('express-validator');
const { listPublicCommunications } = require('../controllers/communicationController');

const router = express.Router();

// Lecture publique des communications visibles
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  listPublicCommunications
);

module.exports = router;
