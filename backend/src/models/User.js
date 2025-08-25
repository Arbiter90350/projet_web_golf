const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// User schema definition
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Do not return password by default
  },
  firstName: { 
    type: String, 
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: { 
    type: String, 
    required: [true, 'Last name is required'],
    trim: true
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['player', 'instructor', 'admin'],
      message: 'Role must be either player, instructor, or admin'
    },
    default: 'player'
  },
  // Référence optionnelle vers l'instructeur assigné (suivi des joueurs)
  assignedInstructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Middleware to hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate an email verification token
userSchema.methods.getEmailVerificationToken = function() {
  // Generate a token
  const verificationToken = crypto.randomBytes(20).toString('hex');

  // Hash the token and save it to the user document
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // Set expiration date (e.g., 24 hours)
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
};

// Method to generate a password reset token
userSchema.methods.getResetPasswordToken = function() {
  // Generate a token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash the token and save it to the database
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expiration date (30 minutes)
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
  
  return resetToken;
};



// Export the model
const User = mongoose.model('User', userSchema);

module.exports = User;
