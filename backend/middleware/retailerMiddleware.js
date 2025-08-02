// middleware/retailerAuth.js
import jwt from 'jsonwebtoken';
import { models } from '../models/index.js';// Import models correctly

/**
 * Authentication middleware for verifying JWT tokens
 * Checks if retailer is authenticated and adds user data to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Check if authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Extract token from header
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find retailer in database using the correct model method
    const retailer = await models.Retailer.findById(decoded.id);
    if (!retailer) {
      return res.status(401).json({ message: 'Retailer not found' });
    }

    // Remove password_hash from response for security
    delete retailer.password_hash;

    // Add retailer to request object
    req.user = retailer;
    req.user.role = 'retailer'; // Set role for authorization checks
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    console.error('❌ Retailer auth middleware error:', error.message);
    return res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * Role-based authorization middleware
 * Checks if the authenticated user has the required role
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

/**
 * Middleware to ensure user is a retailer
 */
export const requireRetailer = (req, res, next) => {
  if (!req.user || req.user.role !== 'retailer') {
    return res.status(403).json({ message: 'Retailer access required' });
  }
  next();
};

export default { authenticate, authorize, requireRetailer };