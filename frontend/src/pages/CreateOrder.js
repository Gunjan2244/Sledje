import React, { useState, useEffect, useRef } from "react";
import { X, Mic, MicOff, ShoppingCart, Plus, Trash2, Edit3, Volume2, AlertCircle } from "lucide-react";

// Enhanced product database with more realistic data
const productDatabase = [
  { id: 1, item: "Apple iPhone 15", brand: "Apple", rate: 79900, category: "Electronics" },
  { id: 2, item: "Samsung Galaxy S24", brand: "Samsung", rate: 74999, category: "Electronics" },
  { id: 3, item: "Laptop Dell XPS", brand: "Dell", rate: 89999, category: "Electronics" },
  { id: 4, item: "Wireless Headphones", brand: "Sony", rate: 15999, category: "Electronics" },
  { id: 5, item: "Coffee Beans", brand: "Starbucks", rate: 899, category: "Food" },
  { id: 6, item: "Green Tea", brand: "Twinings", rate: 450, category: "Beverages" },
  { id: 7, item: "Protein Powder", brand: "Optimum", rate: 3500, category: "Health" },
  { id: 8, item: "Running Shoes", brand: "Nike", rate: 8999, category: "Sports" }
];

const knownUnits = ['kg', 'kilogram', 'g', 'gram', 'liters', 'liter', 'bottles', 'packets', 'pieces', 'dozen', 'box', 'boxes', 'l', 'ml', 'milliliter', 'cups', 'pints', 'quarts', 'ounces', 'units', 'pair', 'pairs'];

// Convert words to numbers manually since we don't have the library
function convertWordsToNumbers(text) {
  const wordNumbers = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20
  };
  
  let result = text;
  Object.keys(wordNumbers).forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, wordNumbers[word].toString());
  });
  
  return result;
}

// Utility functions from the first file
function detectUnit(itemStr) {
  if (typeof itemStr !== 'string') {
    console.warn('Expected string but got:', typeof itemStr, itemStr);
    return { unit: 'unit', item: 'unknown' };
  }
  const words = itemStr.trim().toLowerCase().split(/\s+/);

  // Check if first word is a unit
  if (knownUnits.includes(words[0])) {
    return {
      unit: words[0],
      item: words.slice(1).join(' ') || 'unknown'
    };
  }

  // Check unit at the end (e.g., "water bottles")
  const last = words[words.length - 1];
  if (knownUnits.includes(last)) {
    return {
      unit: last,
      item: words.slice(0, -1).join(' ') || 'unknown'
    };
  }

  return {
    unit: 'unit',
    item: itemStr.trim()
  };
}

function parseMultipleOrders(transcript) {
  if (typeof transcript !== 'string') {
    console.error('Invalid input: transcript must be a string');
    return [];
  }

  let normalized;
  try {
    transcript = transcript.replace(/[^a-zA-Z0-9\s.,]/g, ''); // Remove unwanted characters
    transcript = transcript.replace(/\s+/g, ' ').trim(); // Normalize spaces
    transcript = transcript.replace(/\bto\b/g, "two"); // Replace "to" with "two"
    normalized = convertWordsToNumbers(transcript); // Convert word numbers to digits
  } catch (error) {
    console.error('Error converting words to numbers:', error);
    normalized = transcript; // Fall back to original transcript if conversion fails
  }
  
  console.log("Normalized transcript:", normalized);
  
  const orders = [];
  // Number followed by a word or words that don't contain numbers
  const regex = /(\d+(?:\.\d+)?)\s+([a-zA-Z][a-zA-Z\s]*?)(?=\s+\d+|$)/g;
  
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const [, quantity, itemText] = match;
    const { unit, item } = detectUnit(itemText.trim());
    
    orders.push({
      item,
      quantity: parseFloat(quantity),
      unit
    });
    
    console.log(`Parsed: ${quantity} × ${itemText.trim()} (${unit})`);
  }
  
  return orders;
}

const parseOrderFromText = (text) => {
  return parseMultipleOrders(text);
};

const generateOrderId = () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  return `ORD${timestamp.toString().slice(-6)}${randomNum.toString().padStart(3, '0')}`;
};

const CreateOrder = ({ isOpen, onClose, onAddOrder }) => {
  // State management
  const [orderData, setOrderData] = useState({
    customerName: '',
    orderId: generateOrderId(),
    items: []
  });
  
  const [voiceInput, setVoiceInput] = useState({
    transcript: '',
    isListening: false,
    isSupported: false
  });
  
  const [manualItem, setManualItem] = useState({
    item: '',
    quantity: 1,
    unit: 'pieces',
    rate: 0
  });
  
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' or 'manual'
  
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  // Speech Recognition Setup
  const initializeSpeechRecognition = () => {
    if (typeof window === 'undefined') return null;
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setVoiceInput(prev => ({ ...prev, isListening: true }));
        setErrors(prev => ({ ...prev, voice: '' }));
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        // FIXED: Append to existing transcript instead of overwriting
        setVoiceInput(prev => ({
          ...prev,
          transcript: prev.transcript ? prev.transcript + ' ' + transcript : transcript
        }));
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setVoiceInput(prev => ({ ...prev, isListening: false }));
        
        const errorMessages = {
          'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
          'no-speech': 'No speech detected. Please try speaking clearly.',
          'network': 'Network error. Please check your connection.',
          'audio-capture': 'No microphone found. Please check your audio settings.'
        };
        
        setErrors(prev => ({ 
          ...prev, 
          voice: errorMessages[event.error] || 'Speech recognition error occurred.' 
        }));
      };
      
      recognition.onend = () => {
        setVoiceInput(prev => ({ ...prev, isListening: false }));
      };
      
      setVoiceInput(prev => ({ ...prev, isSupported: true }));
      return recognition;
    } else {
      setVoiceInput(prev => ({ ...prev, isSupported: false }));
      return null;
    }
  };

  // Effects
  useEffect(() => {
    if (isOpen) {
      recognitionRef.current = initializeSpeechRecognition();
      setOrderData(prev => ({ ...prev, orderId: generateOrderId() }));
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isOpen]);

  // Event handlers
  const startVoiceRecognition = () => {
    if (!recognitionRef.current) {
      setErrors(prev => ({ ...prev, voice: 'Speech recognition not supported in this browser.' }));
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      if (error.name === 'NotAllowedError') {
        setErrors(prev => ({ ...prev, voice: 'Please allow microphone access in your browser settings.' }));
      } else {
        setErrors(prev => ({ ...prev, voice: 'Could not start voice input. Please try again.' }));
      }
    }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVoiceInput(prev => ({ ...prev, isListening: false }));
  };

  const parseVoiceOrder = () => {
    const parsedItems = parseOrderFromText(voiceInput.transcript);
    
    if (parsedItems.length === 0) {
      setErrors(prev => ({ ...prev, parse: 'Could not parse any items from the transcript. Please try again.' }));
      return;
    }
    
    const mappedItems = parsedItems.map(parsedItem => {
      const matchingProduct = productDatabase.find(
        product => 
          product.item.toLowerCase().includes(parsedItem.item.toLowerCase()) ||
          parsedItem.item.toLowerCase().includes(product.item.toLowerCase().split(' ')[0])
      );
      
      return {
        id: Date.now() + Math.random(),
        item: matchingProduct ? matchingProduct.item : parsedItem.item,
        brand: matchingProduct ? matchingProduct.brand : "Unknown Brand",
        quantity: parsedItem.quantity || 1,
        rate: matchingProduct ? matchingProduct.rate : 100,
        unit: parsedItem.unit || "pieces"
      };
    });
    
    setOrderData(prev => ({ ...prev, items: [...prev.items, ...mappedItems] }));
    setVoiceInput(prev => ({ ...prev, transcript: '' }));
    setErrors(prev => ({ ...prev, parse: '' }));
  };

  const addManualItem = () => {
    if (!manualItem.item.trim()) {
      setErrors(prev => ({ ...prev, manual: 'Please enter an item name.' }));
      return;
    }
    
    if (manualItem.quantity <= 0) {
      setErrors(prev => ({ ...prev, manual: 'Quantity must be greater than 0.' }));
      return;
    }
    
    const matchingProduct = productDatabase.find(
      product => product.item.toLowerCase().includes(manualItem.item.toLowerCase())
    );
    
    const newItem = {
      id: Date.now() + Math.random(),
      item: manualItem.item,
      brand: matchingProduct ? matchingProduct.brand : "Custom Brand",
      quantity: manualItem.quantity,
      rate: manualItem.rate || (matchingProduct ? matchingProduct.rate : 100),
      unit: manualItem.unit
    };
    
    setOrderData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setManualItem({ item: '', quantity: 1, unit: 'pieces', rate: 0 });
    setErrors(prev => ({ ...prev, manual: '' }));
  };

  const removeItem = (itemId) => {
    setOrderData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const updateItemQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) return;
    
    setOrderData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    }));
  };

  const calculateTotal = () => {
    return orderData.items.reduce((total, item) => total + (item.quantity * item.rate), 0);
  };

  const handleSubmitOrder = () => {
    const newErrors = {};
    
    if (!orderData.customerName.trim()) {
      newErrors.customer = 'Customer name is required.';
    }
    
    if (orderData.items.length === 0) {
      newErrors.items = 'Please add at least one item to the order.';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onAddOrder({
      ...orderData,
      total: calculateTotal(),
      timestamp: new Date().toISOString()
    });
    
    // Reset form
    setOrderData({ customerName: '', orderId: generateOrderId(), items: [] });
    setVoiceInput({ transcript: '', isListening: false, isSupported: voiceInput.isSupported });
    setManualItem({ item: '', quantity: 1, unit: 'pieces', rate: 0 });
    setErrors({});
    setActiveTab('voice');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-800 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3">
            <ShoppingCart className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Create New Order</h2>
              <p className="text-blue-100">Add items using voice or manual input</p>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Customer Information */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.customer ? 'border-red-500' : 'border-gray-300'
                  }`}
                  value={orderData.customerName}
                  onChange={(e) => setOrderData(prev => ({ ...prev, customerName: e.target.value }))}
                />
                {errors.customer && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.customer}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order ID
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                  value={orderData.orderId}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Input Method Tabs */}
          <div className="mb-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('voice')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'voice'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Mic className="w-4 h-4 inline mr-2" />
                Voice Input
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'manual'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Edit3 className="w-4 h-4 inline mr-2" />
                Manual Entry
              </button>
            </div>
          </div>

          {/* Voice Input Tab */}
          {activeTab === 'voice' && (
            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Recognition
                </label>
                <textarea
                  ref={textareaRef}
                  placeholder="Transcript will appear here... Try saying: '2 bottles water, 5 pieces apple, 1 kg rice'"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={voiceInput.transcript}
                  onChange={(e) => setVoiceInput(prev => ({ ...prev, transcript: e.target.value }))}
                />
                
                <div className="flex justify-between items-center mt-4">
                  <div className="flex space-x-2">
                    {voiceInput.isSupported ? (
                      voiceInput.isListening ? (
                        <button
                          onClick={stopVoiceRecognition}
                          className="flex items-center bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <MicOff className="w-4 h-4 mr-2" />
                          Stop Recording
                        </button>
                      ) : (
                        <button
                          onClick={startVoiceRecognition}
                          className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <Mic className="w-4 h-4 mr-2" />
                          Start Recording
                        </button>
                      )
                    ) : (
                      <p className="text-gray-500 text-sm flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Voice recognition not supported
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={parseVoiceOrder}
                    disabled={!voiceInput.transcript.trim()}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Parse Order
                  </button>
                </div>
                
                {errors.voice && (
                  <p className="text-red-500 text-sm mt-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.voice}
                  </p>
                )}
                
                {errors.parse && (
                  <p className="text-red-500 text-sm mt-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.parse}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Manual Input Tab */}
          {activeTab === 'manual' && (
            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Item Manually
                </label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Item name"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={manualItem.item}
                    onChange={(e) => setManualItem(prev => ({ ...prev, item: e.target.value }))}
                  />
                  <input
                    type="number"
                    placeholder="Quantity"
                    min="1"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={manualItem.quantity}
                    onChange={(e) => setManualItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  />
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={manualItem.unit}
                    onChange={(e) => setManualItem(prev => ({ ...prev, unit: e.target.value }))}
                  >
                    {knownUnits.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    min="0"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={manualItem.rate}
                    onChange={(e) => setManualItem(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="flex justify-between items-center mt-3">
                  <button
                    onClick={addManualItem}
                    className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </button>
                </div>
                
                {errors.manual && (
                  <p className="text-red-500 text-sm mt-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.manual}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Order Items List */}
          {orderData.items.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Items</h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {orderData.items.map((item, index) => (
                    <div key={item.id} className={`p-4 flex items-center justify-between ${index !== orderData.items.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.item}</h4>
                            <p className="text-sm text-gray-500">{item.brand}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                            >
                              -
                            </button>
                            <span className="w-12 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                            >
                              +
                            </button>
                            <span className="text-sm text-gray-500 ml-2">{item.unit}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 ml-4">
                        <div className="text-right">
                          <p className="font-medium text-gray-900">₹{(item.quantity * item.rate).toLocaleString()}</p>
                          <p className="text-sm text-gray-500">₹{item.rate} each</p>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Total */}
                <div className="bg-gray-50 p-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-blue-600">₹{calculateTotal().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errors.items && (
            <p className="text-red-500 text-sm mb-4 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.items}
            </p>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitOrder}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium"
            >
              Create Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrder;