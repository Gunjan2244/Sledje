import { Retailer } from './Retailer.js';
import { Distributor } from './Distributor.js';
import { Product } from './Product.js';
import { Order } from './Order.js';
import { Cart } from './Cart.js';
import { ConnectionRequest } from './ConnectionRequest.js';
import { Inventory } from './Inventory.js';
import { Notification } from './Notification.js';
import { ProductBill } from './ProductBill.js';

export const models = {
  Retailer: new Retailer(),
  Distributor: new Distributor(),
  Product: new Product(),
  Order: new Order(),
  Cart: new Cart(),
  ConnectionRequest: new ConnectionRequest(),
  Inventory: new Inventory(),
  Notification: new Notification(),
  ProductBill: new ProductBill()
};

export default models;