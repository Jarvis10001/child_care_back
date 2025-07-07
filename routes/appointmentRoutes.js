const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const appointmentController = require('../controllers/appointmentController');

// Patient routes - must come first to avoid conflicts
router.get('/patient', protect, appointmentController.getPatientAppointments);
router.post('/request', protect, appointmentController.requestAppointment);
router.put('/cancel/:appointmentId', protect, appointmentController.cancelAppointment);

// Doctor routes
router.get('/doctor', protect, authorize('doctor'), appointmentController.getDoctorAppointmentRequests);
router.get('/doctor/pending', protect, authorize('doctor'), appointmentController.getDoctorPendingAppointments);
router.get('/doctors', protect, appointmentController.getAvailableDoctors);

// Meeting related routes
router.post('/meeting/:appointmentId/generate', protect, appointmentController.generateMeetingLink);
router.get('/meeting/:appointmentId', protect, appointmentController.getAppointmentMeeting);
router.get('/meeting/:appointmentId/check', protect, appointmentController.checkAppointmentActive);

// Doctor appointment management - fix parameter names to match controller
router.put('/accept/:appointmentId', protect, authorize('doctor'), appointmentController.acceptAppointment);
router.put('/decline/:appointmentId', protect, authorize('doctor'), appointmentController.declineAppointment);

module.exports = router;
