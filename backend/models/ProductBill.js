// models/ProductBill.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['sale', 'payment', 'return', 'adjustment', 'price_change'],
    required: true
  },
  quantity: {
    type: Number,
    default: 0
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  amount: {
    type: Number,
    required: true
  },
  note: {
    type: String,
    default: ''
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'credit'],
    default: null
  },
  referenceNumber: {
    type: String,
    default: null
  },
  date: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByModel'
  },
  createdByModel: {
    type: String,
    enum: ['Retailer', 'Distributor'],
    required: true
  }
}, {
  timestamps: true
});

const productBillSchema = new mongoose.Schema({
  retailerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer',
    required: true
  },
  distributorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  sku: {
    type: String,
    required: true
  },
  
  // Cumulative fields
  totalQuantitySold: {
    type: Number,
    default: 0
  },
  totalQuantityReturned: {
    type: Number,
    default: 0
  },
  totalAmountDue: {
    type: Number,
    default: 0
  },
  totalAmountPaid: {
    type: Number,
    default: 0
  },
  
  // Current state
  currentUnitPrice: {
    type: Number,
    default: 0
  },
  lastTransactionDate: {
    type: Date,
    default: Date.now
  },
  
  // Transaction history
  transactions: [transactionSchema],
  
  // Credit terms
  creditLimit: {
    type: Number,
    default: 0
  },
  creditDays: {
    type: Number,
    default: 30
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'disputed'],
    default: 'active'
  },
  
  // Metadata
  metadata: {
    lastPriceUpdate: Date,
    priceHistory: [{
      price: Number,
      date: Date,
      reason: String
    }],
    notes: String
  }
}, {
  timestamps: true
});

// Indexes for performance
productBillSchema.index({ retailerId: 1, distributorId: 1, productId: 1, variantId: 1 }, { unique: true });
productBillSchema.index({ retailerId: 1, distributorId: 1 });
productBillSchema.index({ distributorId: 1, status: 1 });
productBillSchema.index({ 'transactions.date': -1 });
productBillSchema.index({ lastTransactionDate: -1 });

// Virtual for outstanding balance
productBillSchema.virtual('outstandingBalance').get(function() {
  return this.totalAmountDue - this.totalAmountPaid;
});

// Virtual for net quantity (sold - returned)
productBillSchema.virtual('netQuantity').get(function() {
  return this.totalQuantitySold - this.totalQuantityReturned;
});

// Method to add a transaction
productBillSchema.methods.addTransaction = function(transactionData) {
  const transaction = {
    ...transactionData,
    date: transactionData.date || new Date()
  };
  
  this.transactions.push(transaction);
  this.lastTransactionDate = transaction.date;
  
  // Update cumulative fields based on transaction type
  switch (transaction.type) {
    case 'sale':
      this.totalQuantitySold += transaction.quantity;
      this.totalAmountDue += transaction.amount;
      this.currentUnitPrice = transaction.unitPrice;
      break;
      
    case 'payment':
      this.totalAmountPaid += transaction.amount;
      break;
      
    case 'return':
      this.totalQuantityReturned += Math.abs(transaction.quantity);
      this.totalAmountDue -= Math.abs(transaction.amount);
      break;
      
    case 'adjustment':
      if (transaction.amount > 0) {
        this.totalAmountDue += transaction.amount;
      } else {
        this.totalAmountPaid += Math.abs(transaction.amount);
      }
      break;
      
    case 'price_change':
      this.currentUnitPrice = transaction.unitPrice;
      this.metadata.lastPriceUpdate = transaction.date;
      this.metadata.priceHistory.push({
        price: transaction.unitPrice,
        date: transaction.date,
        reason: transaction.note
      });
      break;
  }
  
  return this;
};

// Method to calculate aging
productBillSchema.methods.getAging = function() {
  const outstandingBalance = this.outstandingBalance;
  if (outstandingBalance <= 0) return { current: 0, overdue: 0, days: 0 };
  
  const daysDiff = Math.floor((new Date() - this.lastTransactionDate) / (1000 * 60 * 60 * 24));
  const isOverdue = daysDiff > this.creditDays;
  
  return {
    current: isOverdue ? 0 : outstandingBalance,
    overdue: isOverdue ? outstandingBalance : 0,
    days: daysDiff
  };
};

// Static method to get summary for retailer-distributor pair
productBillSchema.statics.getSummary = async function(retailerId, distributorId) {
  const pipeline = [
    {
      $match: {
        retailerId: new mongoose.Types.ObjectId(retailerId),
        distributorId: new mongoose.Types.ObjectId(distributorId),
        status: 'active'
      }
    },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalQuantitySold: { $sum: '$totalQuantitySold' },
        totalAmountDue: { $sum: '$totalAmountDue' },
        totalAmountPaid: { $sum: '$totalAmountPaid' },
        totalOutstanding: { $sum: { $subtract: ['$totalAmountDue', '$totalAmountPaid'] } }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalProducts: 0,
    totalQuantitySold: 0,
    totalAmountDue: 0,
    totalAmountPaid: 0,
    totalOutstanding: 0
  };
};

// Pre-save middleware to validate balances
productBillSchema.pre('save', function(next) {
  // Prevent overpayment
  if (this.totalAmountPaid > this.totalAmountDue) {
    return next(new Error('Payment amount cannot exceed due amount'));
  }
  
  // Ensure non-negative quantities
  if (this.totalQuantitySold < 0 || this.totalQuantityReturned < 0) {
    return next(new Error('Quantities cannot be negative'));
  }
  
  next();
});

export default mongoose.model('ProductBill', productBillSchema);