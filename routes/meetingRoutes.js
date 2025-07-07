const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const meetingController = require('../controllers/meetingController');

// Google OAuth routes - These must come first to avoid conflicts with parameterized routes
router.get('/google/auth', protect, authorize('doctor'), meetingController.getGoogleAuthUrl);
router.get('/google/callback', meetingController.handleGoogleCallback);
router.get('/oauth-status', protect, authorize('doctor'), meetingController.getOAuthStatus);

// Meeting management routes - Specific routes before parameterized ones
router.get('/', protect, authorize('doctor'), meetingController.getAllMeetings);

// Parameterized routes - These must come last
router.post('/generate/:appointmentId', protect, meetingController.generateMeeting);
router.get('/check/:appointmentId', protect, meetingController.checkMeetingActive);
router.post('/join/:appointmentId', protect, meetingController.joinMeeting);
router.post('/leave/:appointmentId', protect, meetingController.leaveMeeting);
router.get('/:appointmentId', protect, meetingController.getMeetingDetails);

module.exports = router;
router.post('/leave/:appointmentId', protect, meetingController.leaveMeeting);

// Google OAuth routes - FIXED to avoid conflicts
router.get('/google/auth', protect, authorize('doctor'), meetingController.getGoogleAuthUrl);
router.get('/google/callback', meetingController.handleGoogleCallback);
router.get('/oauth-status', protect, authorize('doctor'), meetingController.getOAuthStatus);

module.exports = router;
//         message: 'Google OAuth not configured properly'
//       });
//     }
    
//     const authUrl = googleAuth.oauth2Client.generateAuthUrl({
//       access_type: 'offline',
//       scope: googleAuth.scopes,
//       prompt: 'consent',
//       state: appointmentId || ''
//     });
    
//     console.log('Generated auth URL:', authUrl);
    
//     res.json({ 
//       success: true, 
//       authUrl 
//     });
//   } catch (error) {
//     console.error('Error in Google auth route:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Error generating auth URL',
//       error: error.message 
//     });
//   }
// });

// Google Calendar Authorization callback - Fix the callback handling
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: appointmentId } = req.query;
    console.log('Google callback received:', { code: !!code, appointmentId });
    
    if (!code) {
      console.error('No authorization code received');
      return res.redirect(`${process.env.FRONTEND_URL}/doctor/appointments?error=no_code`);
    }

    // Exchange code for tokens
    const googleAuth = require('../config/googleAuth');
    const { tokens } = await googleAuth.oauth2Client.getToken(code);
    console.log('Tokens received:', { ...tokens, refresh_token: !!tokens.refresh_token });
    
    // Set tokens in the OAuth client
    googleAuth.oauth2Client.setCredentials(tokens);
    
    // TODO: Save tokens to doctor's profile in database
    // For now, we'll store them temporarily in the OAuth client
    // In production, you should save these to the doctor's profile:
    /*
    await Doctor.findByIdAndUpdate(doctorId, {
      googleTokens: tokens,
      googleCalendarAuthorized: true
    });
    */
    
    console.log('Google authorization successful');
    
    // Redirect back to frontend with success
    const redirectUrl = appointmentId 
      ? `${process.env.FRONTEND_URL}/doctor/appointments?auth=success&appointmentId=${appointmentId}`
      : `${process.env.FRONTEND_URL}/doctor/appointments?auth=success`;
      
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Google auth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/doctor/appointments?error=auth_failed`);
  }
});

// Route for doctor to view all scheduled meetings
router.get("/", protect, meetingController.getAllMeetings);

// Generate a meeting for an appointment (supports test=true query parameter) - FIXED ROUTE
router.post('/generate/:appointmentId', protect, meetingController.generateMeeting);

// Get meeting details for an appointment
router.get('/:appointmentId', protect, meetingController.getMeetingDetails);

// Check if a meeting is active and can be joined - FIXED ROUTE
router.get('/check/:appointmentId', protect, meetingController.checkMeetingActive);

// Join a meeting - FIXED ROUTE
router.post('/join/:appointmentId', protect, meetingController.joinMeeting);

// Leave a meeting - FIXED ROUTE
router.post('/leave/:appointmentId', protect, meetingController.leaveMeeting);

// Google OAuth routes
router.get('/google/auth', protect, authorize('doctor'), meetingController.getGoogleAuthUrl);
router.get('/google/callback', meetingController.handleGoogleCallback);
router.get('/oauth-status', protect, authorize('doctor'), meetingController.getOAuthStatus);

module.exports = router;
