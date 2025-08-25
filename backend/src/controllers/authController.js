const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');

// @desc    Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
};

// @desc    Renvoyer l'email de vérification
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Email requis.' });
    }

    const user = await User.findOne({ email });

    // Réponse générique pour éviter l'énumération d'utilisateurs
    const genericMsg = 'Si un compte existe pour cet email, un nouveau message de vérification a été envoyé.';

    if (!user) {
      return res.status(200).json({ status: 'success', message: genericMsg });
    }

    if (user.isEmailVerified) {
      // Déjà vérifié : réponse 200 générique
      return res.status(200).json({ status: 'success', message: genericMsg });
    }

    // Génère un nouveau token et envoie l'email
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    const emailHtml = `<p>Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`;

    await sendEmail(user.email, 'Vérification de votre email', emailHtml);

    return res.status(200).json({ status: 'success', message: genericMsg });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  // Sécurité: on n'accepte pas le rôle depuis le client pour l'inscription publique
  // Tous les nouveaux comptes sont catégorisés comme 'player' par défaut
  const { email, password, firstName, lastName } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'User already exists with this email' });
    }

    const user = new User({ email, password, firstName, lastName, role: 'player' });
    await user.save();

    // Generate verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    const emailHtml = `<p>Please verify your email by clicking on the link below:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`;

    await sendEmail(user.email, 'Email Verification', emailHtml);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login a user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ status: 'error', message: 'Please verify your email before logging in.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ status: 'error', message: 'Account is deactivated' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      data: { token, user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware
    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.status(200).json({
        status: 'success',
        data: { user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } },
    });
  } catch (error) {
      next(error);
  }
};

// @desc    Log user out
// @route   POST /api/auth/logout
// @access  Private
const logout = (req, res, next) => {
  // For JWT, logout is typically handled on the client-side by deleting the token.
  // Server-side blocklisting can be implemented for more security if needed.
  res.status(200).json({ status: 'success', message: 'User logged out successfully' });
};

// @desc    Verify user email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    // Get token from params and hash it
    const verificationToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: verificationToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired verification token.' });
    }

    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ status: 'success', message: 'Email verified successfully.' });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'Aucun utilisateur trouvé avec cet email.' });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `Vous recevez cet email car vous (ou quelqu'un d'autre) avez demandé la réinitialisation du mot de passe de votre compte.\n\nCliquez sur ce lien pour réinitialiser votre mot de passe:\n\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.\n`;

    try {
      await sendEmail(
        user.email,
        'Réinitialisation du mot de passe',
        `<p>Vous recevez cet email car vous (ou quelqu'un d'autre) avez demandé la réinitialisation du mot de passe de votre compte.</p>
         <p>Cliquez sur ce lien pour réinitialiser votre mot de passe :</p>
         <p><a href="${resetUrl}">${resetUrl}</a></p>
         <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.</p>`
      );

      res.status(200).json({ success: true, data: 'Email envoyé' });
    } catch (err) {
      console.error(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ message: 'L\'envoi de l\'email a échoué' });
    }
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Token invalide ou expiré' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Mot de passe réinitialisé avec succès' });

  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, logout, verifyEmail, resendVerification, forgotPassword, resetPassword };
