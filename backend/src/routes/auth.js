const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
// Limiteurs de débit spécifiques aux routes d'authentification
const { authLimiter, forgotPasswordLimiter, registerLimiter, verifyLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// Data validation for registration
const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .trim(),
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .trim(),
];

// Data validation for login
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// --- Authentication Routes ---

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', registerLimiter, validateRegister, register);

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, validateLogin, login);

// @desc    Verify user email
// @route   GET /api/auth/verify-email/:token
// @access  Public
router.get('/verify-email/:token', verifyEmail);

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
router.post('/resend-verification', verifyLimiter, resendVerification);

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
router.put('/reset-password/:token', authLimiter, resetPassword);

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, getMe);

// @desc    Log user out
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, logout);

module.exports = router;
