const mongoose = require("mongoose");

// Check if the model exists first to avoid the "OverwriteModelError"
const Meeting = mongoose.models.Meeting || mongoose.model("Meeting", new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
    // Removed unique constraint to allow test meetings for the same appointment
  },
  patientEmail: { type: String, required: true },
  doctorEmail: { type: String, required: true },
  summary: String,
  description: String,
  startTime: Date,
  endTime: Date,
  googleMeetLink: String,
  googleCalendarEventId: String,
  meetingId: {
    type: String,
    required: true
  },
  accessCode: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled', 'test'],
    default: 'scheduled'
  },
  isTest: {
    type: Boolean,
    default: false
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'participants.userModel'
    },
    userModel: {
      type: String,
      enum: ['User', 'Doctor']
    },
    joinTime: Date,
    leaveTime: Date,
    status: {
      type: String,
      enum: ['invited', 'joined', 'left'],
      default: 'invited'
    }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}));

// Update timestamp on save
const meetingSchema = Meeting.schema;
meetingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = Meeting;
