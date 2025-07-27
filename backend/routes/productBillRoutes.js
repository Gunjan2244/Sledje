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


// GET routes
router.get('/', getProductBills);
router.get('/outstanding', getOutstandingBalances);
router.get('/:billId', getProductBillDetails);

// POST routes
router.post('/sale', recordSale);
router.post('/payment/allocate', allocatePayment);
router.post('/:billId/payment', recordPayment);
router.post('/:billId/return', recordReturn);
router.post('/:billId/adjustment', recordAdjustment);

export default router;