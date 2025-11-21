import AuthService from "../../modules/auth/auth.service.js";

export async function registerRetailer(req, res, next) {
  try {
    const data = req.body;
    const result = await AuthService.registerRetailer(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginRetailer(req, res, next) {
  try {
    const data = req.body;
    const result = await AuthService.loginRetailer(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function registerDistributor(req, res, next) {
  try {
    const data = req.body;
    const result = await AuthService.registerDistributor(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginDistributor(req, res, next) {
  try {
    const data = req.body;
    const result = await AuthService.loginDistributor(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    await AuthService.forgotPassword(email);
    res.json({ message: "OTP sent if the email exists" });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    const ok = await AuthService.verifyOtp(email, otp);
    res.json({ verified: ok });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;
    await AuthService.resetPassword(email, otp, newPassword);
    res.json({ message: "Password reset successful" });
  } catch (err) {
    next(err);
  }
}
