import RetailersService from "../../modules/retailers/retailers.service.js";

export async function getRetailerProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const profile = await RetailersService.getProfile(userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function updateRetailerProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const data = req.body;
    const profile = await RetailersService.updateProfile(userId, data);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}
