import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, AlertCircle, Plus, Trash2 } from "lucide-react";

const CreateOrder = ({ isOpen, onClose, onAddOrder }) => {
  const [orderData, setOrderData] = useState({
    customerName: "",
    items: [],
  });
  const [voiceInput, setVoiceInput] = useState({
    transcript: "",
    isListening: false,
  });
  const [errors, setErrors] = useState({});
  const recognitionRef = useRef(null);

  // --- VOICE INPUT LOGIC ---
  const startVoiceSearch = () => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onstart = () => setVoiceInput((prev) => ({ ...prev, isListening: true }));
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceInput((prev) => ({ ...prev, transcript }));
      };
      recognition.onerror = () => setVoiceInput((prev) => ({ ...prev, isListening: false }));
      recognition.onend = () => setVoiceInput((prev) => ({ ...prev, isListening: false }));
      recognitionRef.current = recognition;
      recognition.start();
    } else {
      alert("Speech recognition not supported in this browser");
    }
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setVoiceInput((prev) => ({ ...prev, isListening: false }));
  };

  const parseVoiceOrder = () => {
    const transcript = voiceInput.transcript.trim();
    if (!transcript) {
      setErrors((prev) => ({ ...prev, voice: "No transcript available to parse." }));
      return;
    }

    const items = transcript.split(",").map((item) => {
      const [quantity, name] = item.trim().split(" ");
      return {
        id: Date.now() + Math.random(),
        name,
        quantity: parseInt(quantity, 10) || 1,
      };
    });

    setOrderData((prev) => ({
      ...prev,
      items: [...prev.items, ...items],
    }));
    setVoiceInput((prev) => ({ ...prev, transcript: "" }));
    setErrors((prev) => ({ ...prev, voice: "" }));
  };

  const removeItem = (itemId) => {
    setOrderData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleSubmitOrder = () => {
    if (!orderData.customerName.trim()) {
      setErrors((prev) => ({ ...prev, customerName: "Customer name is required." }));
      return;
    }

    if (orderData.items.length === 0) {
      setErrors((prev) => ({ ...prev, items: "Please add at least one item to the order." }));
      return;
    }

    onAddOrder(orderData);
    setOrderData({ customerName: "", items: [] });
    setVoiceInput({ transcript: "", isListening: false });
    setErrors({});
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
            <Trash2 className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold">Create New Order</h2>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Customer Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
            <input
              type="text"
              placeholder="Enter customer name"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.customerName ? "border-red-500" : "border-gray-300"
              }`}
              value={orderData.customerName}
              onChange={(e) =>
                setOrderData((prev) => ({ ...prev, customerName: e.target.value }))
              }
            />
            {errors.customerName && (
              <p className="text-red-500 text-sm mt-1 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.customerName}
              </p>
            )}
          </div>

          {/* Voice Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Voice Input</label>
            <textarea
              placeholder="Transcript will appear here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg h-32 resize-none focus:ring-2 focus:ring-blue-500"
              value={voiceInput.transcript}
              readOnly
            />
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={voiceInput.isListening ? stopVoiceSearch : startVoiceSearch}
                className={`flex items-center px-4 py-2 rounded-lg ${
                  voiceInput.isListening ? "bg-red-500 text-white" : "bg-blue-500 text-white"
                }`}
              >
                {voiceInput.isListening ? (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Start Listening
                  </>
                )}
              </button>
              <button
                onClick={parseVoiceOrder}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
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
          </div>

          {/* Order Items */}
          {orderData.items.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Items</h3>
              <ul className="space-y-4">
                {orderData.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between items-center bg-gray-100 p-4 rounded-lg"
                  >
                    <span>{item.quantity} × {item.name}</span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitOrder}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Submit Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrder;