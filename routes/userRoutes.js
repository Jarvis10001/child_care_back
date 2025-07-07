const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');
const registrationController = require('../controllers/registrationController');

// User profile routes - FIX: Check if these functions exist in the controller
// router.get('/profile', protect, userController.getUserProfile);
// router.put('/profile', protect, userController.updateUserProfile);
// router.put('/password', protect, userController.updatePassword);

// Registration completion routes
router.post('/complete-registration', protect, registrationController.completeRegistration);
router.get('/registration-status', protect, registrationController.getRegistrationStatus);

// Child management routes - FIX: Check if these functions exist in the controller
// router.post('/children', protect, userController.addChild);
// router.get('/children', protect, userController.getChildren);

module.exports = router;
