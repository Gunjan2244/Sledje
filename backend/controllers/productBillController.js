// controllers/productBillController.js
import ProductBill from '../models/ProductBill.js';
import Product from '../models/Product.js';
import Retailer from '../models/Retailer.js';
import Distributor from '../models/Distributor.js';
import mongoose from 'mongoose';

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
      sortBy = 'lastTransactionDate',
      sortOrder = 'desc'
    } = req.query;

    let filter = { status };
    
    // Set filter based on user role
    if (role === 'retailer') {
      filter.retailerId = userId;
      if (partnerId) filter.distributorId = partnerId;
    } else if (role === 'distributor') {
      filter.distributorId = userId;
      if (partnerId) filter.retailerId = partnerId;
    }

    // Filter for outstanding balances
    if (hasOutstanding === 'true') {
      filter.$expr = { $gt: [{ $subtract: ['$totalAmountDue', '$totalAmountPaid'] }, 0] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const bills = await ProductBill.find(filter)
      .populate('productId', 'name category icon')
      .populate('retailerId', 'businessName ownerName phone')
      .populate('distributorId', 'companyName ownerName phone')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ProductBill.countDocuments(filter);

    // Calculate summary
    const summary = await ProductBill.getSummary(
      role === 'retailer' ? userId : partnerId,
      role === 'distributor' ? userId : partnerId
    );

    res.json({
      success: true,
      data: {
        bills: bills.map(bill => ({
          id: bill._id,
          product: bill.productId,
          retailer: bill.retailerId,
          distributor: bill.distributorId,
          sku: bill.sku,
          totalQuantitySold: bill.totalQuantitySold,
          totalQuantityReturned: bill.totalQuantityReturned,
          netQuantity: bill.netQuantity,
          totalAmountDue: bill.totalAmountDue,
          totalAmountPaid: bill.totalAmountPaid,
          outstandingBalance: bill.outstandingBalance,
          currentUnitPrice: bill.currentUnitPrice,
          lastTransactionDate: bill.lastTransactionDate,
          aging: bill.getAging(),
          transactionCount: bill.transactions.length
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        summary
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

    const filter = { _id: billId };
    if (role === 'retailer') {
      filter.retailerId = userId;
    } else if (role === 'distributor') {
      filter.distributorId = userId;
    }

    const bill = await ProductBill.findOne(filter)
      .populate('productId', 'name category icon description')
      .populate('retailerId', 'businessName ownerName phone email address')
      .populate('distributorId', 'companyName ownerName phone email address')
      .populate('transactions.createdBy', 'ownerName businessName');

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    // Get product variant details if variantId exists
    let variantDetails = null;
    if (bill.variantId) {
      const product = await Product.findById(bill.productId);
      if (product) {
        variantDetails = product.variants.id(bill.variantId);
      }
    }

    res.json({
      success: true,
      data: {
        ...bill.toObject(),
        variantDetails,
        outstandingBalance: bill.outstandingBalance,
        netQuantity: bill.netQuantity,
        aging: bill.getAging(),
        transactions: bill.transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
      }
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
    let bill = await ProductBill.findOneAndUpdate(
      { retailerId, distributorId, productId, variantId: variantId || null },
      { 
        $setOnInsert: { 
          retailerId, 
          distributorId, 
          productId, 
          variantId: variantId || null,
          sku,
          currentUnitPrice: unitPrice
        }
      },
      { upsert: true, new: true }
    );

    // Add sale transaction
    bill.addTransaction({
      type: 'sale',
      quantity,
      unitPrice,
      amount,
      orderId,
      note,
      createdBy: req.user.id,
      createdByModel: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
    });

    await bill.save();

    res.json({
      success: true,
      message: 'Sale recorded successfully',
      data: {
        billId: bill._id,
        transactionId: bill.transactions[bill.transactions.length - 1]._id,
        newOutstandingBalance: bill.outstandingBalance
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

    const bill = await ProductBill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    // Check if payment exceeds outstanding balance
    if (amount > bill.outstandingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${amount}) exceeds outstanding balance (${bill.outstandingBalance})`
      });
    }

    // Add payment transaction
    bill.addTransaction({
      type: 'payment',
      amount,
      paymentMethod,
      referenceNumber,
      note,
      createdBy: userId,
      createdByModel: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
    });

    await bill.save();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        billId: bill._id,
        transactionId: bill.transactions[bill.transactions.length - 1]._id,
        newOutstandingBalance: bill.outstandingBalance,
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

    const bill = await ProductBill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    // Use current unit price if not provided
    const returnUnitPrice = unitPrice || bill.currentUnitPrice;
    const amount = quantity * returnUnitPrice;

    // Check if return quantity exceeds sold quantity
    if (quantity > bill.netQuantity) {
      return res.status(400).json({
        success: false,
        message: `Return quantity (${quantity}) exceeds net sold quantity (${bill.netQuantity})`
      });
    }

    // Add return transaction
    bill.addTransaction({
      type: 'return',
      quantity,
      unitPrice: returnUnitPrice,
      amount,
      note: `${reason}: ${note}`,
      createdBy: userId,
      createdByModel: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
    });

    await bill.save();

    res.json({
      success: true,
      message: 'Return recorded successfully',
      data: {
        billId: bill._id,
        transactionId: bill.transactions[bill.transactions.length - 1]._id,
        newOutstandingBalance: bill.outstandingBalance,
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

    const bill = await ProductBill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Product bill not found'
      });
    }

    // Add adjustment transaction
    bill.addTransaction({
      type: 'adjustment',
      amount,
      note: `${reason}: ${note}`,
      createdBy: userId,
      createdByModel: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
    });

    await bill.save();

    res.json({
      success: true,
      message: 'Adjustment recorded successfully',
      data: {
        billId: bill._id,
        transactionId: bill.transactions[bill.transactions.length - 1]._id,
        newOutstandingBalance: bill.outstandingBalance,
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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const results = [];

      for (const allocation of allocations) {
        const { billId, amount } = allocation;

        const bill = await ProductBill.findById(billId).session(session);
        if (!bill) {
          throw new Error(`Product bill ${billId} not found`);
        }

        if (amount > bill.outstandingBalance) {
          throw new Error(`Allocation amount (${amount}) exceeds outstanding balance (${bill.outstandingBalance}) for product ${bill.sku}`);
        }

        bill.addTransaction({
          type: 'payment',
          amount,
          paymentMethod,
          referenceNumber,
          note: `Bulk payment allocation: ${note}`,
          createdBy: userId,
          createdByModel: req.user.role === 'retailer' ? 'Retailer' : 'Distributor'
        });

        await bill.save({ session });

        results.push({
          billId: bill._id,
          sku: bill.sku,
          allocatedAmount: amount,
          newOutstandingBalance: bill.outstandingBalance
        });
      }

      await session.commitTransaction();

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
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Error allocating payment:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET OUTSTANDING BALANCES SUMMARY
export const getOutstandingBalances = async (req, res) => {
  try {
    const { role } = req.user;
    const userId = req.user.id;
    const { partnerId } = req.query;

    let filter = { status: 'active' };
    
    if (role === 'retailer') {
      filter.retailerId = userId;
      if (partnerId) filter.distributorId = partnerId;
    } else if (role === 'distributor') {
      filter.distributorId = userId;
      if (partnerId) filter.retailerId = partnerId;
    }

    // Add filter for outstanding balances
    filter.$expr = { $gt: [{ $subtract: ['$totalAmountDue', '$totalAmountPaid'] }, 0] };

    const bills = await ProductBill.find(filter)
      .populate('productId', 'name category icon')
      .populate('retailerId', 'businessName ownerName')
      .populate('distributorId', 'companyName ownerName')
      .sort({ lastTransactionDate: -1 });

    const outstandingBills = bills.map(bill => ({
      id: bill._id,
      product: bill.productId,
      retailer: bill.retailerId,
      distributor: bill.distributorId,
      sku: bill.sku,
      outstandingBalance: bill.outstandingBalance,
      aging: bill.getAging(),
      lastTransactionDate: bill.lastTransactionDate
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
      let bill = await ProductBill.findOneAndUpdate(
        { 
          retailerId, 
          distributorId, 
          productId, 
          variantId: variantId || null 
        },
        { 
          $setOnInsert: { 
            retailerId, 
            distributorId, 
            productId, 
            variantId: variantId || null,
            sku,
            currentUnitPrice: price
          }
        },
        { upsert: true, new: true }
      );

      // Add sale transaction
      bill.addTransaction({
        type: 'sale',
        quantity,
        unitPrice: price,
        amount,
        orderId,
        note: `Order ${orderId}`,
        createdBy: distributorId,
        createdByModel: 'Distributor'
      });

      await bill.save();

      results.push({
        billId: bill._id,
        sku,
        quantity,
        amount,
        newOutstandingBalance: bill.outstandingBalance
      });
    }

    return results;

  } catch (error) {
    console.error('Error processing order items:', error);
    throw error;
  }
};