const Meeting = require("../models/meeting");
const Appointment = require('../models/appointmentModel');
const Doctor = require('../models/doctorModel');
const User = require('../models/userModel');
const googleAuth = require('../config/googleAuth');
const { google } = require('googleapis');
const { createCalendarEvent } = require('../config/googleAuth');
const config = require('../config/environment');

// Add environment-based redirect URI
const getRedirectUri = () => {
    return config.GOOGLE_REDIRECT_URI;
};

// Get all meetings (for admin/doctor dashboards)
exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({ createdAt: -1 });
    res.json({ success: true, meetings });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ success: false, error: "Error fetching meetings" });
  }
};

// Helper function to create Google Meet event using real Google Calendar API
async function createGoogleMeetEvent(googleTokens, eventDetails) {
  try {
    const { google } = require('googleapis');
    
    // Set up OAuth2 client with doctor's tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri()
    );

    oauth2Client.setCredentials(googleTokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Generate unique request ID
    const requestId = `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const event = {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.startDateTime,
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: eventDetails.endDateTime,
        timeZone: 'Asia/Kolkata',
      },
      conferenceData: {
        createRequest: {
          requestId: requestId,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
      attendees: eventDetails.attendees,
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
    });

    // Extract meeting details from response
    const hangoutLink = response.data.hangoutLink;
    const conferenceData = response.data.conferenceData;
    
    // Extract meeting ID from hangout link or conference data
    let meetingId = 'meet-' + Date.now();
    if (hangoutLink) {
      const urlParts = hangoutLink.split('/');
      meetingId = urlParts[urlParts.length - 1] || meetingId;
    }
    
    // Generate access code from meeting ID
    const accessCode = meetingId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();

    console.log('Real Google Meet created:', {
      hangoutLink,
      meetingId,
      accessCode,
      eventId: response.data.id
    });

    return {
      success: true,
      hangoutLink: hangoutLink,
      eventId: response.data.id,
      meetingId: meetingId,
      accessCode: accessCode,
      conferenceData: conferenceData
    };

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    
    // Handle specific Google API errors
    if (error.code === 401) {
      return {
        success: false,
        error: 'Google authorization expired. Please re-authorize.',
        requiresReauth: true
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Generate a meeting link for an appointment using real Google Meet
exports.generateMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = req.user.id;

    console.log(`Generate meeting request - Appointment: ${appointmentId}, Doctor: ${doctorId}`);

    // Verify appointment exists 
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify user is authorized (only the doctor can generate meetings)
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the assigned doctor can generate meeting links'
      });
    }

    // Check if appointment is confirmed
    if (appointment.status !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed appointments can have meeting links'
      });
    }

    // Check if meeting already exists for this appointment
    let meeting = await Meeting.findOne({ appointment: appointmentId });

    // If meeting exists, return existing meeting
    if (meeting && meeting.googleMeetLink) {
      return res.status(200).json({
        success: true,
        message: 'Meeting already exists for this appointment',
        meetingInfo: {
          meetingId: meeting.meetingId,
          accessCode: meeting.accessCode,
          link: meeting.googleMeetLink
        }
      });
    }

    // Get appointment with populated data
    const appointmentData = await Appointment.findById(appointmentId)
      .populate('doctor', 'name contact googleTokens googleTokensUpdatedAt googleCalendarAuthorized')
      .populate('patient', 'firstName lastName email');

    // ENHANCED TOKEN CHECKING: Try multiple sources and check validity
    let googleTokens = null;
    let tokenSource = '';
    
    // First, try to get from doctor's profile
    if (appointmentData.doctor.googleTokens && appointmentData.doctor.googleCalendarAuthorized) {
      googleTokens = appointmentData.doctor.googleTokens;
      tokenSource = 'doctor_profile';
      console.log('Using tokens from doctor profile');
    }
    // Fallback to global cache
    else if (global.googleTokensCache) {
      googleTokens = global.googleTokensCache;
      tokenSource = 'global_cache';
      console.log('Using tokens from global cache');
    }
    
    if (!googleTokens) {
      console.log('No Google tokens found, requiring authorization');
      return res.status(400).json({
        success: false,
        message: 'Google Calendar authorization required',
        requiresAuth: true
      });
    }

    // Check if tokens are expired and refresh if needed
    const now = new Date();
    let tokensExpired = false;
    
    if (googleTokens.expiry_date) {
      tokensExpired = new Date(googleTokens.expiry_date) < now;
      console.log(`Tokens expired: ${tokensExpired}, Expiry: ${new Date(googleTokens.expiry_date)}, Now: ${now}`);
    }
    
    if (tokensExpired && googleTokens.refresh_token) {
      console.log('Tokens expired, attempting refresh...');
      
      try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          getRedirectUri()
        );
        
        oauth2Client.setCredentials(googleTokens);
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update tokens
        googleTokens = { ...googleTokens, ...credentials };
        
        // Save updated tokens based on source
        if (tokenSource === 'doctor_profile') {
          await Doctor.findByIdAndUpdate(doctorId, {
            googleTokens: googleTokens,
            googleTokensUpdatedAt: new Date()
          });
        } else {
          global.googleTokensCache = googleTokens;
          
          // Also try to update database
          await Doctor.updateMany(
            { isActive: true },
            {
              googleTokens: googleTokens,
              googleTokensUpdatedAt: new Date()
            }
          );
        }
        
        console.log('Tokens refreshed successfully');
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // Clear invalid tokens
        if (tokenSource === 'doctor_profile') {
          await Doctor.findByIdAndUpdate(doctorId, {
            googleTokens: null,
            googleCalendarAuthorized: false
          });
        } else {
          global.googleTokensCache = null;
        }
        
        return res.status(401).json({
          success: false,
          message: 'Google authorization expired and refresh failed',
          requiresAuth: true
        });
      }
    } else if (tokensExpired && !googleTokens.refresh_token) {
      console.log('Tokens expired with no refresh token available');
      
      // Clear invalid tokens
      if (tokenSource === 'doctor_profile') {
        await Doctor.findByIdAndUpdate(doctorId, {
          googleTokens: null,
          googleCalendarAuthorized: false
        });
      } else {
        global.googleTokensCache = null;
      }
      
      return res.status(401).json({
        success: false,
        message: 'Google authorization expired',
        requiresAuth: true
      });
    }

    // FIXED: Parse appointment time properly
    const appointmentDate = new Date(appointmentData.appointmentDate);
    const [startHour, startMinute] = appointmentData.timeSlot.start.split(':').map(Number);
    const [endHour, endMinute] = appointmentData.timeSlot.end.split(':').map(Number);

    const startTime = new Date(appointmentDate);
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(appointmentDate);
    endTime.setHours(endHour, endMinute, 0, 0);

    console.log('Meeting times:', {
      appointmentDate: appointmentDate.toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });

    // Create Google Meet using real Calendar API
    const meetingDetails = await createGoogleMeetEvent(
      googleTokens,
      {
        summary: `Medical Consultation - ${appointmentData.patient.firstName} ${appointmentData.patient.lastName}`,
        description: `Appointment with Dr. ${appointmentData.doctor.name.firstName} ${appointmentData.doctor.name.lastName}\n\nPatient: ${appointmentData.patient.firstName} ${appointmentData.patient.lastName}\nType: ${appointmentData.type}\nMode: ${appointmentData.mode}`,
        startDateTime: startTime.toISOString(),
        endDateTime: endTime.toISOString(),
        attendees: [
          { email: appointmentData.doctor.contact.email },
          { email: appointmentData.patient.email }
        ]
      }
    );

    if (!meetingDetails.success) {
      if (meetingDetails.requiresReauth) {
        return res.status(401).json({
          success: false,
          message: 'Google authorization expired',
          requiresAuth: true
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to create Google Meet',
        error: meetingDetails.error
      });
    }

    // Create new meeting record
    meeting = new Meeting({
      appointment: appointmentId,
      patientEmail: appointmentData.patient.email,
      doctorEmail: appointmentData.doctor.contact.email,
      summary: `Medical Consultation - ${appointmentData.patient.firstName} ${appointmentData.patient.lastName}`,
      description: `Appointment with Dr. ${appointmentData.doctor.name.firstName} ${appointmentData.doctor.name.lastName}`,
      startTime,
      endTime,
      googleMeetLink: meetingDetails.hangoutLink,
      googleCalendarEventId: meetingDetails.eventId,
      meetingId: meetingDetails.meetingId,
      accessCode: meetingDetails.accessCode,
      status: 'scheduled',
      participants: [
        {
          userId: appointment.doctor,
          userModel: 'Doctor'
        },
        {
          userId: appointment.patient,
          userModel: 'User'
        }
      ]
    });

    // Save the meeting
    await meeting.save();

    // Update the appointment with meeting info
    await Appointment.findByIdAndUpdate(appointmentId, {
      $set: {
        meeting: {
          link: meetingDetails.hangoutLink,
          accessCode: meetingDetails.accessCode,
          meetingId: meetingDetails.meetingId,
          isGenerated: true,
          generatedAt: new Date()
        }
      },
      $push: {
        activityLog: {
          action: 'Meeting Link Generated',
          performedBy: req.user.id,
          performerModel: 'Doctor',
          timestamp: new Date(),
          details: 'Real Google Meet link generated successfully'
        }
      }
    });

    console.log('Real Google Meet created successfully:', {
      meetingId: meeting.meetingId,
      accessCode: meeting.accessCode,
      link: meeting.googleMeetLink
    });

    return res.status(201).json({
      success: true,
      message: 'Google Meet created successfully',
      meetingInfo: {
        meetingId: meeting.meetingId,
        accessCode: meeting.accessCode,
        link: meeting.googleMeetLink
      }
    });
  } catch (error) {
    console.error('Error generating meeting:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error generating meeting',
      error: error.message
    });
  }
};

// Get Google OAuth authorization URL
exports.getGoogleAuthUrl = async (req, res) => {
  try {
    const { google } = require('googleapis');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri()
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.query.appointmentId || '', // Pass appointment ID for later use
      prompt: 'consent' // Force consent to get refresh token
    });

    res.json({
      success: true,
      authUrl: authUrl
    });

  } catch (error) {
    console.error('Error getting auth URL:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting authorization URL',
      error: error.message
    });
  }
};

// Handle Google OAuth callback
exports.handleGoogleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      console.error('No authorization code received');
      return res.redirect(`${config.FRONTEND_URL}/doctor/appointments?error=auth_failed`);
    }

    const { google } = require('googleapis');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri()
    );

    try {
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      console.log('Tokens received successfully:', { 
        access_token: !!tokens.access_token,
        refresh_token: !!tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });
      
      // CRITICAL FIX: Save tokens to ALL active doctors since we can't identify the specific doctor
      // In production, you should implement a proper doctor identification system
      try {
        // Update all doctors with the tokens (temporary solution)
        await Doctor.updateMany(
          { isActive: true }, // Only update active doctors
          {
            googleTokens: tokens,
            googleCalendarAuthorized: true,
            googleTokensUpdatedAt: new Date()
          }
        );
        
        console.log('Google tokens saved to database for all active doctors');
        
        // Also store globally as backup
        global.googleTokensCache = tokens;
        
      } catch (dbError) {
        console.error('Error saving tokens to database:', dbError);
        // Fallback to global storage
        global.googleTokensCache = tokens;
      }
      
      console.log('Google authorization successful');
      
      // Redirect back to frontend with success
      const redirectUrl = state ? 
        `${config.FRONTEND_URL}/doctor/appointments?auth=success&appointmentId=${state}` : 
        `${config.FRONTEND_URL}/doctor/appointments?auth=success`;
        
      return res.redirect(redirectUrl);
      
    } catch (tokenError) {
      console.error('Error exchanging code for tokens:', tokenError);
      return res.redirect(`${config.FRONTEND_URL}/doctor/appointments?error=token_exchange_failed`);
    }

  } catch (error) {
    console.error('Google auth callback error:', error);
    return res.redirect(`${config.FRONTEND_URL}/doctor/appointments?error=auth_failed`);
  }
};

// Check OAuth status - Enhanced to show more detailed status
exports.getOAuthStatus = async (req, res) => {
  try {
    console.log('Checking OAuth status for user:', req.user.id);
    
    const doctor = await Doctor.findById(req.user.id).select('googleTokens googleCalendarAuthorized googleTokensUpdatedAt');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Check if we have valid tokens
    let hasTokens = false;
    let hasRefreshToken = false;
    let isExpired = false;
    let tokenAge = null;
    let authSource = 'none';
    
    if (doctor?.googleTokens) {
      hasTokens = !!(doctor.googleTokens.access_token);
      hasRefreshToken = !!(doctor.googleTokens.refresh_token);
      authSource = 'database';
      
      // Check if tokens are expired
      if (doctor.googleTokens.expiry_date) {
        isExpired = new Date(doctor.googleTokens.expiry_date) < new Date();
      }
      
      // Calculate token age
      if (doctor.googleTokensUpdatedAt) {
        tokenAge = Math.floor((new Date() - new Date(doctor.googleTokensUpdatedAt)) / (1000 * 60 * 60)); // hours
      }
    } else if (global.googleTokensCache) {
      hasTokens = !!(global.googleTokensCache.access_token);
      hasRefreshToken = !!(global.googleTokensCache.refresh_token);
      authSource = 'cache';
      
      if (global.googleTokensCache.expiry_date) {
        isExpired = new Date(global.googleTokensCache.expiry_date) < new Date();
      }
    }
    
    const isValid = hasTokens && !isExpired;
    
    console.log('OAuth Status Check:', {
      hasTokens,
      hasRefreshToken,
      isExpired,
      isValid,
      authSource,
      tokenAge
    });
    
    res.json({
      success: true,
      hasRefreshToken: hasRefreshToken,
      isAuthorized: (doctor?.googleCalendarAuthorized || hasTokens) && isValid,
      hasValidTokens: isValid,
      isExpired: isExpired,
      authSource: authSource,
      tokenAge: tokenAge,
      lastUpdated: doctor?.googleTokensUpdatedAt,
      debug: {
        doctorHasTokens: !!(doctor?.googleTokens),
        globalCacheExists: !!global.googleTokensCache,
        doctorAuthorized: doctor?.googleCalendarAuthorized
      }
    });
    
  } catch (error) {
    console.error('Error checking OAuth status:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error checking authorization status',
      error: error.message
    });
  }
};

// Create a meeting link for an appointment using Google Meet
exports.createMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const doctorId = req.user.id;

    // Find doctor and check for Google tokens
    const doctor = await Doctor.findById(doctorId);
    if (!doctor.googleTokens) {
      return res.status(400).json({
        success: false,
        message: 'Google Calendar authorization required',
        requiresGoogleAuth: true,
        authUrl: getAuthUrl()
      });
    }

    // Find appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'firstName lastName');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Create calendar event with Meet
    const eventDetails = {
      _id: appointment._id,
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      startTime: appointment.timeSlot.start,
      endTime: appointment.timeSlot.end,
      reason: appointment.reason
    };

    const { meetLink, eventId, eventLink } = await createCalendarEvent(
      doctor.googleTokens,
      eventDetails
    );

    // Update appointment with meet link
    appointment.meetingDetails = {
      meetLink,
      eventId,
      eventLink,
      createdAt: new Date()
    };
    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Meeting created successfully',
      meetingDetails: appointment.meetingDetails
    });

  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating meeting'
    });
  }
};

// Get meeting details
exports.getMeetingDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Find appointment and meeting
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check authorization
    const isAuthorized =
      appointment.doctor.toString() === req.user.id ||
      appointment.patient.toString() === req.user.id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this meeting'
      });
    }

    const meeting = await Meeting.findOne({ appointment: appointmentId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found for this appointment'
      });
    }

    // Get doctor and patient info for the meeting
    const doctor = await Doctor.findById(appointment.doctor)
      .select('name.firstName name.lastName specialization');

    const patient = await User.findById(appointment.patient)
      .select('firstName lastName');

    return res.status(200).json({
      success: true,
      meetingInfo: {
        meetingId: meeting.meetingId,
        accessCode: meeting.accessCode,
        link: meeting.googleMeetLink,
        status: meeting.status,
        googleCalendarEventId: meeting.googleCalendarEventId,
        startTime: meeting.startTime,
        endTime: meeting.endTime
      },
      appointmentInfo: {
        id: appointment._id,
        date: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        type: appointment.type,
        mode: appointment.mode,
        status: appointment.status,
        doctor: doctor,
        patient: patient
      }
    });
  } catch (error) {
    console.error('Error fetching meeting details:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching meeting details',
      error: error.message
    });
  }
};

// Check if a meeting is active and can be joined
exports.checkMeetingActive = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check authorization
    const isAuthorized =
      appointment.doctor.toString() === req.user.id ||
      appointment.patient.toString() === req.user.id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this meeting'
      });
    }

    // Check if meeting exists
    const meeting = await Meeting.findOne({ appointment: appointmentId });
    const hasLink = !!meeting && !!meeting.googleMeetLink;

    // Check if appointment is confirmed
    if (appointment.status !== 'Confirmed') {
      return res.status(200).json({
        success: true,
        isToday: false,
        canJoin: false,
        hasLink,
        message: 'Appointment is not confirmed'
      });
    }

    // Check if meeting is today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointmentDate = new Date(appointment.appointmentDate);
    appointmentDate.setHours(0, 0, 0, 0);

    const isToday = appointmentDate.getTime() === today.getTime();

    // Check if within time window (15 minutes before to 30 minutes after)
    let canJoin = false;

    if (isToday) {
      const now = new Date();

      // Parse appointment time
      const [startHour, startMinute] = appointment.timeSlot.start.split(':').map(num => parseInt(num, 10));
      const appointmentStart = new Date(appointmentDate);
      appointmentStart.setHours(startHour, startMinute, 0, 0);

      // Calculate time difference in minutes
      const minutesDiff = (now - appointmentStart) / 60000;

      // Can join if within 15 minutes before or 60 minutes after start time
      canJoin = minutesDiff >= -15 && minutesDiff <= 60;
    }

    return res.status(200).json({
      success: true,
      isToday,
      canJoin,
      hasLink,
      message: canJoin ? 'Meeting is active and can be joined' : 'Meeting is not active at this time'
    });
  } catch (error) {
    console.error('Error checking meeting status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking meeting status',
      error: error.message
    });
  }
};

// Join a meeting - update participant status
exports.joinMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Find meeting
    const meeting = await Meeting.findOne({ appointment: appointmentId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Find appointment and check authorization
    const appointment = await Appointment.findById(appointmentId);

    const isAuthorized =
      appointment.doctor.toString() === req.user.id ||
      appointment.patient.toString() === req.user.id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to join this meeting'
      });
    }

    // Update participant status
    const userModel = req.user.role === 'doctor' ? 'Doctor' : 'User';

    const participantIndex = meeting.participants.findIndex(p =>
      p.userId.toString() === req.user.id &&
      p.userModel === userModel
    );

    if (participantIndex >= 0) {
      meeting.participants[participantIndex].joinTime = new Date();
      meeting.participants[participantIndex].status = 'joined';
    } else {
      meeting.participants.push({
        userId: req.user.id,
        userModel,
        joinTime: new Date(),
        status: 'joined'
      });
    }

    // If this is the first person joining, update meeting status
    if (meeting.status === 'scheduled') {
      meeting.status = 'active';
      meeting.startTime = new Date();
    }

    await meeting.save();

    // Return the Google Meet link
    return res.status(200).json({
      success: true,
      message: 'Successfully joined the meeting',
      meetingInfo: {
        meetingId: meeting.meetingId,
        accessCode: meeting.accessCode,
        link: meeting.googleMeetLink
      }
    });
  } catch (error) {
    console.error('Error joining meeting:', error);
    return res.status(500).json({
      success: false,
      message: 'Error joining meeting',
      error: error.message
    });
  }
};

// Leave a meeting - record when participant leaves
exports.leaveMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Find meeting
    const meeting = await Meeting.findOne({ appointment: appointmentId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Update participant status
    const userModel = req.user.role === 'doctor' ? 'Doctor' : 'User';

    const participantIndex = meeting.participants.findIndex(p =>
      p.userId.toString() === req.user.id &&
      p.userModel === userModel
    );

    if (participantIndex >= 0) {
      meeting.participants[participantIndex].leaveTime = new Date();
      meeting.participants[participantIndex].status = 'left';
    }

    // Check if all participants have left
    const allLeft = meeting.participants.every(p => p.status === 'left');

    if (allLeft) {
      meeting.status = 'completed';
      meeting.endTime = new Date();
    }

    await meeting.save();

    return res.status(200).json({
      success: true,
      message: 'Successfully left the meeting'
    });
  } catch (error) {
    console.error('Error leaving meeting:', error);
    return res.status(500).json({
      success: false,
      message: 'Error leaving meeting',
      error: error.message
    });
  }
};
//       success: false,
//       message: 'Error leaving meeting',
//       error: error.message
//     });
//   }
// };


