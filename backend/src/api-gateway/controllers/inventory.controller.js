import InventoryService from "../../modules/inventory/inventory.service.js";

export async function getInventory(req, res, next) {
  try {
    const userId = req.user.id;
    const data = await InventoryService.getInventory(userId);
    res.json({ inventory: data });
  } catch (err) {
    next(err);
  }
}

export async function addVariantToInventory(req, res, next) {
  try {
    const userId = req.user.id;
    const { variantId } = req.body;
    const data = await InventoryService.addVariant(userId, variantId);
    res.json({ message: "Variant added to inventory", item: data });
  } catch (err) {
    next(err);
  }
}

export async function updateInventoryAfterOrder(req, res, next) {
  try {
    const userId = req.user.id;
    const { orderId } = req.body;
    const data = await InventoryService.updateInventoryAfterOrder(userId, orderId);
    res.json({ message: "Inventory updated", updatedItems: data });
  } catch (err) {
    next(err);
  }
}
