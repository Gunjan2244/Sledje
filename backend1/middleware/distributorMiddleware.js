import jwt from 'jsonwebtoken';
import { models } from '../models/index.js';

/**
 * Authentication middleware for verifying JWT tokens
 * Checks if distributor is authenticated and adds user data to request 56
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

    // Find distributor in database using the correct model method
    const distributor = await models.Distributor.findById(decoded.id);
    if (!distributor) {
      return res.status(401).json({ message: 'Distributor not found' });
    }

    // Remove password_hash from response for security
    delete distributor.password_hash;

    // Add distributor to request object
    req.user = distributor;
    req.user.role = 'distributor'; // Set role for authorization checks
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    console.error('❌ Distributor auth middleware error:', error.message);
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
 * Middleware to ensure user is a distributor
 */
export const requireDistributor = (req, res, next) => {
  if (!req.user || req.user.role !== 'distributor') {
    return res.status(403).json({ message: 'Distributor access required' });
  }
  next();
};

export default { authenticate, authorize, requireDistributor };
