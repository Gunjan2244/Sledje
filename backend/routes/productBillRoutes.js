// routes/productBillRoutes.js
import express from 'express';
import {
  getProductBills,
  getProductBillDetails,
  recordSale,
  recordPayment,
  recordReturn,
  recordAdjustment,
  allocatePayment,
  getOutstandingBalances
} from '../controllers/productBillController.js';


const router = express.Router();

// Apply authentication middleware to all routes
import {
  authenticate as authenticateRetailer,
  authorize as authorizeRetailer
} from '../middleware/retailerMiddleware.js';

import {
  authenticate as authenticateDistributor,
  authorize as authorizeDistributor
} from '../middleware/distributorMiddleware.js';

// GET routes
router.get('/',authenticateRetailer,authorizeDistributor, getProductBills);
router.get('/outstanding',authenticateRetailer,authorizeRetailer, getOutstandingBalances);
router.get('/:billId',authenticateRetailer,authorizeRetailer, getProductBillDetails);

// POST routes
router.post('/sale',authenticateRetailer,authorizeRetailer, recordSale);
router.post('/payment/allocate',authenticateRetailer,authorizeRetailer, allocatePayment);
router.post('/:billId/payment',authenticateRetailer,authorizeRetailer, recordPayment);
router.post('/:billId/return',authenticateRetailer,authorizeRetailer, recordReturn);
router.post('/:billId/adjustment',authenticateRetailer,authorizeRetailer, recordAdjustment);

export default router;