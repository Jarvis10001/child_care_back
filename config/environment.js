require('dotenv').config();

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const config = {
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 2006,
    
    // Database
    MONGODB_URI: isDevelopment 
        ? (process.env.MONGODB_URI_DEV || process.env.MONGODB_URI)
        : (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI),
    
    // Frontend URL
    FRONTEND_URL: isDevelopment 
        ? (process.env.FRONTEND_URL_DEV || 'http://localhost:5173')
        : (process.env.FRONTEND_URL_PROD || process.env.FRONTEND_URL),
    
    // Backend URL
    BACKEND_URL: isDevelopment 
        ? (process.env.BACKEND_URL_DEV || 'http://localhost:2006')
        : (process.env.BACKEND_URL_PROD || `https://api.yourdomain.com`),
    
    // Google OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: isDevelopment 
        ? (process.env.GOOGLE_REDIRECT_URI_DEV || 'http://localhost:2006/api/meetings/google/callback')
        : (process.env.GOOGLE_REDIRECT_URI_PROD || process.env.GOOGLE_REDIRECT_URI),
    
    // Security
    JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key',
    SESSION_SECRET: process.env.SESSION_SECRET || 'fallback-session-secret',
    
    // Cloudinary
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    
    // Other services
    JITSI_DOMAIN: process.env.JITSI_DOMAIN || 'meet.jit.si',
    
    // CORS origins
    CORS_ORIGINS: isDevelopment 
        ? ['http://localhost:5173', 'http://localhost:3000']
        : ['https://yourdomain.com', 'https://www.yourdomain.com'],
    
    // Flags
    isDevelopment,
    isProduction
};

// Log configuration (only in development)
if (isDevelopment) {
    console.log('🔧 Environment Configuration:', {
        NODE_ENV: config.NODE_ENV,
        PORT: config.PORT,
        FRONTEND_URL: config.FRONTEND_URL,
        BACKEND_URL: config.BACKEND_URL,
        MONGODB_URI: config.MONGODB_URI ? '✅ Connected' : '❌ Missing',
        GOOGLE_AUTH: config.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Missing'
    });
}

module.exports = config;
