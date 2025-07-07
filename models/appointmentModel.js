const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    appointmentDate: {
        type: Date,
        required: true
    },
    timeSlot: {
        start: {
            type: String,
            required: true
        },
        end: {
            type: String,
            required: true
        }
    },
    type: {
        type: String,
        required: true,
        enum: ['Initial Consultation', 'Follow Up', 'Therapy Session', 'Assessment']
    },
    status: {
        type: String,
        required: true,
        enum: ['Requested', 'Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show'],
        default: 'Requested'
    },
    mode: {
        type: String,
        required: true,
        enum: ['In-person', 'Video Call', 'Phone Call'],
        default: 'In-person'
    },
    notes: {
        type: String
    },
    prescription: {
        medications: [{
            name: String,
            dosage: String,
            frequency: String,
            duration: String
        }],
        instructions: String,
        issuedAt: Date
    },
    meeting: {
        link: String,
        accessCode: String,
        isGenerated: {
            type: Boolean,
            default: false
        },
        generatedAt: Date
    },
    activityLog: [{
        action: {
            type: String,
            enum: ['Created', 'Updated', 'Cancelled', 'Rescheduled', 'Completed', 
                   'Confirmed', 'Reminder Sent', 'Notes Added', 'Prescription Added']
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'activityLog.performerModel'
        },
        performerModel: {
            type: String,
            enum: ['User', 'Doctor', 'Admin'],
            default: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        details: String
    }]
}, {
    timestamps: true
});

// Index for query optimization
appointmentSchema.index({ patient: 1, doctor: 1 });
appointmentSchema.index({ appointmentDate: 1 });
appointmentSchema.index({ status: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
