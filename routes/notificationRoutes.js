const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Appointment = require('../models/appointmentModel'); // Add this import

// Notify patient about meeting readiness
router.post('/meeting-ready', protect, async (req, res) => {
    try {
        const { appointmentId, meetingInfo } = req.body;
        
        // Find the appointment to get patient details
        const appointment = await Appointment.findById(appointmentId)
            .populate('patient', 'email firstName lastName');
        
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Create notification record
        const notification = {
            type: 'meeting_ready',
            recipient: appointment.patient._id,
            appointmentId,
            message: `Your meeting link is ready for appointment on ${appointment.appointmentDate}`,
            meetingInfo: {
                link: meetingInfo.link,
                accessCode: meetingInfo.accessCode
            }
        };

        // Store notification (implement your notification storage logic)
        // await Notification.create(notification);

        // Send email notification (implement your email service)
        // await sendMeetingReadyEmail(appointment.patient.email, meetingInfo);

        console.log('Patient notified about meeting:', notification);

        res.json({
            success: true,
            message: 'Patient notified successfully'
        });
    } catch (error) {
        console.error('Error notifying patient:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to notify patient',
            error: error.message
        });
    }
});

// Get meeting notifications for user
router.get('/meeting-updates', protect, async (req, res) => {
    try {
        // Implement logic to get recent meeting notifications
        // This is a placeholder implementation
        const notifications = [];
        
        res.json({
            success: true,
            notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
});

module.exports = router;
