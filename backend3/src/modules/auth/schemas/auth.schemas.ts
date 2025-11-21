import { z } from 'zod';

export const registerRetailerSchema = z.object({
  businessName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().regex(/^\d{10}$/),
  gstNumber: z.string().optional(),
  businessType: z.string().optional(),
  pincode: z.string().optional(),
  location: z.any().optional(),
  address: z.string().optional()
});

export const registerDistributorSchema = registerRetailerSchema.extend({
  companyName: z.string().min(2)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const requestOtpSchema = z.object({ email: z.string().email() });
export const verifyOtpSchema = z.object({ email: z.string().email(), otp: z.string().length(6) });
export const resetPasswordSchema = z.object({ email: z.string().email(), otp: z.string().length(6), newPassword: z.string().min(6) });
