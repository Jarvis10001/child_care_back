const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const doctorSchema = new mongoose.Schema({
  name: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    }
  },
  specialization: {
    type: String,
    required: true,
    enum: [
      'Speech Therapy',
      'Occupational Therapy',
      'Clinical Psychology',
      'ABA Therapy',
      'Behavior Therapy',
      'Special Education',
      'Physical Therapy',
      'Early Intervention',
      'Pediatric Neurology',
      'Child Psychiatry'
    ]
  },
  qualifications: [{
    degree: {
      type: String
    },
    institution: String,
    year: Number
  }],
  experience: {
    type: Number,
    required: true,
    min: 0
  },
  licenseNumber: {
    type: String,
    required: true,
    // Remove the unique: true here since we define it in a separate index below
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  contact: {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  availability: {
    daysAvailable: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    timeSlots: [{
      start: String,
      end: String
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  login: {
    username: {
      type: String,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    lastLogin: Date
  },
  role: {
    type: String,
    default: 'doctor'
  }
}, {
  timestamps: true
});

// Always set the username to email before saving
doctorSchema.pre('save', async function(next) {
  try {
    // Make sure login structure exists
    if (!this.login) {
      this.login = {};
    }
    
    // CRITICAL FIX: Ensure username is set from email
    if (this.contact && this.contact.email) {
      this.login.username = this.contact.email;
    }
    
    // Only hash the password if it's modified (or new)
    if (this.isModified('login.password')) {
      console.log('Hashing password for doctor:', this.name.firstName);
      const salt = await bcrypt.genSalt(10);
      this.login.password = await bcrypt.hash(this.login.password, salt);
    }
    next();
  } catch (error) {
    console.error('Error in doctor pre-save hook:', error);
    next(error);
  }
});

// Method to compare password
doctorSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.login.password);
};

// Create indexes with a clean approach, avoiding duplicates
// These indexes will replace any defined in the schema properties
doctorSchema.index({ 'name.firstName': 1, 'name.lastName': 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ 'address.city': 1, 'address.state': 1 });
doctorSchema.index({ 'contact.email': 1 }, { unique: true });
doctorSchema.index({ licenseNumber: 1 }, { unique: true });

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;
