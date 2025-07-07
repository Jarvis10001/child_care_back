const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    // required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  dob: {
    type: Date,
    required: true
  },
  relation: {
    type: String,
    enum: ['Parent', 'Guardian', 'Caregiver', 'Administrator'],  // Add Administrator to allowed values
    required: true
  },
  completedAssessments: {
    type: Number,
    default: 0
  },
  hasCompletedRegistration: {
    type: Boolean,
    default: false
  },
  registrationData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'doctor'],
    default: 'user'
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);
