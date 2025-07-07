const { google } = require('googleapis');
require('dotenv').config();

// Get redirect URI based on environment
const getRedirectUri = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.GOOGLE_REDIRECT_URI_PROD;
  } else if (process.env.GOOGLE_REDIRECT_URI_NGROK) {
    return process.env.GOOGLE_REDIRECT_URI_NGROK;
  } else {
    return process.env.GOOGLE_REDIRECT_URI || `${config.API_BASE_URL}/api/meetings/google/callback`;
  }
};

// Check if credentials exist before initializing
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('❌ Google OAuth credentials missing!');
  console.error('Required environment variables:');
  console.error('- GOOGLE_CLIENT_ID');
  console.error('- GOOGLE_CLIENT_SECRET');
  console.error('- GOOGLE_REDIRECT_URI (optional)');
}

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  getRedirectUri()
);

// Set scopes for Google Calendar and Meet
const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

// Check if configuration is valid
const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
let hasRefreshToken = false;

// Log configuration for debugging
console.log('Google Auth Configuration:', {
  clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'MISSING',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING',
  redirectUri: getRedirectUri(),
  scopes: scopes,
  isConfigured: isConfigured
});

const getAuthUrl = () => {
  if (!isConfigured) {
    throw new Error('Google OAuth not configured. Check your environment variables.');
  }
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
};

const getTokens = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

// Production-ready calendar event creation
const createCalendarEvent = async (tokens, eventDetails) => {
  try {
    // Set up OAuth client with tokens
    oauth2Client.setCredentials(tokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.startTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: eventDetails.endTime,
        timeZone: 'UTC',
      },
      attendees: eventDetails.attendees,
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    return response.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
};

// Export a function to update tokens dynamically
const setTokens = (tokens) => {
    if (oauth2Client) {
        oauth2Client.setCredentials(tokens);
        hasRefreshToken = !!tokens.refresh_token;
        console.log('Tokens updated in OAuth client');
    }
};

// Export a function to check if we have valid tokens
const hasValidTokens = () => {
    if (!oauth2Client) return false;
    const credentials = oauth2Client.credentials;
    return !!(credentials && (credentials.access_token || credentials.refresh_token));
};

module.exports = {
    oauth2Client,
    scopes,
    isConfigured,
    hasRefreshToken: () => hasRefreshToken,
    getRedirectUri,
    getCalendar: () => {
        if (!oauth2Client) {
            throw new Error('Google OAuth client not initialized');
        }
        return google.calendar({ version: 'v3', auth: oauth2Client });
    },
    getAuthUrl,
    getTokens,
    createCalendarEvent,
    setTokens,
    hasValidTokens
};
