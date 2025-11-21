// controllers/productBillController.js
import { models } from '../models/index.js';
import { getPool } from '../config/db.js';

// GET PRODUCT BILLS - List with filters and pagination
export const getProductBills = async (req, res) => {
  try {
    const { role } = req.user;
    const userId = req.user.id;
    const { 
      partnerId, 
      status = 'active', 
      hasOutstanding, 
      page = 1, 
      limit = 20,
      sortBy = 'last_transaction_date',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      status,
      partner_id: partnerId,
      has_outstanding: hasOutstanding === 'true',
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    const bills = await models.ProductBill.getBillsWithDetails(userId, role, filters);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as count
      FROM product_bills pb
      WHERE pb.${role === 'retailer' ? 'retailer_id' : 'distributor_id'} = $1
      AND pb.status = $2
      ${partnerId ? `AND pb.${role === 'retailer' ? 'distributor_id' : 'retailer_id'} = $3` : ''}
      ${hasOutstanding === 'true' ? 'AND (pb.total_amount_due - pb.total_amount_paid) > 0' : ''}
    `;
    
    const countParams = [userId, status];
    if (partnerId) countParams.push(partnerId);
    
    const countResult = await models.ProductBill.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Calculate summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_products,
        SUM(total_quantity_sold) as total_quantity_sold,
        SUM(total_amount_due) as total_amount_due,
        SUM(total_amount_paid) as total_amount_paid,
        SUM(total_amount_due - total_amount_paid) as total_outstanding
      FROM product_bills
      WHERE ${role === 'retailer' ? 'retailer_id' : 'distributor_id'} = $1
      AND status = 'active'
      ${partnerId ? `AND ${role === 'retailer' ? 'distributor_id' : 'retailer_id'} = $2` : ''}
    `;
    
    const summaryParams = [userId];
    if (partnerId) summaryParams.push(partnerId);
    
    const summaryResult = await models.ProductBill.query(summaryQuery, summaryParams);
    const summary = summaryResult.rows[0];

    res.json({
      success: true,
      data: {
        bills: bills.map(bill => ({
          id: bill.id,
          product: {
            id: bill.product_id,
            name: bill.product_name,
            category: bill.product_category,
            icon: bill.product_icon
          },
          retailer: {
            id: bill.retailer_id,
            businessName: bill.retailer_name,
            ownerName: bill.retailer_owner
          },
          distributor: {
            id: bill.distributor_id,
            companyName: bill.distributor_name,
            ownerName: bill.distributor_owner
          },
          sku: bill.sku,
          totalQuantitySold: bill.total_quantity_sold,
          totalQuantityReturned: bill.total_quantity_returned,
          netQuantity: bill.net_quantity,
          totalAmountDue: parseFloat(bill.total_amount_due),
          totalAmountPaid: parseFloat(bill.total_amount_paid),
          outstandingBalance: parseFloat(bill.outstanding_balance),
          currentUnitPrice: parseFloat(bill.current_unit_price),
          lastTransactionDate: bill.last_transaction_date,
          aging: calculateAging(bill.last_transaction_date, bill.credit_days, parseFloat(bill.outstanding_balance))
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        summary: {
          totalProducts: parseInt(summary.total_products || 0),
          totalQuantitySold: parseInt(summary.total_quantity_sold || 0),
          totalAmountDue: parseFloat(summary.total_amount_due || 0),
          totalAmountPaid: parseFloat(summary.total_amount_paid || 0),
          totalOutstanding: parseFloat(summary.total_outstanding || 0)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching product bills:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET SINGLE PRODUCT BILL - Full details with transaction history
export const getProductBillDetails = async (req, res) => {
  try {
    const { billId } = req.params;
    const userId = req.user.id;
    const { role } = req.user;

    const bill = await models.ProductBill.getBillWithTransactions(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    // Check if user has access to this bill
    const hasAccess = (role === 'retailer' && bill.retailer_id === userId) ||
                      (role === 'distributor' && bill.distributor_id === userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get product variant details if variant_id exists
    let variantDetails = null;
    if (bill.variant_id) {
      const variantQuery = `
        SELECT * FROM product_variants WHERE id = $1
      `;
      const variantResult = await models.ProductBill.query(variantQuery, [bill.variant_id]);
      variantDetails = variantResult.rows[0];
    }

    const formattedBill = {
      id: bill.id,
      retailer: {
        id: bill.retailer_id,
        businessName: bill.retailer_name
      },
      distributor: {
        id: bill.distributor_id,
        companyName: bill.distributor_name
      },
      product: {
        id: bill.product_id,
        name: bill.product_name,
        category: bill.product_category
      },
      variant: variantDetails ? {
        id: variantDetails.id,
        name: variantDetails.name,
        sku: variantDetails.sku
      } : null,
      sku: bill.sku,
      totalQuantitySold: bill.total_quantity_sold,
      totalQuantityReturned: bill.total_quantity_returned,
      netQuantity: bill.total_quantity_sold - bill.total_quantity_returned,
      totalAmountDue: parseFloat(bill.total_amount_due),
      totalAmountPaid: parseFloat(bill.total_amount_paid),
      outstandingBalance: parseFloat(bill.total_amount_due) - parseFloat(bill.total_amount_paid),
      currentUnitPrice: parseFloat(bill.current_unit_price),
      lastTransactionDate: bill.last_transaction_date,
      creditLimit: parseFloat(bill.credit_limit),
      creditDays: bill.credit_days,
      status: bill.status,
      aging: calculateAging(bill.last_transaction_date, bill.credit_days, parseFloat(bill.total_amount_due) - parseFloat(bill.total_amount_paid)),
      transactions: bill.transactions || [],
      metadata: bill.metadata,
      createdAt: bill.created_at,
      updatedAt: bill.updated_at
    };

    res.json({
      success: true,
      data: formattedBill
    });

  } catch (error) {
    console.error('Error fetching product bill details:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// RECORD SALE - Usually called from order processing
export const recordSale = async (req, res) => {
  try {
    const { 
      retailerId, 
      distributorId, 
      productId, 
      variantId, 
      sku, 
      quantity, 
      unitPrice, 
      orderId, 
      note 
    } = req.body;

    const amount = quantity * unitPrice;

    // Find or create product bill
    let bill = await models.ProductBill.createOrUpdate({
      retailer_id: retailerId,
      distributor_id: distributorId,
      product_id: productId,
      variant_id: variantId || null,
      sku,
      current_unit_price: unitPrice
    });

    // Add sale transaction
    const result = await models.ProductBill.addTransaction(bill.id, {
      type: 'sale',
      quantity,
      unit_price: unitPrice,
      amount,
      order_id: orderId,
      note: note || '',
      created_by: req.user.id,
      created_by_model: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
    });

    res.json({
      success: true,
      message: 'Sale recorded successfully',
      data: {
        billId: bill.id,
        transactionId: result.transaction.id,
        newOutstandingBalance: parseFloat(result.bill.total_amount_due) - parseFloat(result.bill.total_amount_paid)
      }
    });

  } catch (error) {
    console.error('Error recording sale:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// RECORD PAYMENT
export const recordPayment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { amount, paymentMethod, referenceNumber, note } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be positive'
      });
    }

    const bill = await models.ProductBill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    const outstandingBalance = parseFloat(bill.total_amount_due) - parseFloat(bill.total_amount_paid);

    // Check if payment exceeds outstanding balance
    if (amount > outstandingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${amount}) exceeds outstanding balance (${outstandingBalance})`
      });
    }

    // Add payment transaction
    const result = await models.ProductBill.addTransaction(billId, {
      type: 'payment',
      amount,
      payment_method: paymentMethod,
      reference_number: referenceNumber,
      note: note || '',
      created_by: userId,
      created_by_model: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
    });

    const newOutstandingBalance = parseFloat(result.bill.total_amount_due) - parseFloat(result.bill.total_amount_paid);

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        billId: billId,
        transactionId: result.transaction.id,
        newOutstandingBalance,
        amountPaid: amount
      }
    });

  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// RECORD RETURN
export const recordReturn = async (req, res) => {
  try {
    const { billId } = req.params;
    const { quantity, unitPrice, reason, note } = req.body;
    const userId = req.user.id;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Return quantity must be positive'
      });
    }

    const bill = await models.ProductBill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    // Use current unit price if not provided
    const returnUnitPrice = unitPrice || parseFloat(bill.current_unit_price);
    const amount = quantity * returnUnitPrice;

    // Check if return quantity exceeds sold quantity
    const netQuantity = bill.total_quantity_sold - bill.total_quantity_returned;
    if (quantity > netQuantity) {
      return res.status(400).json({
        success: false,
        message: `Return quantity (${quantity}) exceeds net sold quantity (${netQuantity})`
      });
    }

    // Add return transaction
    const result = await models.ProductBill.addTransaction(billId, {
      type: 'return',
      quantity,
      unit_price: returnUnitPrice,
      amount,
      note: `${reason}: ${note}`,
      created_by: userId,
      created_by_model: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
    });

    const newOutstandingBalance = parseFloat(result.bill.total_amount_due) - parseFloat(result.bill.total_amount_paid);

    res.json({
      success: true,
      message: 'Return recorded successfully',
      data: {
        billId: billId,
        transactionId: result.transaction.id,
        newOutstandingBalance,
        returnAmount: amount
      }
    });

  } catch (error) {
    console.error('Error recording return:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// RECORD ADJUSTMENT
export const recordAdjustment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { amount, type, reason, note } = req.body;
    const userId = req.user.id;

    if (!amount || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Adjustment amount cannot be zero'
      });
    }

    const bill = await models.ProductBill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    // Add adjustment transaction
    const result = await models.ProductBill.addTransaction(billId, {
      type: 'adjustment',
      amount,
      note: `${reason}: ${note}`,
      created_by: userId,
      created_by_model: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
    });

    const newOutstandingBalance = parseFloat(result.bill.total_amount_due) - parseFloat(result.bill.total_amount_paid);

    res.json({
      success: true,
      message: 'Adjustment recorded successfully',
      data: {
        billId: billId,
        transactionId: result.transaction.id,
        newOutstandingBalance,
        adjustmentAmount: amount
      }
    });

  } catch (error) {
    console.error('Error recording adjustment:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// BULK PAYMENT ALLOCATION
export const allocatePayment = async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const { totalAmount, allocations, paymentMethod, referenceNumber, note } = req.body;
    const userId = req.user.id;

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total payment amount must be positive'
      });
    }

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment allocations are required'
      });
    }

    // Validate total allocation matches payment amount
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    if (Math.abs(totalAllocated - totalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Total allocated amount must match payment amount'
      });
    }

    await client.query('BEGIN');

    const results = [];

    for (const allocation of allocations) {
      const { billId, amount } = allocation;

      const billQuery = `SELECT * FROM product_bills WHERE id = $1`;
      const billResult = await client.query(billQuery, [billId]);
      const bill = billResult.rows[0];

      if (!bill) {
        throw new Error(`Product bill ${billId} not found`);
      }

      const outstandingBalance = parseFloat(bill.total_amount_due) - parseFloat(bill.total_amount_paid);

      if (amount > outstandingBalance) {
        throw new Error(`Allocation amount (${amount}) exceeds outstanding balance (${outstandingBalance}) for product ${bill.sku}`);
      }

      // Add payment transaction
      const transactionQuery = `
        INSERT INTO product_bill_transactions (
          product_bill_id, type, amount, payment_method, reference_number,
          note, created_by, created_by_model
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const transactionResult = await client.query(transactionQuery, [
        billId,
        'payment',
        amount,
        paymentMethod,
        referenceNumber,
        `Bulk payment allocation: ${note}`,
        userId,
        req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
      ]);

      // Update bill totals
      const updateBillQuery = `
        UPDATE product_bills 
        SET 
          total_amount_paid = total_amount_paid + $1,
          last_transaction_date = NOW(),
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const updatedBillResult = await client.query(updateBillQuery, [amount, billId]);
      const updatedBill = updatedBillResult.rows[0];

      const newOutstandingBalance = parseFloat(updatedBill.total_amount_due) - parseFloat(updatedBill.total_amount_paid);

      results.push({
        billId: billId,
        sku: bill.sku,
        allocatedAmount: amount,
        newOutstandingBalance
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment allocated successfully',
      data: {
        totalAmount,
        allocations: results,
        paymentReference: referenceNumber
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error allocating payment:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    client.release();
  }
};

// GET OUTSTANDING BALANCES SUMMARY
export const getOutstandingBalances = async (req, res) => {
  try {
    const { role } = req.user;
    const userId = req.user.id;
    const { partnerId } = req.query;

    const userColumn = role === 'retailer' ? 'retailer_id' : 'distributor_id';
    const partnerColumn = role === 'retailer' ? 'distributor_id' : 'retailer_id';

    let query = `
      SELECT 
        pb.*,
        p.name as product_name,
        p.category as product_category,
        p.icon as product_icon,
        r.business_name as retailer_name,
        r.owner_name as retailer_owner,
        d.company_name as distributor_name,
        d.owner_name as distributor_owner,
        (pb.total_amount_due - pb.total_amount_paid) as outstanding_balance
      FROM product_bills pb
      JOIN products p ON pb.product_id = p.id
      JOIN retailers r ON pb.retailer_id = r.id
      JOIN distributors d ON pb.distributor_id = d.id
      WHERE pb.${userColumn} = $1
      AND pb.status = 'active'
      AND (pb.total_amount_due - pb.total_amount_paid) > 0
    `;

    const params = [userId];

    if (partnerId) {
      query += ` AND pb.${partnerColumn} = $${params.length + 1}`;
      params.push(partnerId);
    }

    query += ` ORDER BY pb.last_transaction_date DESC`;

    const result = await models.ProductBill.query(query, params);

    const outstandingBills = result.rows.map(bill => ({
      id: bill.id,
      product: {
        id: bill.product_id,
        name: bill.product_name,
        category: bill.product_category,
        icon: bill.product_icon
      },
      retailer: {
        id: bill.retailer_id,
        businessName: bill.retailer_name,
        ownerName: bill.retailer_owner
      },
      distributor: {
        id: bill.distributor_id,
        companyName: bill.distributor_name,
        ownerName: bill.distributor_owner
      },
      sku: bill.sku,
      outstandingBalance: parseFloat(bill.outstanding_balance),
      aging: calculateAging(bill.last_transaction_date, bill.credit_days, parseFloat(bill.outstanding_balance)),
      lastTransactionDate: bill.last_transaction_date
    }));

    // Calculate totals
    const totals = {
      totalOutstanding: outstandingBills.reduce((sum, bill) => sum + bill.outstandingBalance, 0),
      totalCurrent: outstandingBills.reduce((sum, bill) => sum + bill.aging.current, 0),
      totalOverdue: outstandingBills.reduce((sum, bill) => sum + bill.aging.overdue, 0),
      billCount: outstandingBills.length
    };

    res.json({
      success: true,
      data: {
        outstandingBills,
        totals
      }
    });

  } catch (error) {
    console.error('Error fetching outstanding balances:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to process order items and create/update product bills
export const processOrderItems = async (orderItems, retailerId, distributorId, orderId) => {
  try {
    const results = [];

    for (const item of orderItems) {
      const { productId, variantId, sku, quantity, price } = item;
      const amount = quantity * price;

      // Find or create product bill
      let bill = await models.ProductBill.createOrUpdate({
        retailer_id: retailerId,
        distributor_id: distributorId,
        product_id: productId,
        variant_id: variantId || null,
        sku,
        current_unit_price: price
      });

      // Add sale transaction
      const result = await models.ProductBill.addTransaction(bill.id, {
        type: 'sale',
        quantity,
        unit_price: price,
        amount,
        order_id: orderId,
        note: `Order ${orderId}`,
        created_by: distributorId,
        created_by_model: 'Distributor'
      });

      const newOutstandingBalance = parseFloat(result.bill.total_amount_due) - parseFloat(result.bill.total_amount_paid);

      results.push({
        billId: bill.id,
        sku,
        quantity,
        amount,
        newOutstandingBalance
      });
    }

    return results;

  } catch (error) {
    console.error('Error processing order items:', error);
    throw error;
  }
};

// Helper function to calculate aging
const calculateAging = (lastTransactionDate, creditDays, outstandingBalance) => {
  if (outstandingBalance <= 0) {
    return { current: 0, overdue: 0, days: 0 };
  }

  const daysDiff = Math.floor((new Date() - new Date(lastTransactionDate)) / (1000 * 60 * 60 * 24));
  const isOverdue = daysDiff > creditDays;

  return {
    current: isOverdue ? 0 : outstandingBalance,
    overdue: isOverdue ? outstandingBalance : 0,
    days: daysDiff
  };
};

// GET PRODUCT BILL TRANSACTIONS
export const getProductBillTransactions = async (req, res) => {
  try {
    const { billId } = req.params;
    const userId = req.user.id;
    const { role } = req.user;
    const { page = 1, limit = 50 } = req.query;

    // Check if user has access to this bill
    const billQuery = `
      SELECT retailer_id, distributor_id 
      FROM product_bills 
      WHERE id = $1
    `;
    const billResult = await models.ProductBill.query(billQuery, [billId]);

    if (billResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    const bill = billResult.rows[0];
    const hasAccess = (role === 'retailer' && bill.retailer_id === userId) ||
                      (role === 'distributor' && bill.distributor_id === userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get transactions with pagination
    const transactionsQuery = `
      SELECT 
        pbt.*,
        CASE 
          WHEN pbt.created_by_model = 'Retailer' THEN r.owner_name
          WHEN pbt.created_by_model = 'Distributor' THEN d.owner_name
        END as created_by_name
      FROM product_bill_transactions pbt
      LEFT JOIN retailers r ON pbt.created_by = r.id AND pbt.created_by_model = 'Retailer'
      LEFT JOIN distributors d ON pbt.created_by = d.id AND pbt.created_by_model = 'Distributor'
      WHERE pbt.product_bill_id = $1
      ORDER BY pbt.transaction_date DESC
      LIMIT $2 OFFSET $3
    `;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const transactionsResult = await models.ProductBill.query(transactionsQuery, [
      billId, 
      parseInt(limit), 
      offset
    ]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM product_bill_transactions 
      WHERE product_bill_id = $1
    `;
    const countResult = await models.ProductBill.query(countQuery, [billId]);
    const total = parseInt(countResult.rows[0].count);

    const transactions = transactionsResult.rows.map(transaction => ({
      id: transaction.id,
      type: transaction.type,
      quantity: transaction.quantity,
      unitPrice: parseFloat(transaction.unit_price),
      amount: parseFloat(transaction.amount),
      note: transaction.note,
      orderId: transaction.order_id,
      paymentMethod: transaction.payment_method,
      referenceNumber: transaction.reference_number,
      transactionDate: transaction.transaction_date,
      createdBy: {
        id: transaction.created_by,
        name: transaction.created_by_name,
        type: transaction.created_by_model
      },
      createdAt: transaction.created_at
    }));

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching product bill transactions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE PRODUCT BILL METADATA
export const updateProductBillMetadata = async (req, res) => {
  try {
    const { billId } = req.params;
    const { creditLimit, creditDays, notes } = req.body;
    const userId = req.user.id;
    const { role } = req.user;

    // Check if user has access to this bill
    const bill = await models.ProductBill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    const hasAccess = (role === 'retailer' && bill.retailer_id === userId) ||
                      (role === 'distributor' && bill.distributor_id === userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update metadata
    const updateData = {};
    if (creditLimit !== undefined) updateData.credit_limit = creditLimit;
    if (creditDays !== undefined) updateData.credit_days = creditDays;
    
    if (notes !== undefined) {
      const currentMetadata = bill.metadata || {};
      updateData.metadata = JSON.stringify({
        ...currentMetadata,
        notes,
        lastUpdatedBy: userId,
        lastUpdatedAt: new Date()
      });
    }

    const updatedBill = await models.ProductBill.update(billId, updateData);

    res.json({
      success: true,
      message: 'Product bill metadata updated successfully',
      data: {
        billId: billId,
        creditLimit: parseFloat(updatedBill.credit_limit),
        creditDays: updatedBill.credit_days,
        metadata: updatedBill.metadata
      }
    });

  } catch (error) {
    console.error('Error updating product bill metadata:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET PRODUCT BILL SUMMARY BY PARTNER
export const getProductBillSummary = async (req, res) => {
  try {
    const { role } = req.user;
    const userId = req.user.id;
    const { partnerId } = req.query;

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: 'Partner ID is required'
      });
    }

    const userColumn = role === 'retailer' ? 'retailer_id' : 'distributor_id';
    const partnerColumn = role === 'retailer' ? 'distributor_id' : 'retailer_id';

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_bills,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_bills,
        SUM(total_quantity_sold) as total_quantity_sold,
        SUM(total_quantity_returned) as total_quantity_returned,
        SUM(total_amount_due) as total_amount_due,
        SUM(total_amount_paid) as total_amount_paid,
        SUM(total_amount_due - total_amount_paid) as total_outstanding,
        AVG(current_unit_price) as avg_unit_price,
        MAX(last_transaction_date) as last_transaction_date,
        COUNT(CASE WHEN (total_amount_due - total_amount_paid) > 0 THEN 1 END) as bills_with_outstanding
      FROM product_bills
      WHERE ${userColumn} = $1 AND ${partnerColumn} = $2
    `;

    const result = await models.ProductBill.query(summaryQuery, [userId, partnerId]);
    const summary = result.rows[0];

    // Get aging breakdown
    const agingQuery = `
      SELECT 
        pb.id,
        pb.last_transaction_date,
        pb.credit_days,
        (pb.total_amount_due - pb.total_amount_paid) as outstanding_balance
      FROM product_bills pb
      WHERE pb.${userColumn} = $1 AND pb.${partnerColumn} = $2
      AND pb.status = 'active'
      AND (pb.total_amount_due - pb.total_amount_paid) > 0
    `;

    const agingResult = await models.ProductBill.query(agingQuery, [userId, partnerId]);
    
    let currentTotal = 0;
    let overdueTotal = 0;

    agingResult.rows.forEach(bill => {
      const aging = calculateAging(bill.last_transaction_date, bill.credit_days, parseFloat(bill.outstanding_balance));
      currentTotal += aging.current;
      overdueTotal += aging.overdue;
    });

    const formattedSummary = {
      totalBills: parseInt(summary.total_bills || 0),
      activeBills: parseInt(summary.active_bills || 0),
      totalQuantitySold: parseInt(summary.total_quantity_sold || 0),
      totalQuantityReturned: parseInt(summary.total_quantity_returned || 0),
      netQuantity: parseInt(summary.total_quantity_sold || 0) - parseInt(summary.total_quantity_returned || 0),
      totalAmountDue: parseFloat(summary.total_amount_due || 0),
      totalAmountPaid: parseFloat(summary.total_amount_paid || 0),
      totalOutstanding: parseFloat(summary.total_outstanding || 0),
      avgUnitPrice: parseFloat(summary.avg_unit_price || 0),
      lastTransactionDate: summary.last_transaction_date,
      billsWithOutstanding: parseInt(summary.bills_with_outstanding || 0),
      aging: {
        current: currentTotal,
        overdue: overdueTotal
      }
    };

    res.json({
      success: true,
      data: formattedSummary
    });

  } catch (error) {
    console.error('Error fetching product bill summary:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// EXPORT PRODUCT BILLS (CSV format)
export const exportProductBills = async (req, res) => {
  try {
    const { role } = req.user;
    const userId = req.user.id;
    const { partnerId, status = 'active', format = 'csv' } = req.query;

    const filters = { status, partner_id: partnerId };
    const bills = await models.ProductBill.getBillsWithDetails(userId, role, filters);

    if (format === 'csv') {
      const csvHeaders = [
        'Product Name',
        'SKU',
        'Partner',
        'Total Quantity Sold',
        'Total Quantity Returned',
        'Net Quantity',
        'Total Amount Due',
        'Total Amount Paid',
        'Outstanding Balance',
        'Current Unit Price',
        'Last Transaction Date',
        'Status'
      ];

      const csvRows = bills.map(bill => [
        bill.product_name,
        bill.sku,
        role === 'retailer' ? bill.distributor_name : bill.retailer_name,
        bill.total_quantity_sold,
        bill.total_quantity_returned,
        bill.net_quantity,
        bill.total_amount_due,
        bill.total_amount_paid,
        bill.outstanding_balance,
        bill.current_unit_price,
        bill.last_transaction_date,
        bill.status
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="product-bills-${Date.now()}.csv"`);
      res.send(csvContent);
    } else {
      // JSON export
      res.json({
        success: true,
        data: bills,
        exportedAt: new Date(),
        totalRecords: bills.length
      });
    }

  } catch (error) {
    console.error('Error exporting product bills:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};