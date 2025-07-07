const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Doctor = require('../models/doctorModel');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('Auth check for:', req.method, req.originalUrl);
    console.log('Auth header:', authHeader);

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded);
      
      // Ensure we have required fields
      if (!decoded.id && !decoded.userId) {
        throw new Error('Invalid token structure');
      }

      req.user = {
        id: decoded.id || decoded.userId,
        role: decoded.role || 'user'
      };

      next();
    } catch (jwtError) {
      console.error('JWT Error:', jwtError);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Improved authorization middleware that properly handles admin roles
const authorize = (...roles) => {
  return (req, res, next) => {
    console.log(`Checking authorization for roles:`, roles);
    console.log(`User role: ${req.user?.role}, user ID: ${req.user?.id}`);
    
    // Always allow admin access to any route
    if (req.user.role === 'admin') {
      console.log('Admin access granted automatically');
      return next();
    }
    
    // For other roles, check if they're included in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}, your role: ${req.user.role}`
      });
    }
    
    console.log('Authorization successful for role:', req.user.role);
    next();
  };
};

module.exports = { protect, authorize };
