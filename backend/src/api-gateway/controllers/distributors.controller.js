import DistributorsService from "../../modules/distributors/distributors.service.js";

export async function getDistributorProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const profile = await DistributorsService.getProfile(userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function updateDistributorProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const data = req.body;
    const profile = await DistributorsService.updateProfile(userId, data);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}
