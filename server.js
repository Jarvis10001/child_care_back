require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const config = require('./config/environment');

const app = express();

// Enhanced CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://child-care-front.vercel.app',
            'https://child-care-front-etng.vercel.app', // Keep old URL for fallback
            'http://localhost:5173',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:3000'
        ];
        
        console.log('CORS check - Origin:', origin, 'Allowed:', allowedOrigins.includes(origin));
        
        if (allowedOrigins.includes(origin) || config.isDevelopment) {
            return callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            return callback(null, true); // Temporarily allow all origins for debugging
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Additional middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const authRoutes = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        environment: config.NODE_ENV,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        cors: 'enabled',
        auth: 'JWT-based'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/meetings', meetingRoutes);

// Test route for debugging
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: config.isDevelopment ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        
        // Start server
        const PORT = process.env.PORT || 2006;
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 Health check: http://localhost:${PORT}/health`);
            console.log(`🔧 Environment: ${config.NODE_ENV}`);
            console.log(`🌐 CORS enabled for development`);
            console.log(`🔐 Authentication: JWT-based (no sessions)`);
        });
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    });

module.exports = app;