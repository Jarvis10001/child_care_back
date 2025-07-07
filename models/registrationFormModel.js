const mongoose = require('mongoose');

const registrationFormSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referenceId: {  // Add this field
    type: String,
    unique: true,
    required: true
  },
  personalInfo: {
    applicantName: {
      type: String,
      required: true
    },
    mobileNumber: {
      type: String,
      required: true,
      match: /^[0-9]{10}$/
    },
    dob: {
      type: Date,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    relation: {
      type: String,
      required: true
    }
  },
  address: {
    address: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    village: String,
    pincode: {
      type: String,
      required: true,
      match: /^[0-9]{6}$/
    }
  },
  identityProof: {
    hasBirthCertificate: {
      type: Boolean,
      required: true
    },
    type: {
      type: String,
      enum: ['birth-certificate', 'passport', 'school-id', 'immunization', 'medical'],
      required: true
    },
    idProofFile: {
      fileName: String,
      fileUrl: String,
      uploadedAt: Date
    }
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Add pre-save middleware to generate referenceId
registrationFormSchema.pre('save', async function(next) {
  if (!this.referenceId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('RegistrationForm').countDocuments();
    this.referenceId = `REG-${year}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

const RegistrationForm = mongoose.models.RegistrationForm || mongoose.model('RegistrationForm', registrationFormSchema);

module.exports = RegistrationForm;
