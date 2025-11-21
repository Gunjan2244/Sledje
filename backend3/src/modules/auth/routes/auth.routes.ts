import { Router } from 'express';
import {
  registerRetailerHandler,
  registerDistributorHandler,
  loginRetailerHandler,
  loginDistributorHandler,
  sendOtpHandler,
  verifyOtpHandler,
  resetPasswordHandler
} from '../controllers/auth.controller';

const router = Router();

router.post('/retailers/register', registerRetailerHandler);
router.post('/distributors/register', registerDistributorHandler);
router.post('/retailers/login', loginRetailerHandler);
router.post('/distributors/login', loginDistributorHandler);
router.post('/forgot-password', sendOtpHandler);
router.post('/verify-otp', verifyOtpHandler);
router.post('/reset-password', resetPasswordHandler);

export default router;
