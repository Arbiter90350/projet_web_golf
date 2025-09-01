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
  resetPassword,
  updateMe,
  deleteMe,
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
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      gmail_convert_googlemaildotcom: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }),
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
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      gmail_convert_googlemaildotcom: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }),
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

// @desc    Update current logged in user
// @route   PUT /api/auth/me
// @access  Private
router.put(
  '/me',
  protect,
  [
    // Champs optionnels mais validés si présents
    body('firstName').optional().isString().trim().notEmpty().withMessage('First name must be a non-empty string'),
    body('lastName').optional().isString().trim().notEmpty().withMessage('Last name must be a non-empty string'),
    body('newPassword').optional().isString().isLength({ min: 8 }).withMessage('New password must be at least 8 chars'),
    body('currentPassword').custom((value, { req }) => {
      if (req.body && req.body.newPassword) {
        if (!value || typeof value !== 'string' || value.length === 0) {
          throw new Error('Current password is required to change password');
        }
      }
      return true;
    }),
  ],
  updateMe
);

// @desc    Delete current logged in user
// @route   DELETE /api/auth/me
// @access  Private
router.delete('/me', protect, deleteMe);

// @desc    Log user out
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, logout);

module.exports = router;
