require('dotenv').config();

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const config = {
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 2006,
    isDevelopment,
    isProduction,
    
    // Frontend URL
    FRONTEND_URL: process.env.FRONTEND_URL || (
        process.env.NODE_ENV === 'production' 
            ? 'https://child-care-front.vercel.app'
            : 'http://localhost:5173'
    ),
    
    // API Base URL
    API_BASE_URL: process.env.API_BASE_URL || (
        process.env.NODE_ENV === 'production'
            ? 'https://child-care-back.onrender.com'
            : 'http://localhost:2006'
    ),
    
    // Google OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || (
        process.env.NODE_ENV === 'production'
            ? 'https://child-care-back.onrender.com/api/meetings/google/callback'
            : 'http://localhost:2006/api/meetings/google/callback'
    ),
    
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
    CORS_ORIGINS: [
        'https://child-care-front.vercel.app',
        'https://child-care-front-etng.vercel.app', // Keep old URL for fallback
        'http://localhost:5173',
        'http://localhost:3000'
    ]
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
    console.log('🔧 Environment Configuration:', {
        NODE_ENV: config.NODE_ENV,
        PORT: config.PORT,
        FRONTEND_URL: config.FRONTEND_URL,
        BACKEND_URL: config.BACKEND_URL,
        MONGODB_URI: config.MONGODB_URI ? '✅ Connected' : '❌ Missing',
        GOOGLE_AUTH: config.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Missing'
    });


module.exports = config;
