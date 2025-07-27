import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Clock, CheckCircle, AlertCircle, Eye, Package, ArrowRight, X } from 'lucide-react';
import API from '../../api';
// Optimized mock data generator
const generateMockData = () => {
  // Product categories with realistic pricing
  const productCategories = {
    electronics: {
      name: "Electronics",
      products: [
        { name: "Samsung TV 55\"", sku: "SAM-TV-55-001", basePrice: 45000, margin: 0.15 },
        { name: "iPhone 15", sku: "APL-IP15-128-001", basePrice: 79900, margin: 0.12 },
        { name: "MacBook Air", sku: "APL-MBA-M2-001", basePrice: 115000, margin: 0.08 },
        { name: "Sony Headphones", sku: "SON-WH-1000XM5", basePrice: 29900, margin: 0.20 }
      ]
    },
    fashion: {
      name: "Fashion",
      products: [
        { name: "Nike Air Max", sku: "NIKE-AM-270-001", basePrice: 8500, margin: 0.35 },
        { name: "Adidas Ultraboost", sku: "ADI-UB-22-001", basePrice: 12000, margin: 0.30 },
        { name: "Levi's Jeans", sku: "LEV-501-001", basePrice: 4500, margin: 0.45 },
        { name: "Tommy Hilfiger Shirt", sku: "TH-SH-001", basePrice: 3200, margin: 0.40 }
      ]
    },
    appliances: {
      name: "Home Appliances",
      products: [
        { name: "LG Refrigerator", sku: "LG-REF-435L", basePrice: 55000, margin: 0.18 },
        { name: "Samsung Washing Machine", sku: "SAM-WM-7KG", basePrice: 35000, margin: 0.22 },
        { name: "Panasonic Microwave", sku: "PAN-MW-25L", basePrice: 12500, margin: 0.25 }
      ]
    }
  };

  // Generate realistic distributors
  const distributors = [
    {
      id: 1,
      name: "Apex Consumer Goods",
      code: "ACG",
      category: "Electronics & Appliances",
      region: "North Delhi",
      establishedYear: 2018,
      creditLimit: 500000,
      paymentTerms: 7, // days
      lastPaymentDate: "2025-07-18",
      category_key: "electronics"
    },
    {
      id: 2,
      name: "Metro Fashion Hub",  
      code: "MFH",
      category: "Fashion & Lifestyle",
      region: "South Mumbai",
      establishedYear: 2020,
      creditLimit: 300000,
      paymentTerms: 7,
      lastPaymentDate: "2025-07-15",
      category_key: "fashion"
    },
    {
      id: 3,
      name: "Urban Appliances Ltd",
      code: "UAL", 
      category: "Home Appliances",
      region: "Bangalore Central",
      establishedYear: 2019,
      creditLimit: 400000,
      paymentTerms: 7,
      lastPaymentDate: "2025-07-20",
      category_key: "appliances"
    },
    {
      id: 4,
      name: "Tech Valley Distributors",
      code: "TVD",
      category: "Electronics",
      region: "Pune Tech Park",
      establishedYear: 2017,
      creditLimit: 600000,
      paymentTerms: 7,
      lastPaymentDate: "2025-07-16",
      category_key: "electronics"
    }
  ];

  // Helper function to generate realistic transaction data
  const generateTransactionHistory = (product, daysBack = 30) => {
    const transactions = [];
    const today = new Date();
    
    for (let i = 0; i < daysBack; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Skip some days randomly (not every day has transactions)
      if (Math.random() > 0.7) continue;
      
      const quantity = Math.floor(Math.random() * 5) + 1;
      const unitPrice = product.basePrice + (Math.random() * 1000 - 500); // Price variation
      const amount = quantity * unitPrice;
      
      transactions.push({
        date: date.toISOString().split('T')[0],
        quantity,
        unitPrice,
        amount,
        type: Math.random() > 0.1 ? 'sale' : 'return'
      });
    }
    
    return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Generate product bills for each distributor
  const generateProductBills = (distributor) => {
    const categoryProducts = productCategories[distributor.category_key].products;
    const numProducts = Math.floor(Math.random() * 3) + 2; // 2-4 products per distributor
    
    return categoryProducts.slice(0, numProducts).map((product, index) => {
      const transactionHistory = generateTransactionHistory(product);
      const totalQuantitySold = transactionHistory.reduce((sum, t) => sum + (t.type === 'sale' ? t.quantity : -t.quantity), 0);
      const totalSalesAmount = transactionHistory.reduce((sum, t) => sum + (t.type === 'sale' ? t.amount : -t.amount), 0);
      
      // Calculate realistic outstanding based on payment cycle
      const daysSinceLastPayment = Math.floor((new Date() - new Date(distributor.lastPaymentDate)) / (1000 * 60 * 60 * 24));
      const outstandingRatio = Math.min(daysSinceLastPayment / distributor.paymentTerms, 1);
      const outstandingBalance = Math.floor(totalSalesAmount * outstandingRatio * (0.3 + Math.random() * 0.4));
      
      // Generate realistic inventory data
      const baseStock = Math.floor(Math.random() * 20) + 5;
      const stockConsumed = Math.floor(totalQuantitySold * 0.8);
      const currentStock = Math.max(1, baseStock - stockConsumed + Math.floor(Math.random() * 10));
      
      return {
        id: `PB${distributor.id}${index.toString().padStart(2, '0')}`,
        productId: `P${distributor.id}${index.toString().padStart(2, '0')}`,
        productName: product.name,
        sku: product.sku,
        category: productCategories[distributor.category_key].name,
        outstandingBalance,
        totalQuantitySold,
        totalAmountDue: totalSalesAmount,
        totalAmountPaid: totalSalesAmount - outstandingBalance,
        lastTransactionDate: transactionHistory[0]?.date || distributor.lastPaymentDate,
        currentUnitPrice: product.basePrice,
        marginPercentage: product.margin,
        inventory: {
          previousStock: baseStock,
          stockAfterLastSettlement: baseStock + Math.floor(Math.random() * 5),
          stockDeliveredSinceLastPayment: Math.floor(Math.random() * 15) + 5,
          currentStock,
          orderedStock: Math.floor(Math.random() * 10) + 2,
          reorderLevel: Math.floor(currentStock * 0.3),
          maxStock: currentStock + 20
        },
        transactionHistory,
        // Generate weekly/daily summaries
        dailyTransactions: transactionHistory.slice(0, 7),
        weeklyTransactions: (() => {
          const weeks = {};
          transactionHistory.forEach(t => {
            const date = new Date(t.date);
            const weekKey = `Week ${Math.ceil(date.getDate() / 7)}`;
            if (!weeks[weekKey]) {
              weeks[weekKey] = { week: weekKey, quantity: 0, amount: 0 };
            }
            weeks[weekKey].quantity += t.quantity;
            weeks[weekKey].amount += t.amount;
          });
          return Object.values(weeks).slice(0, 4);
        })(),
        // Performance metrics
        metrics: {
          averageDailySales: Math.floor(totalSalesAmount / 30),
          turnoverRate: totalQuantitySold / (currentStock + totalQuantitySold),
          profitMargin: product.margin,
          stockoutRisk: currentStock < (totalQuantitySold / 30) * 3 ? 'high' : 'low'
        }
      };
    });
  };

  // Generate complete distributor data with calculated fields
  return distributors.map(distributor => {
    const productBills = generateProductBills(distributor);
    
    // Calculate aggregated values from product bills
    const totalOutstanding = productBills.reduce((sum, pb) => sum + pb.outstandingBalance, 0);
    const todaysSales = productBills.reduce((sum, pb) => {
      const todayTransactions = pb.transactionHistory.filter(t => {
        const today = new Date().toISOString().split('T')[0];
        return t.date === today && t.type === 'sale';
      });
      return sum + todayTransactions.reduce((tSum, t) => tSum + t.amount, 0);
    }, 0);
    
    const weeklySales = productBills.reduce((sum, pb) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekTransactions = pb.transactionHistory.filter(t => {
        return new Date(t.date) >= weekAgo && t.type === 'sale';
      });
      return sum + weekTransactions.reduce((tSum, t) => tSum + t.amount, 0);
    }, 0);

    const todaysProfit = todaysSales * 0.15; // Average 15% profit margin
    const weeklyProfit = weeklySales * 0.15;
    
    // Calculate payables (sales minus outstanding)
    const todaysPayable = Math.max(0, todaysSales - (totalOutstanding * 0.1));
    const weeklyPayable = Math.max(0, weeklySales - (totalOutstanding * 0.3));
    
    // Determine payment status
    const daysSinceLastPayment = Math.floor((new Date() - new Date(distributor.lastPaymentDate)) / (1000 * 60 * 60 * 24));
    const paymentStatus = daysSinceLastPayment >= distributor.paymentTerms ? 'overdue' : 
                         daysSinceLastPayment >= (distributor.paymentTerms - 2) ? 'pending' : 'current';
    
    // Calculate next payment due date
    const nextPaymentDue = new Date(distributor.lastPaymentDate);
    nextPaymentDue.setDate(nextPaymentDue.getDate() + distributor.paymentTerms);

    return {
      ...distributor,
      paymentStatus,
      totalOutstanding,
      todaysSales,
      todaysProfit,
      weeklySales,
      weeklyProfit,
      todaysPayable,
      weeklyPayable,
      nextPaymentDue: nextPaymentDue.toISOString().split('T')[0],
      productBills,
      // Additional metrics
      metrics: {
        creditUtilization: (totalOutstanding / distributor.creditLimit) * 100,
        avgOrderValue: weeklySales / Math.max(1, productBills.reduce((sum, pb) => sum + pb.weeklyTransactions.length, 0)),
        paymentReliability: Math.max(0, 100 - (daysSinceLastPayment - distributor.paymentTerms) * 10),
        profitMargin: (weeklyProfit / Math.max(1, weeklySales)) * 100
      }
    };
  });
};

const RetailerPayment = () => {
  const [selectedDistributors, setSelectedDistributors] = useState(new Set());
  const [expandedDistributors, setExpandedDistributors] = useState(new Set());
  const [distributors, setDistributors] = useState([]);
  const [productBills, setProductBills] = useState([]);
  const [expandedBills, setExpandedBills] = useState(new Set());
  const [distributorPaymentTypes, setDistributorPaymentTypes] = useState({});
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProductBill, setSelectedProductBill] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState({
    totalOutstanding: 0,
    totalSales: 0,
    totalProfit: 0,
    netPayable: 0
  });

  

  const ProductBillModal = ({ productBill, onClose, distributors }) => {
    if (!productBill) return null;

    const { inventory } = productBill;
    
    // Get distributor data for payment timeline
    const distributor = distributors.find(d => 
      d.productBills.some(pb => pb.id === productBill.id)
    );

    const getDaysUntilPayment = () => {
      const nextPayment = new Date(distributor?.nextPaymentDue);
      const today = new Date();
      const diffTime = nextPayment - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0
      }).format(amount);
    };

    const daysUntilPayment = getDaysUntilPayment();

    // Stock flow data for visualization
    const totalPotentialStock = inventory.previousStock + inventory.stockAfterLastSettlement + 
                               inventory.stockDeliveredSinceLastPayment + inventory.orderedStock;

    // Calculate stock consumed/used
    const stockConsumed = (inventory.previousStock + inventory.stockAfterLastSettlement + 
                          inventory.stockDeliveredSinceLastPayment) - inventory.currentStock;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white w-full h-full overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8">
            <div className="flex justify-between items-start max-w-7xl mx-auto">
              <div>
                <h1 className="text-3xl font-light">{productBill.productName}</h1>
                <p className="text-slate-300 mt-1">SKU: {productBill.sku} • Category: {productBill.category}</p>
                <div className="flex items-center gap-6 mt-4">
                  <div className="bg-white/10 rounded-lg px-4 py-2">
                    <span className="text-slate-300 text-sm">Outstanding</span>
                    <div className="text-xl font-medium">{formatCurrency(productBill.outstandingBalance)}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg px-4 py-2">
                    <span className="text-slate-300 text-sm">Payment Due In</span>
                    <div className="text-xl font-medium">{daysUntilPayment} days</div>
                  </div>
                  <div className="bg-white/10 rounded-lg px-4 py-2">
                    <span className="text-slate-300 text-sm">Profit Margin</span>
                    <div className="text-xl font-medium">{(productBill.marginPercentage * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="max-w-7xl mx-auto p-8 space-y-12">
          
            {/* Stock Flow Visualization */}
            <section>
              <h2 className="text-2xl font-light text-slate-800 mb-8">Stock Flow Analysis</h2>
              
              {/* Stock Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-medium text-blue-800">Available Stock</h4>
                    <div className={`w-3 h-3 rounded-full ${inventory.currentStock > inventory.reorderLevel ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  </div>
                  <div className="text-3xl font-bold text-blue-900">{inventory.currentStock}</div>
                  <div className="text-sm text-blue-600 mt-1">Units ready to ship</div>
                  {inventory.currentStock <= inventory.reorderLevel && (
                    <div className="text-xs text-red-600 mt-2 font-medium">⚠️ Below reorder level</div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-medium text-green-800">Turnover Rate</h4>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="text-3xl font-bold text-green-900">
                    {(productBill.metrics.turnoverRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-600 mt-1">Inventory efficiency</div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-medium text-purple-800">Daily Sales Avg</h4>
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  </div>
                  <div className="text-3xl font-bold text-purple-900">{formatCurrency(productBill.metrics.averageDailySales)}</div>
                  <div className="text-sm text-purple-600 mt-1">30-day average</div>
                </div>

                <div className={`bg-gradient-to-br border rounded-xl p-6 ${
                  productBill.metrics.stockoutRisk === 'high' 
                    ? 'from-red-50 to-pink-100 border-red-200' 
                    : 'from-yellow-50 to-amber-100 border-yellow-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`text-lg font-medium ${productBill.metrics.stockoutRisk === 'high' ? 'text-red-800' : 'text-yellow-800'}`}>
                      Stockout Risk
                    </h4>
                    <div className={`w-3 h-3 rounded-full ${productBill.metrics.stockoutRisk === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                  </div>
                  <div className={`text-3xl font-bold ${productBill.metrics.stockoutRisk === 'high' ? 'text-red-900' : 'text-yellow-900'}`}>
                    {productBill.metrics.stockoutRisk.toUpperCase()}
                  </div>
                  <div className={`text-sm mt-1 ${productBill.metrics.stockoutRisk === 'high' ? 'text-red-600' : 'text-yellow-600'}`}>
                    Risk assessment
                  </div>
                </div>
              </div>

              {/* HP-style Stock Bar */}
              <div className="bg-slate-50 rounded-2xl p-8">
                <div className="space-y-8">
                  <div className="relative">
                    <h3 className="text-lg font-medium text-slate-700 mb-4">Stock Flow Visualization</h3>
                    
                    {/* HP-style bar container */}
                    <div className="relative bg-slate-300 rounded-full h-8 overflow-hidden shadow-inner">
                      <div className="flex h-full">
                        {/* Previous Stock segment */}
                        <div 
                          className="bg-slate-500 transition-all duration-1000 ease-out"
                          style={{ width: `${(inventory.previousStock / totalPotentialStock) * 100}%` }}
                        />
                        
                        {/* After-settlement stock segment */}
                        <div 
                          className="bg-blue-500 transition-all duration-1000 ease-out delay-300"
                          style={{ width: `${(inventory.stockAfterLastSettlement / totalPotentialStock) * 100}%` }}
                        />
                        
                        {/* Delivered stock segment */}
                        <div 
                          className="bg-green-500 transition-all duration-1000 ease-out delay-600"
                          style={{ width: `${(inventory.stockDeliveredSinceLastPayment / totalPotentialStock) * 100}%` }}
                        />
                        
                        {/* Ordered stock segment */}
                        <div 
                          className="bg-purple-400 transition-all duration-1000 ease-out delay-900"
                          style={{ width: `${(inventory.orderedStock / totalPotentialStock) * 100}%` }}
                        />
                      </div>
                      
                      {/* Stock level indicators */}
                      <div className="absolute inset-0 flex items-center px-4">
                        <span className="text-white text-sm font-bold drop-shadow-md">
                          Total Potential Stock: {totalPotentialStock} units
                        </span>
                      </div>
                    </div>
                    
                    {/* Current Stock Needle */}
                    <div className="relative mt-4">
                      <div 
                        className="absolute top-0 w-0.5 h-6 bg-red-600 shadow-lg transition-all duration-1000 ease-out delay-1200"
                        style={{ 
                          left: `${(inventory.currentStock / totalPotentialStock) * 100}%`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <div className="w-4 h-4 bg-red-600 rotate-45 border-2 border-white shadow-lg"></div>
                        </div>
                        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                          <span className="text-xs font-bold text-red-700 bg-white px-2 py-1 rounded shadow">
                            Current: {inventory.currentStock}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-slate-500 rounded"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-700">Previous Stock</div>
                        <div className="text-lg font-bold text-slate-800">{inventory.previousStock}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <div>
                        <div className="text-sm font-medium text-blue-700">After Settlement</div>
                        <div className="text-lg font-bold text-blue-800">+{inventory.stockAfterLastSettlement}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <div>
                        <div className="text-sm font-medium text-green-700">Stock Delivered</div>
                        <div className="text-lg font-bold text-green-800">+{inventory.stockDeliveredSinceLastPayment}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-purple-400 rounded"></div>
                      <div>
                        <div className="text-sm font-medium text-purple-700">Stock Ordered</div>
                        <div className="text-lg font-bold text-purple-800">+{inventory.orderedStock}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Payment Timeline */}
            <section>
              <h2 className="text-2xl font-light text-slate-800 mb-8">Payment Timeline</h2>
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl p-8">
                <div className="flex justify-between items-center mb-8">
                  <span className="text-slate-600">Payment cycle progress</span>
                  <span className="font-semibold text-slate-800">
                    Day {distributor.paymentTerms - daysUntilPayment} of {distributor.paymentTerms}
                  </span>
                </div>

                {/* Payment Timeline */}
                <div className="relative">
                  <div className="w-full h-0.5 bg-gray-300 absolute top-3"></div>
                  
                  <div className="flex justify-between">
                    {(() => {
                      const lastPaymentDate = new Date(distributor?.lastPaymentDate);
                      const nextPaymentDate = new Date(distributor?.nextPaymentDue);
                      const today = new Date();
                      
                      const timelineStart = new Date(lastPaymentDate);
                      timelineStart.setDate(timelineStart.getDate() - 2);
                      
                      const timelineEnd = new Date(nextPaymentDate);
                      timelineEnd.setDate(timelineEnd.getDate() + 2);
                      
                      const totalDays = Math.ceil((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24)) + 1;
                      const currentDayIndex = Math.ceil((today - timelineStart) / (1000 * 60 * 60 * 24));
                      const lastPaymentIndex = Math.ceil((lastPaymentDate - timelineStart) / (1000 * 60 * 60 * 24));
                      const nextPaymentIndex = Math.ceil((nextPaymentDate - timelineStart) / (1000 * 60 * 60 * 24));
                      
                      return Array.from({ length: totalDays }, (_, index) => {
                        const currentDate = new Date(timelineStart);
                        currentDate.setDate(currentDate.getDate() + index);
                        
                        const isToday = index === currentDayIndex;
                        const isLastPayment = index === lastPaymentIndex;
                        const isNextPayment = index === nextPaymentIndex;
                        const isInPaymentCycle = index >= lastPaymentIndex && index <= nextPaymentIndex;
                        const isPastInCycle = index >= lastPaymentIndex && index < currentDayIndex;
                        
                        return (
                          <div key={index} className="flex flex-col items-center relative" style={{ flex: '1' }}>
                            {(isLastPayment || isNextPayment) && !isToday ? (
                              <div className="w-1 h-9 bg-gray-600 relative z-10 -mt-2"></div>
                            ) : (
                              <div 
                                className={`rounded-full border-2 transition-all duration-500 relative z-10 ${
                                  isToday
                                    ? 'bg-amber-500 border-amber-600 w-5 h-5 shadow-lg' 
                                    : isPastInCycle
                                    ? 'bg-blue-500 border-blue-600 w-3 h-3'
                                    : isInPaymentCycle
                                    ? 'bg-indigo-300 border-indigo-400 w-3 h-3'
                                    : 'bg-gray-200 border-gray-300 w-2.5 h-2.5'
                                }`}
                              >
                                {isToday && (
                                  <div className="w-1.5 h-1.5 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                                )}
                              </div>
                            )}
                            
                            <span className={`text-xs mt-3 text-center leading-tight font-medium ${
                              isToday ? 'text-amber-700 font-bold' :
                              isLastPayment || isNextPayment ? 'text-emerald-700' :
                              isInPaymentCycle ? 'text-blue-700' : 'text-gray-500'
                            }`}>
                              {currentDate.getDate().toString().padStart(2, '0')}/
                              {(currentDate.getMonth() + 1).toString().padStart(2, '0')}
                            </span>
                            
                            {/* Special labels */}
                            {isLastPayment && (
                              <div className="absolute -bottom-10 text-xs text-emerald-700 font-semibold whitespace-nowrap bg-emerald-50 px-2 py-1 rounded">
                                Last Payment
                              </div>
                            )}
                            {isNextPayment && (
                              <div className="absolute -bottom-10 text-xs text-emerald-700 font-semibold whitespace-nowrap bg-emerald-50 px-2 py-1 rounded">
                                Payment Due
                              </div>
                            )}
                            {isToday && (
                              <div className="absolute -bottom-10 text-xs text-amber-700 font-bold whitespace-nowrap bg-amber-50 px-2 py-1 rounded shadow-sm">
                                Today
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-4 mt-20 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-gray-200 border border-gray-300 rounded-full"></div>
                      <span className="text-gray-600">Outside cycle</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 border border-blue-600 rounded-full"></div>
                      <span className="text-gray-600">Completed days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-indigo-300 border border-indigo-400 rounded-full"></div>
                      <span className="text-gray-600">Remaining days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-amber-500 border border-amber-600 rounded-full shadow-sm"></div>
                      <span className="text-gray-600 font-medium">Today</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Transaction Analytics */}
            <section>
              <h2 className="text-2xl font-light text-slate-800 mb-8">Transaction Analytics</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Transactions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-700">Recent Transactions</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {productBill.dailyTransactions.slice(0, 10).map((transaction, idx) => (
                      <div key={idx} className={`border rounded-xl p-4 transition-all hover:shadow-md ${
                        transaction.type === 'sale' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-lg ${transaction.type === 'sale' ? '💰' : '↩️'}`}></span>
                              <div className="font-medium text-slate-800">{transaction.date}</div>
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                              <span className="inline-flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${transaction.type === 'sale' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                {transaction.quantity} units {transaction.type === 'sale' ? 'sold' : 'returned'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-semibold ${transaction.type === 'sale' ? 'text-green-800' : 'text-red-800'}`}>
                              {formatCurrency(transaction.amount)}
                            </div>
                            <div className="text-sm text-slate-500">
                              {formatCurrency(transaction.unitPrice)}/unit
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance Metrics & Summary */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-slate-700 mb-4">Weekly Performance</h3>
                    <div className="space-y-3">
                      {productBill.weeklyTransactions.map((transaction, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-blue-50 to-blue-50/50 border border-blue-200 rounded-xl p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium text-blue-900">{transaction.week}</div>
                              <div className="text-sm text-blue-600 mt-1">{transaction.quantity} units</div>
                            </div>
                            <div className="text-lg font-semibold text-blue-900">{formatCurrency(transaction.amount)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="bg-slate-900 text-white rounded-xl p-6">
                    <h3 className="text-lg font-medium mb-4">Financial Overview</h3>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-light">{productBill.totalQuantitySold}</div>
                        <div className="text-slate-400 text-sm">Total Units</div>
                      </div>
                      <div>
                        <div className="text-2xl font-light">{formatCurrency(productBill.currentUnitPrice)}</div>
                        <div className="text-slate-400 text-sm">Unit Price</div>
                      </div>
                      <div>
                        <div className="text-2xl font-light">{formatCurrency(productBill.totalAmountDue)}</div>
                        <div className="text-slate-400 text-sm">Total Sales</div>
                      </div>
                      <div>
                        <div className="text-2xl font-light text-green-400">{(productBill.marginPercentage * 100).toFixed(1)}%</div>
                        <div className="text-slate-400 text-sm">Profit Margin</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Comprehensive Transaction Statement */}
            <section>
              <h2 className="text-2xl font-light text-slate-800 mb-8">Complete Transaction Statement</h2>
              
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Statement Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-light">Product Statement</h3>
                      <p className="text-slate-300 text-sm mt-1">{productBill.productName} - {productBill.sku}</p>
                      <p className="text-slate-300 text-xs mt-1">Distributor: {distributor.name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-300">Outstanding Balance</div>
                      <div className="text-2xl font-bold text-red-300">{formatCurrency(productBill.outstandingBalance)}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Payment Terms: {distributor.paymentTerms} days
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transaction Table */}
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-xs text-slate-600 font-medium">
                        <th className="text-left p-3 w-20">Date</th>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Description</th>
                        <th className="text-right p-3 w-20">Qty</th>
                        <th className="text-right p-3 w-28">Unit Price</th>
                        <th className="text-right p-3 w-28">Amount</th>
                        <th className="text-right p-3 w-32">Running Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let runningTotal = 0;
                        return productBill.transactionHistory.map((transaction, idx) => {
                          const transactionAmount = transaction.type === 'sale' ? transaction.amount : -transaction.amount;
                          runningTotal += transactionAmount;
                          
                          const getRowStyle = (type) => {
                            return type === 'sale' 
                              ? 'bg-green-50 hover:bg-green-100 border-l-4 border-green-400'
                              : 'bg-red-50 hover:bg-red-100 border-l-4 border-red-400';
                          };

                          return (
                            <tr key={idx} className={`transition-colors ${getRowStyle(transaction.type)}`}>
                              <td className="p-3 text-sm font-mono text-slate-600">
                                {new Date(transaction.date).toLocaleDateString('en-GB', { 
                                  day: '2-digit', 
                                  month: '2-digit' 
                                })}
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.type === 'sale' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.type === 'sale' ? '📈 Sale' : '📉 Return'}
                                </span>
                              </td>
                              <td className="p-3 text-sm text-slate-700">
                                {transaction.type === 'sale' ? 'Product Sale' : 'Product Return'}
                              </td>
                              <td className="p-3 text-right text-sm font-medium text-slate-600">
                                {transaction.quantity}
                              </td>
                              <td className="p-3 text-right text-sm font-mono text-slate-600">
                                {formatCurrency(transaction.unitPrice)}
                              </td>
                              <td className={`p-3 text-right text-sm font-mono font-semibold ${
                                transaction.type === 'sale' ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {transaction.type === 'sale' ? '+' : '-'}{formatCurrency(transaction.amount)}
                              </td>
                              <td className={`p-3 text-right text-sm font-mono font-bold ${
                                runningTotal >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(Math.abs(runningTotal))}
                                <span className="text-xs ml-1">
                                  {runningTotal >= 0 ? 'CR' : 'DR'}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Statement Footer */}
                <div className="bg-slate-50 border-t p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-slate-600">Total Sales</div>
                      <div className="text-lg font-bold text-green-700">
                        {formatCurrency(productBill.totalAmountDue)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-slate-600">Amount Paid</div>
                      <div className="text-lg font-bold text-blue-700">
                        {formatCurrency(productBill.totalAmountPaid)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-slate-600">Outstanding</div>
                      <div className="text-lg font-bold text-red-700">
                        {formatCurrency(productBill.outstandingBalance)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  const toggleDistributorPaymentType = (distributorId, paymentType) => {
    const current = distributorPaymentTypes[distributorId];
    
    if (current === paymentType) {
      setDistributorPaymentTypes(prev => {
        const newTypes = { ...prev };
        delete newTypes[distributorId];
        return newTypes;
      });
      
      setSelectedDistributors(prev => {
        const newSelected = new Set(prev);
        newSelected.delete(distributorId);
        return newSelected;
      });
    } else {
      setDistributorPaymentTypes(prev => ({
        ...prev,
        [distributorId]: paymentType
      }));
      
      setSelectedDistributors(prev => {
        const newSelected = new Set(prev);
        newSelected.add(distributorId);
        return newSelected;
      });
    }
  };

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedDistributors);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedDistributors(newExpanded);
  };

  const openProductModal = (productBill) => {
    setSelectedProductBill(productBill);
    setShowProductModal(true);
  };
   useEffect(() => {
    // Fetch distributors
    API.get("/distributors")
      .then(res => setDistributors(res.data))
      .catch(err => console.error(err));

    // Fetch product bills for retailer
    API.get("/product-bills?role=retailer")
      .then(res => setProductBills(res.data.data.bills))
      .catch(err => console.error(err));
  }, []);

  // Calculate payment summary
  useEffect(() => {
    let totalOutstanding = 0;
    let totalSales = 0;
    let totalProfit = 0;
    let netPayable = 0;

    selectedDistributors.forEach(id => {
      const dist = distributors.find(d => d.id === id);
      const paymentType = distributorPaymentTypes[id];
      if (dist && paymentType) {
        totalOutstanding += dist.totalOutstanding;
        if (paymentType === 'today') {
          totalSales += dist.todaysSales;
          totalProfit += dist.todaysProfit;
          netPayable += dist.todaysPayable;
        } else {
          totalSales += dist.weeklySales;
          totalProfit += dist.weeklyProfit;
          netPayable += dist.weeklyPayable;
        }
      }
    });

    setPaymentSummary({
      totalOutstanding,
      totalSales,
      totalProfit,
      netPayable
    });
  }, [selectedDistributors, distributors, distributorPaymentTypes]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'overdue': return 'bg-red-100 text-red-700 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'current': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const sortedDistributors = [...distributors].sort((a, b) => {
    // Sort by payment status priority, then by outstanding amount
    const statusPriority = { 'overdue': 3, 'pending': 2, 'current': 1 };
    const aPriority = statusPriority[a.paymentStatus] || 0;
    const bPriority = statusPriority[b.paymentStatus] || 0;
    
    if (aPriority !== bPriority) return bPriority - aPriority;
    return b.totalOutstanding - a.totalOutstanding;
  });

  // Calculate overall metrics
  const totalTodaysSales = distributors.reduce((sum, d) => sum + d.todaysSales, 0);
  const totalWeeklySales = distributors.reduce((sum, d) => sum + d.weeklySales, 0);
  const totalTodaysProfit = distributors.reduce((sum, d) => sum + d.todaysProfit, 0);
  const totalWeeklyProfit = distributors.reduce((sum, d) => sum + d.weeklyProfit, 0);
  const totalOutstanding = distributors.reduce((sum, d) => sum + d.totalOutstanding, 0);

  // Group product bills by distributor
  const billsByDistributor = distributors.map(dist => ({
    ...dist,
    productBills: productBills.filter(pb => pb.distributor._id === dist._id)
  }));

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Payment Settlement Hub</h1>
              <p className="text-blue-300 text-lg">Manage distributor payments and track product-wise performance</p>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="text-blue-200">
                    {distributors.filter(d => d.paymentStatus === 'overdue').length} Overdue
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <span className="text-blue-200">
                    {distributors.filter(d => d.paymentStatus === 'pending').length} Pending
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-blue-200">
                    {distributors.filter(d => d.paymentStatus === 'current').length} Current
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-blue-800/50 backdrop-blur-sm hidden md:block rounded-xl p-6 border border-blue-700/30">
              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(totalTodaysSales)}</div>
                  <div className="text-blue-300 text-sm">Today's Sales</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(totalWeeklySales)}</div>
                  <div className="text-blue-300 text-sm">Weekly Sales</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-300">{formatCurrency(totalTodaysProfit)}</div>
                  <div className="text-blue-300 text-xs">Today's Profit</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-300">{formatCurrency(totalOutstanding)}</div>
                  <div className="text-blue-300 text-xs">Total Outstanding</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enhanced Distributors List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-blue-900">Distributors ({distributors.length})</h2>
              <div className="text-sm text-blue-600">
                Sorted by payment priority
              </div>
            </div>

            {sortedDistributors.map((distributor) => (
              <div
                key={distributor.id}
                className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-300 ${
                  selectedDistributors.has(distributor.id)
                    ? 'border-blue-600 shadow-lg ring-2 ring-blue-100'
                    : 'border-blue-200 hover:border-blue-300'
                }`}
              >
                {/* Enhanced Distributor Header */}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                        {distributor.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-blue-900">{distributor.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(distributor.paymentStatus)}`}>
                            {distributor.paymentStatus.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-blue-600">{distributor.category} • {distributor.region}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-blue-600">
                          <span>Today: {formatCurrency(distributor.todaysSales)}</span>
                          <span>Weekly: {formatCurrency(distributor.weeklySales)}</span>
                          <span className="text-xs text-slate-500">
                            Credit: {(distributor.metrics.creditUtilization).toFixed(1)}% used
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-2">
                      <div className="text-xs text-blue-600">
                        Next Due: {distributor.nextPaymentDue}
                      </div>
                      <div className="text-xs text-slate-500">
                        Reliability: {distributor.metrics.paymentReliability.toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Payment Options */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div 
                        className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg transition-all ${
                          distributorPaymentTypes[distributor.id] === 'today' 
                            ? 'bg-blue-100 border-2 border-blue-400' 
                            : 'hover:bg-blue-50 border-2 border-transparent'
                        }`}
                        onClick={() => toggleDistributorPaymentType(distributor.id, 'today')}
                      >
                        <input
                          type="radio"
                          name={`payment-type-${distributor.id}`}
                          value="today"
                          checked={distributorPaymentTypes[distributor.id] === 'today'}
                          onChange={() => {}}
                          className="text-blue-900 pointer-events-none"
                        />
                        <div>
                          <div className="font-medium text-blue-900">Today's Payable</div>
                          <div className="text-lg font-bold text-blue-900">{formatCurrency(distributor.todaysPayable)}</div>
                          <div className="text-xs text-blue-600">Profit: {formatCurrency(distributor.todaysProfit)}</div>
                        </div>
                      </div>
                      
                      <div 
                        className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg transition-all ${
                          distributorPaymentTypes[distributor.id] === 'weekly' 
                            ? 'bg-blue-100 border-2 border-blue-400' 
                            : 'hover:bg-blue-50 border-2 border-transparent'
                        }`}
                        onClick={() => toggleDistributorPaymentType(distributor.id, 'weekly')}
                      >
                        <input
                          type="radio"
                          name={`payment-type-${distributor.id}`}
                          value="weekly"
                          checked={distributorPaymentTypes[distributor.id] === 'weekly'}
                          onChange={() => {}}
                          className="text-blue-900 pointer-events-none"
                        />
                        <div>
                          <div className="font-medium text-blue-900">Weekly Payable</div>
                          <div className="text-lg font-bold text-blue-900">{formatCurrency(distributor.weeklyPayable)}</div>
                          <div className="text-xs text-blue-600">Profit: {formatCurrency(distributor.weeklyProfit)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Product Bills Section */}
                  <button
                    onClick={() => toggleExpanded(distributor.id)}
                    className="w-full flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 rounded-lg p-4 transition-all border border-blue-200"
                  >
                    <div className="flex items-center space-x-3">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-700">
                        View Product Portfolio ({distributor.productBills.length} products)
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-sm text-blue-600">Outstanding Amount</div>
                        <div className="font-bold text-blue-900">{formatCurrency(distributor.totalOutstanding)}</div>
                      </div>
                      {expandedDistributors.has(distributor.id) ? 
                        <ChevronUp className="w-5 h-5 text-blue-600" /> : 
                        <ChevronDown className="w-5 h-5 text-blue-600" />
                      }
                    </div>
                  </button>
                </div>

                {/* Enhanced Product Bills Details */}
                {expandedDistributors.has(distributor.id) && (
                  <div className="border-t border-blue-200 p-6 bg-gradient-to-r from-blue-50 to-slate-50">
                    <div className="space-y-4">
                      {distributor.productBills.map((productBill) => (
                        <div key={productBill.id} className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <h4 className="font-bold text-blue-900">{productBill.productName}</h4>
                                  <p className="text-sm text-blue-600">SKU: {productBill.sku}</p>
                                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full mt-1">
                                    {productBill.category}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-blue-900">{formatCurrency(productBill.outstandingBalance)}</div>
                                  <div className="text-sm text-blue-600">Outstanding</div>
                                  {productBill.metrics.stockoutRisk === 'high' && (
                                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full mt-1">
                                      ⚠️ Low Stock
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                                <div>
                                  <div className="text-blue-600">Total Sold</div>
                                  <div className="font-medium">{productBill.totalQuantitySold} units</div>
                                </div>
                                <div>
                                  <div className="text-blue-600">Sales Value</div>
                                  <div className="font-medium">{formatCurrency(productBill.totalAmountDue)}</div>
                                </div>
                                <div>
                                  <div className="text-blue-600">Current Stock</div>
                                  <div className="font-medium">{productBill.inventory.currentStock} units</div>
                                </div>
                                <div>
                                  <div className="text-blue-600">Margin</div>
                                  <div className="font-medium text-green-600">{(productBill.marginPercentage * 100).toFixed(1)}%</div>
                                </div>
                              </div>
                              
                              {/* Performance Indicators */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3 text-xs">
                                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                                    productBill.metrics.turnoverRate > 0.6 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    <div className={`w-2 h-2 rounded-full ${
                                      productBill.metrics.turnoverRate > 0.6 ? 'bg-green-500' : 'bg-yellow-500'
                                    }`}></div>
                                    Turnover: {(productBill.metrics.turnoverRate * 100).toFixed(0)}%
                                  </div>
                                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    Avg Daily: {formatCurrency(productBill.metrics.averageDailySales)}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500">
                                  Last Transaction: {productBill.lastTransactionDate}
                                </div>
                              </div>
                              
                              <button
                                onClick={() => openProductModal(productBill)}
                                className="w-full bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 text-blue-700 py-2 px-4 rounded-lg transition-all text-sm font-medium border border-blue-200 hover:border-blue-300"
                              >
                                📊 View Complete Analytics & Stock Flow
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Distributor Summary */}
                      <div className="mt-4 p-4 bg-gradient-to-r from-slate-100 to-blue-100 rounded-lg border border-slate-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                          <div>
                            <div className="font-bold text-slate-700">{distributor.productBills.length}</div>
                            <div className="text-slate-500">Products</div>
                          </div>
                          <div>
                            <div className="font-bold text-green-700">{formatCurrency(distributor.weeklySales)}</div>
                            <div className="text-slate-500">Weekly Sales</div>
                          </div>
                          <div>
                            <div className="font-bold text-blue-700">{distributor.metrics.creditUtilization.toFixed(1)}%</div>
                            <div className="text-slate-500">Credit Used</div>
                          </div>
                          <div>
                            <div className="font-bold text-purple-700">{distributor.metrics.paymentReliability.toFixed(0)}%</div>
                            <div className="text-slate-500">Reliability</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Enhanced Payment Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border-2 border-blue-200 p-6 sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-blue-900">Payment Summary</h3>
                {selectedDistributors.size > 0 && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm font-medium">
                    {selectedDistributors.size} selected
                  </span>
                )}
              </div>
              
              {selectedDistributors.size === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-blue-300 mx-auto mb-4" />
                  <p className="text-blue-600 mb-2">Select distributors to see payment summary</p>
                  <p className="text-sm text-slate-500">Choose payment type for each distributor</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Outstanding Alert */}
                  {paymentSummary.totalOutstanding > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-700">Outstanding Balance</span>
                      </div>
                      <div className="text-2xl font-bold text-red-600">{formatCurrency(paymentSummary.totalOutstanding)}</div>
                      <div className="text-xs text-red-600 mt-1">Requires immediate attention</div>
                    </div>
                  )}
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Total Sales</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(paymentSummary.totalSales)}</div>
                    <div className="text-xs text-green-600 mt-1">Revenue generated</div>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-700">Total Profit</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">{formatCurrency(paymentSummary.totalProfit)}</div>
                    <div className="text-xs text-yellow-600 mt-1">
                      Margin: {paymentSummary.totalSales > 0 ? ((paymentSummary.totalProfit / paymentSummary.totalSales) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-blue-300" />
                      <span className="text-sm font-medium text-blue-300">Net Payable</span>
                    </div>
                    <div className="text-3xl font-bold">{formatCurrency(paymentSummary.netPayable)}</div>
                    <div className="text-xs text-blue-300 mt-1">Amount to be settled</div>
                  </div>
                  
                  {/* Payment Breakdown */}
                  <div className="bg-slate-50 rounded-lg p-4 text-sm">
                    <h4 className="font-medium text-slate-700 mb-3">Payment Breakdown</h4>
                    <div className="space-y-2">
                      {Array.from(selectedDistributors).map(id => {
                        const dist = distributors.find(d => d.id === id);
                        const paymentType = distributorPaymentTypes[id];
                        if (!dist || !paymentType) return null;
                        
                        const amount = paymentType === 'today' ? dist.todaysPayable : dist.weeklyPayable;
                        return (
                          <div key={id} className="flex justify-between items-center">
                            <span className="text-slate-600">{dist.code}</span>
                            <div className="text-right">
                              <div className="font-medium text-slate-800">{formatCurrency(amount)}</div>
                              <div className="text-xs text-slate-500">{paymentType}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="pt-4 space-y-3">
                    <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 px-4 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl">
                      💳 Process Payment ({selectedDistributors.size} distributors)
                    </button>
                    <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-lg font-medium transition-colors text-sm">
                      📄 Generate Payment Report
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="mt-6 bg-white rounded-xl shadow-sm border-2 border-blue-200 p-6">
              <h3 className="text-lg font-bold text-blue-900 mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Distributors</span>
                  <span className="font-bold text-slate-800">{distributors.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Active Products</span>
                  <span className="font-bold text-slate-800">
                    {distributors.reduce((sum, d) => sum + d.productBills.length, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Avg Credit Usage</span>
                  <span className="font-bold text-slate-800">
                    {(distributors.reduce((sum, d) => sum + d.metrics.creditUtilization, 0) / distributors.length).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Outstanding</span>
                  <span className="font-bold text-red-600">{formatCurrency(totalOutstanding)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Bill Modal */}
      {showProductModal && (
        <ProductBillModal 
          productBill={selectedProductBill}
          distributors={distributors}
          onClose={() => {
            setShowProductModal(false);
            setSelectedProductBill(null);
          }}
        />
      )}
    </div>
  );
};

export default RetailerPayment;