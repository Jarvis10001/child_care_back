const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const doctorController = require('../controllers/doctorController');

// Register doctor route - only accessible to admins
router.post('/register', protect, authorize('admin'), doctorController.registerDoctor);

// Doctor's specific routes - These must come before general parameterized routes
router.get('/profile', protect, authorize('doctor'), doctorController.getDoctorProfile);
router.put('/profile', protect, authorize('doctor'), doctorController.updateDoctorProfile);
router.get('/stats', protect, authorize('doctor'), doctorController.getDoctorStats);

// Appointment management - Specific routes first
router.get('/appointments', protect, authorize('doctor'), doctorController.getDoctorAppointments);
router.get('/appointments/today', protect, authorize('doctor'), doctorController.getTodayAppointments);
router.get('/appointments/upcoming', protect, authorize('doctor'), doctorController.getUpcomingAppointments);
router.get('/appointments/history', protect, authorize('doctor'), doctorController.getAppointmentHistory);

// Patient management
router.get('/patients', protect, authorize('doctor'), doctorController.getDoctorPatients);

// Consultation management
router.post('/consultations/:appointmentId/notes', protect, authorize('doctor'), doctorController.addConsultationNotes);
router.post('/consultations/:appointmentId/prescriptions', protect, authorize('doctor'), doctorController.addPrescription);

// General routes - These come after specific routes
router.get('/', protect, doctorController.getAllDoctors);

// Admin routes for doctor management - Parameterized routes last
router.get('/appointments/:id', protect, authorize('doctor'), doctorController.getAppointmentById);
router.get('/patients/:id', protect, authorize('doctor'), doctorController.getPatientById);
router.get('/patients/:id/history', protect, authorize('doctor'), doctorController.getPatientHistory);
router.get('/:id', protect, doctorController.getDoctorById);
router.put('/admin/:id', protect, authorize('admin'), doctorController.updateDoctor);
router.delete('/admin/:id', protect, authorize('admin'), doctorController.deleteDoctor);

module.exports = router;
