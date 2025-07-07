// backend/controllers/calendarController.js
const { google } = require("googleapis");
const Meeting = require("../models/Meeting");
const { oauth2Client } = require("../config/googleAuth");

exports.scheduleMeeting = async (req, res) => {
  try {
    const { summary, description, startTime, endTime, accessToken, refreshToken } = req.body;

    // Use existing oauth2Client and update its credentials
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Validate times
    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({
        success: false,
        error: 'End time must be after start time'
      });
    }

    // Create calendar event
    const event = {
      summary: summary,
      description: description,
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'UTC'
      },
      conferenceData: {
        createRequest: {
          requestId: `meeting-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      resource: event
    });

    // Create meeting record in database
    const meeting = new Meeting({
      summary: summary,
      description: description,
      startTime: startTime,
      endTime: endTime,
      googleMeetLink: response.data.hangoutLink,
      googleCalendarEventId: response.data.id,
      patientEmail: req.body.patientEmail || 'patient@example.com', // You should get this from authenticated user
      doctorEmail: req.body.doctorEmail || 'doctor@example.com' // You should get this from form or system
    });

    await meeting.save();

    res.json({
      success: true,
      googleMeetLink: response.data.hangoutLink,
      eventId: response.data.id
    });

  } catch (error) {
    console.error('Error in scheduleMeeting:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create calendar event'
    });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    if (!accessToken) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json({
      success: true,
      events: response.data.items
    });

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch calendar events'
    });
  }
};
