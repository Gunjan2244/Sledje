// controllers/orderController.js
import { models } from '../models/index.js';
import { getPool } from '../config/db.js';

// RETAILER SIDE - Create and Send Order
export const createOrderRequest = async (req, res) => {
  try {
    const { distributorId, items, notes } = req.body;
    const retailerId = req.user.id;

    // Minimal validation - just check SKUs exist
    const validatedItems = await validateSkusOnly(items, distributorId);
    
    // Calculate total with current prices (might change before acceptance)
    const estimatedTotal = await calculateEstimatedTotal(validatedItems);

    const order = await models.Order.createWithItems({
      retailer_id: retailerId,
      distributor_id: distributorId,
      total_amount: estimatedTotal,
      status: 'pending',
      notes
    }, validatedItems);

    // Create notification to distributor
    await createNotification({
      recipient_id: distributorId,
      recipient_type: 'Distributor',
      type: 'new_order',
      order_id: order.id,
      message: `New order request from retailer`,
      data: { 
        order_number: order.order_number,
        item_count: items.length,
        estimated_total: estimatedTotal 
      }
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        estimatedTotal
      },
      message: 'Order request sent to distributor'
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DISTRIBUTOR SIDE - Accept/Reject Order
export const processOrderRequest = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { orderId } = req.params;
    const { action, rejectionReason, modifications } = req.body;
    const distributorId = req.user.id;

    const order = await models.Order.findOne({ 
      id: orderId, 
      distributor_id: distributorId,
      status: 'pending' 
    });

    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Order not found or already processed'
      });
    }

    if (action === 'accept') {
      // Validate stock and update final prices at acceptance time
      const finalItems = await validateStockAndUpdatePrices(order.items, distributorId);
      
      // Calculate final total using the validated items
      const finalTotal = finalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Reserve stock
      await reserveStock(finalItems, client);

      // Update order
      const updateQuery = `
        UPDATE orders 
        SET total_amount = $1, status = 'processing', updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      const orderResult = await client.query(updateQuery, [finalTotal, orderId]);

      // Update order items with final prices
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      
      for (const item of finalItems) {
        const itemQuery = `
          INSERT INTO order_items (
            order_id, product_id, sku, quantity, unit, ordered, price, product_name, variant_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await client.query(itemQuery, [
          orderId,
          item.product_id,
          item.sku,
          item.quantity,
          item.unit,
          item.ordered,
          item.price,
          item.product_name,
          item.variant_name
        ]);
      }

      // Notify retailer of acceptance
      await createNotification({
        recipient_id: order.retailer_id,
        recipient_type: 'Retailer',
        type: 'order_accepted',
        order_id: orderId,
        message: 'Your order has been accepted',
        data: { 
          order_number: order.order_number,
          final_total: finalTotal 
        }
      });

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Order accepted successfully',
        data: {
          orderId: orderId,
          status: 'processing',
          finalTotal
        }
      });

    } else if (action === 'reject') {
      const updateQuery = `
        UPDATE orders 
        SET status = 'cancelled', 
            notes = CASE 
              WHEN notes IS NULL OR notes = '' THEN $1
              ELSE notes || E'\\n\\n' || $1
            END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      await client.query(updateQuery, [`Rejection reason: ${rejectionReason}`, orderId]);

      // Notify retailer of rejection
      await createNotification({
        recipient_id: order.retailer_id,
        recipient_type: 'Retailer',
        type: 'order_rejected',
        order_id: orderId,
        message: 'Your order has been rejected',
        data: { 
          order_number: order.order_number,
          reason: rejectionReason 
        }
      });

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Order rejected',
        data: {
          orderId: orderId,
          status: 'cancelled'
        }
      });

    } else if (action === 'modify') {
      // Handle partial fulfillment or quantity modifications
      const modifiedItems = await applyModifications(order.items, modifications, client);
      
      const modifiedTotal = modifiedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Update order
      const updateQuery = `
        UPDATE orders 
        SET total_amount = $1, status = 'modified',
            notes = CASE 
              WHEN notes IS NULL OR notes = '' THEN 'Order modified by distributor'
              ELSE notes || E'\\n\\nOrder modified by distributor'
            END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      await client.query(updateQuery, [modifiedTotal, orderId]);

      // Update order items
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      
      for (const item of modifiedItems) {
        const itemQuery = `
          INSERT INTO order_items (
            order_id, product_id, sku, quantity, unit, ordered, price, product_name, variant_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await client.query(itemQuery, [
          orderId,
          item.product_id,
          item.sku,
          item.quantity,
          item.unit,
          item.ordered,
          item.price,
          item.product_name,
          item.variant_name
        ]);
      }

      // Enhanced notification with modification details
      await createNotification({
        recipient_id: order.retailer_id,
        recipient_type: 'Retailer',
        type: 'order_modified',
        order_id: orderId,
        message: 'Your order has been modified by the distributor',
        data: { 
          order_number: order.order_number,
          modified_total: modifiedTotal,
          original_total: modifications.summary?.originalTotal || 0,
          total_difference: modifications.summary?.totalDifference || 0,
          changed_items: modifications.summary?.changedItems || [],
          removed_items: modifications.summary?.removedItems || []
        }
      });

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Order modified successfully',
        data: {
          orderId: orderId,
          status: 'modified',
          modifiedTotal,
          originalTotal: modifications.summary?.originalTotal || 0,
          totalDifference: modifications.summary?.totalDifference || 0,
          modifications: modifications.summary
        }
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing order:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    client.release();
  }
};

// IMPROVED: Apply distributor modifications with price validation
const applyModifications = async (originalItems, modifications, client) => {
  try {
    // Get current order items from database
    const itemsQuery = `
      SELECT oi.*, p.id as product_id, p.name as product_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `;
    const itemsResult = await client.query(itemsQuery, [originalItems[0]?.order_id]);
    const modifiedItems = [...itemsResult.rows];

    console.log("Original items:", modifiedItems);
    console.log("Modifications received:", modifications);

    // Validate the modifications structure
    if (!modifications || !modifications.items || !Array.isArray(modifications.items)) {
      throw new Error('Invalid modifications structure');
    }

    // Apply modifications
    for (const mod of modifications.items) {
      const itemIndex = modifiedItems.findIndex(item => 
        item.product_id?.toString() === mod.productId?.toString() ||
        item.sku === mod.sku
      );

      if (itemIndex === -1) {
        console.warn(`Item not found for modification:`, mod);
        continue;
      }

      // Handle item removal first
      if (mod.remove === true || mod.newQuantity === 0) {
        modifiedItems.splice(itemIndex, 1);
        continue;
      }

      // Apply quantity changes
      if (mod.newQuantity !== undefined) {
        // Get current product and variant info
        const productQuery = `
          SELECT p.*, pv.* 
          FROM products p
          JOIN product_variants pv ON p.id = pv.product_id
          WHERE pv.sku = $1
        `;
        const productResult = await client.query(productQuery, [modifiedItems[itemIndex].sku]);
        
        if (productResult.rows.length === 0) {
          throw new Error(`Product not found for ${modifiedItems[itemIndex].sku}`);
        }

        const variant = productResult.rows[0];
        
        // Check stock availability
        if (variant.stock < mod.newQuantity) {
          throw new Error(`Insufficient stock for ${modifiedItems[itemIndex].product_name}. Available: ${variant.stock}, Requested: ${mod.newQuantity}`);
        }
        
        // Update item
        modifiedItems[itemIndex].quantity = mod.newQuantity;
        modifiedItems[itemIndex].ordered = mod.newQuantity;
        modifiedItems[itemIndex].price = parseFloat(variant.selling_price);
      }
    }

    // Filter out items with zero quantity
    const finalItems = modifiedItems.filter(item => item.quantity > 0);

    if (finalItems.length === 0) {
      throw new Error('Cannot process order with no items');
    }

    // Ensure all remaining items have valid prices
    for (const item of finalItems) {
      if (!item.price || item.price <= 0) {
        const priceQuery = `
          SELECT selling_price 
          FROM product_variants 
          WHERE sku = $1
        `;
        const priceResult = await client.query(priceQuery, [item.sku]);
        
        if (priceResult.rows.length > 0) {
          item.price = parseFloat(priceResult.rows[0].selling_price);
        } else {
          throw new Error(`Valid price not found for ${item.product_name}`);
        }
      }
    }

    return finalItems;

  } catch (error) {
    console.error('Error applying modifications:', error);
    throw error;
  }
};

// RETAILER SIDE - Approve Modified Order
export const approveModifiedOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { approved } = req.body;
    const retailerId = req.user.id;

    const order = await models.Order.findOne({
      id: orderId,
      retailer_id: retailerId,
      status: 'modified'
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Modified order not found'
      });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (approved) {
        // Get order items and reserve stock
        const itemsQuery = `SELECT * FROM order_items WHERE order_id = $1`;
        const itemsResult = await client.query(itemsQuery, [orderId]);
        
        await reserveStock(itemsResult.rows, client);
        
        // Update order status
        await client.query(
          'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
          ['processing', orderId]
        );
        
        await createNotification({
          recipient_id: order.distributor_id,
          recipient_type: 'Distributor',
          type: 'modification_approved',
          order_id: orderId,
          message: 'Retailer approved the order modifications'
        });
      } else {
        // Reject modifications
        await client.query(
          'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
          ['cancelled', orderId]
        );
        
        await createNotification({
          recipient_id: order.distributor_id,
          recipient_type: 'Distributor',
          type: 'modification_rejected',
          order_id: orderId,
          message: 'Retailer rejected the order modifications'
        });
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: approved ? 'Modified order approved' : 'Modified order rejected',
        data: { 
          orderId: orderId, 
          status: approved ? 'processing' : 'cancelled' 
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error approving modified order:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// MODIFY PENDING ORDER (RETAILER ONLY)
export const modifyPendingOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const retailerId = req.user.id;
    const { items, notes } = req.body;

    const order = await models.Order.findOne({
      id: orderId,
      retailer_id: retailerId,
      status: 'pending'
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be modified'
      });
    }

    // Validate new items
    const validatedItems = await validateSkusOnly(items, order.distributor_id);
    const newTotal = await calculateEstimatedTotal(validatedItems);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update order
      const updateQuery = `
        UPDATE orders 
        SET total_amount = $1, notes = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      await client.query(updateQuery, [newTotal, notes, orderId]);

      // Replace order items
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      
      for (const item of validatedItems) {
        const itemQuery = `
          INSERT INTO order_items (
            order_id, product_id, sku, quantity, unit, ordered, price, product_name, variant_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await client.query(itemQuery, [
          orderId,
          item.product_id,
          item.sku,
          item.quantity,
          item.unit,
          item.ordered,
          item.price,
          item.product_name,
          item.variant_name
        ]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Order modified successfully',
        data: {
          orderId: orderId,
          status: 'pending',
          items: validatedItems,
          notes: notes,
          totalAmount: newTotal
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error modifying pending order:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// HELPER FUNCTIONS

// Minimal validation - only check if SKUs exist for this distributor
const validateSkusOnly = async (items, distributorId) => {
  const validatedItems = [];
  
  for (let item of items) {
    const query = `
      SELECT p.*, pv.*
      FROM products p
      JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.distributor_id = $1 AND pv.sku = $2
    `;
    
    const result = await models.Order.query(query, [distributorId, item.sku]);
    
    if (result.rows.length === 0) {
      throw new Error(`SKU ${item.sku} not found for this distributor`);
    }
    
    const product = result.rows[0];
    
    validatedItems.push({
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit || 'box',
      ordered: item.quantity,
      product_id: product.id,
      product_name: product.name,
      variant_name: product.name,
      price: parseFloat(product.selling_price)
    });
  }
  
  return validatedItems;
};

// Calculate estimated total
const calculateEstimatedTotal = async (items) => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

// Full validation with stock check and price update at acceptance time
const validateStockAndUpdatePrices = async (items, distributorId) => {
  const finalItems = [];
  
  for (let item of items) {
    const query = `
      SELECT p.*, pv.*
      FROM products p
      JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.distributor_id = $1 AND pv.sku = $2
    `;
    
    const result = await models.Order.query(query, [distributorId, item.sku]);
    
    if (result.rows.length === 0) {
      throw new Error(`Product with SKU ${item.sku} not found`);
    }
    
    const variant = result.rows[0];
    
    if (variant.stock < item.quantity) {
      throw new Error(`Insufficient stock for SKU ${item.sku}. Available: ${variant.stock}, Requested: ${item.quantity}`);
    }
    
    finalItems.push({
      product_id: variant.id,
      product_name: variant.name,
      variant_name: variant.name,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit || 'box',
      ordered: item.quantity,
      price: parseFloat(variant.selling_price)
    });
  }
  
  return finalItems;
};

// Reserve stock (reduce available stock)
const reserveStock = async (items, client) => {
  for (let item of items) {
    const updateQuery = `
      UPDATE product_variants 
      SET stock = stock - $1 
      WHERE sku = $2
    `;
    await client.query(updateQuery, [item.quantity, item.sku]);
  }
};

// Simple notification helper
const createNotification = async ({ recipient_id, recipient_type, type, order_id, message, data = {} }) => {
  const notification = await models.Notification.createNotification({
    recipient_id,
    recipient_type: recipient_type || 'Retailer',
    type,
    order_id,
    message,
    data
  });
  
  return notification;
};

// GET ORDERS (with minimal data for lists)
export const getOrdersList = async (req, res) => {
  try {
    const role = req.user.role;
    const { status } = req.query;
    const userId = req.user.id;

    const orders = await models.Order.findByUser(userId, role, { status, limit: 50 });

    const responseData = orders.map(order => {
      const base = {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        totalAmount: parseFloat(order.total_amount),
        createdAt: order.created_at,
      };

      if (role === 'distributor') {
        return {
          ...base,
          retailer: {
            id: order.retailer_id,
            name: order.retailer_name,
            businessName: order.retailer_name,
          }
        };
      } else {
        return {
          ...base,
          distributor: {
            id: order.distributor_id,
            name: order.distributor_name,
            businessName: order.distributor_name,
          }
        };
      }
    });

    res.json({ success: true, data: responseData });

  } catch (error) {
    console.error("Error fetching order list:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET SINGLE ORDER (full details only when needed)
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const query = `
      SELECT 
        o.*,
        r.business_name as retailer_business_name,
        r.phone as retailer_phone,
        r.email as retailer_email,
        r.pincode as retailer_pincode,
        r.address as retailer_address,
        d.company_name as distributor_company_name,
        d.owner_name as distributor_owner_name,
        d.phone as distributor_phone,
        d.email as distributor_email,
        d.gst_number as distributor_gst_number,
        d.business_type as distributor_business_type,
        d.pincode as distributor_pincode,
        d.location as distributor_location,
        d.address as distributor_address,
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'sku', oi.sku,
            'quantity', oi.quantity,
            'unit', oi.unit,
            'ordered', oi.ordered,
            'price', oi.price,
            'product_name', oi.product_name,
            'variant_name', oi.variant_name
          )
        ) as items
      FROM orders o
      JOIN retailers r ON o.retailer_id = r.id
      JOIN distributors d ON o.distributor_id = d.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1 AND (o.retailer_id = $2 OR o.distributor_id = $2)
      GROUP BY o.id, r.id, d.id
    `;

    const result = await models.Order.query(query, [orderId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = result.rows[0];

    // Get order history
    const notifications = await models.Notification.getUserNotifications(userId, { order_id: orderId });

    const orderObj = {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      totalAmount: parseFloat(order.total_amount),
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      retailer: {
        businessName: order.retailer_business_name,
        phone: order.retailer_phone,
        email: order.retailer_email,
        pincode: order.retailer_pincode,
        address: order.retailer_address
      },
      distributor: {
        companyName: order.distributor_company_name,
        ownerName: order.distributor_owner_name,
        phone: order.distributor_phone,
        email: order.distributor_email,
        gstNumber: order.distributor_gst_number,
        businessType: order.distributor_business_type,
        pincode: order.distributor_pincode,
        location: order.distributor_location,
        address: order.distributor_address
      },
      items: order.items,
      orderHistory: notifications.map(n => ({
        type: n.type,
        message: n.message,
        date: n.created_at,
        data: n.data
      }))
    };

    res.json({
      success: true,
      data: orderObj
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CANCEL ORDER (Retailer only, only if pending)
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const retailerId = req.user.id;

    const order = await models.Order.findOne({
      id: orderId,
      retailer_id: retailerId,
      status: 'pending'
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be cancelled'
      });
    }

    const cancelReason = reason ? `Cancelled by retailer: ${reason}` : 'Cancelled by retailer';
    const newNotes = order.notes ? `${order.notes}\n\n${cancelReason}` : cancelReason;

    await models.Order.update(orderId, {
      status: 'cancelled',
      notes: newNotes
    });

    // Notify distributor
    await createNotification({
      recipient_id: order.distributor_id,
      recipient_type: 'Distributor',
      type: 'order_cancelled',
      order_id: orderId,
      message: 'Order cancelled by retailer',
      data: { 
        order_number: order.order_number,
        reason 
      }
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        orderId: orderId,
        status: 'cancelled'
      }
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE ORDER STATUS (Distributor only - processing to completed)
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    const distributorId = req.user.id;

    const order = await models.Order.findOne({
      id: orderId,
      distributor_id: distributorId,
      status: 'processing'
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not in processing state'
      });
    }

    if (!['completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Can only mark as completed or cancelled'
      });
    }

    const updatedNotes = notes ? 
      (order.notes ? `${order.notes}\n\n${notes}` : notes) : 
      order.notes;

    await models.Order.update(orderId, {
      status: status,
      notes: updatedNotes
    });

    // Notify retailer
    await createNotification({
      recipient_id: order.retailer_id,
      recipient_type: 'Retailer',
      type: status === 'completed' ? 'order_completed' : 'order_cancelled',
      order_id: orderId,
      message: status === 'completed' ? 
        'Your order has been completed' : 
        'Your order has been cancelled',
      data: { 
        order_number: order.order_number,
        final_status: status
      }
    });

    res.json({
      success: true,
      message: `Order ${status} successfully`,
      data: {
        orderId: orderId,
        status: status
      }
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET NOTIFICATIONS
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { read, limit = 20, page = 1 } = req.query;
    
    const notifications = await models.Notification.getUserNotifications(userId, {
      read: read === 'true' ? true : read === 'false' ? false : undefined,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    const unreadCount = await models.Notification.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// MARK NOTIFICATION AS READ
export const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await models.Notification.markAsRead(notificationId, userId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET ORDER HISTORY/TIMELINE - Retailer can track all stages
export const getOrderHistory = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    
    // Get order with basic info
    const orderQuery = `
      SELECT order_number, status, created_at, updated_at, notes
      FROM orders 
      WHERE id = $1 AND (retailer_id = $2 OR distributor_id = $2)
    `;
    
    const orderResult = await models.Order.query(orderQuery, [orderId, userId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get all notifications related to this order for timeline
    const notificationsQuery = `
      SELECT type, message, created_at, data
      FROM notifications
      WHERE order_id = $1
      ORDER BY created_at ASC
    `;
    
    const notificationsResult = await models.Notification.query(notificationsQuery, [orderId]);

    // Build timeline
    const timeline = [
      {
        stage: 'created',
        status: 'Order Placed',
        timestamp: order.created_at,
        message: 'Order request sent to distributor',
        type: 'info'
      }
    ];

    // Add notification events to timeline
    notificationsResult.rows.forEach(notif => {
      const timelineItem = {
        stage: notif.type,
        timestamp: notif.created_at,
        message: notif.message,
        data: notif.data
      };

      switch(notif.type) {
        case 'order_accepted':
          timelineItem.status = 'Order Accepted';
          timelineItem.type = 'success';
          break;
        case 'order_rejected':
          timelineItem.status = 'Order Rejected';
          timelineItem.type = 'error';
          break;
        case 'order_modified':
          timelineItem.status = 'Order Modified';
          timelineItem.type = 'warning';
          break;
        case 'order_completed':
          timelineItem.status = 'Order Completed';
          timelineItem.type = 'success';
          break;
        default:
          timelineItem.type = 'info';
      }

      timeline.push(timelineItem);
    });

    res.json({
      success: true,
      data: {
        order: {
          id: orderId,
          orderNumber: order.order_number,
          currentStatus: order.status,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        },
        timeline
      }
    });

  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET REAL-TIME ORDER STATUS UPDATES
export const getOrderStatusUpdates = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    
    const orderQuery = `
      SELECT order_number, status, total_amount, updated_at
      FROM orders 
      WHERE id = $1 AND (retailer_id = $2 OR distributor_id = $2)
    `;
    
    const orderResult = await models.Order.query(orderQuery, [orderId, userId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get unread notifications for this order
    const unreadNotificationsQuery = `
      SELECT id, type, message, created_at, data
      FROM notifications
      WHERE order_id = $1 AND recipient_id = $2 AND read = false
      ORDER BY created_at DESC
    `;
    
    const unreadResult = await models.Notification.query(unreadNotificationsQuery, [orderId, userId]);

    // Status info for retailer
    const statusInfo = {
      orderId: orderId,
      orderNumber: order.order_number,
      currentStatus: order.status,
      lastUpdated: order.updated_at,
      totalAmount: parseFloat(order.total_amount),
      hasUpdates: unreadResult.rows.length > 0,
      updates: unreadResult.rows.map(notif => ({
        id: notif.id,
        type: notif.type,
        message: notif.message,
        timestamp: notif.created_at,
        data: notif.data
      }))
    };

    // Add status-specific info
    switch(order.status) {
      case 'pending':
        statusInfo.description = 'Waiting for distributor response';
        statusInfo.canCancel = true;
        break;
      case 'modified':
        statusInfo.description = 'Distributor has modified your order - approval needed';
        statusInfo.needsApproval = true;
        break;
      case 'processing':
        statusInfo.description = 'Order accepted and being prepared';
        statusInfo.canCancel = false;
        break;
      case 'completed':
        statusInfo.description = 'Order completed and delivered';
        break;
      case 'cancelled':
        statusInfo.description = 'Order cancelled';
        break;
    }

    res.json({
      success: true,
      data: statusInfo
    });

  } catch (error) {
    console.error('Error fetching order status updates:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const validateModificationRequest = (modifications) => {
  const errors = [];

  if (!modifications || typeof modifications !== 'object') {
    errors.push('Modifications object is required');
    return errors;
  }

  if (!modifications.items || !Array.isArray(modifications.items)) {
    errors.push('Modifications must contain an items array');
    return errors;
  }

  modifications.items.forEach((item, index) => {
    if (!item.productId && !item.sku) {
      errors.push(`Item ${index + 1}: productId or sku is required`);
    }

    if (item.newQuantity !== undefined) {
      if (typeof item.newQuantity !== 'number' || item.newQuantity < 0) {
        errors.push(`Item ${index + 1}: newQuantity must be a non-negative number`);
      }
    }

    if (item.remove !== undefined && typeof item.remove !== 'boolean') {
      errors.push(`Item ${index + 1}: remove must be a boolean`);
    }
  });

  return errors;
};