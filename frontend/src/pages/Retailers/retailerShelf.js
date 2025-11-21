import { useState, useEffect, useRef } from "react";
import {
  Menu,
  Search,
  Filter,
  Plus,
  Minus,
  Mic,
  ShoppingCart,
  Grid3X3,
  List,
  Package,
  TrendingUp,
  AlertTriangle,
  Loader2,
  PlusCircle,
  X,
  Eye,
  ChevronDown,
  ChevronRight,
  Star,
  Building2,
  Tag,
  MicOff
} from "lucide-react";
import API from "../../api"; // Adjust the import path as needed
import { useAuth } from "../../components/AuthContext";
import RetailerCart from "./retailerCart";
import { useLocation } from "react-router-dom";

export default function Shelf() {
  // --- STATE ---
  const { user } = useAuth();
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productData, setProductData] = useState([]);
  const [categoryStructure, setCategoryStructure] = useState({});
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(Object.keys(categoryStructure)[0]);
  const [activesubcategory, setActivesubcategory] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [orderQuantities, setOrderQuantities] = useState({});
  const [viewMode, setViewMode] = useState("categories"); // categories or distributors
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [inventoryArr, setInventoryArr] = useState([]); 
  const [selectedDistributors, setSelectedDistributors] = useState({});
  const [fade, setFade] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Distributor modal state
  const [showDistributorModal, setShowDistributorModal] = useState(false);
  const [distributorSearch, setDistributorSearch] = useState("");
  const [modalDistributor, setModalDistributor] = useState(null);

  // New state for new products
  const [newProducts, setNewProducts] = useState([]);
  const [selectedNewVariants, setSelectedNewVariants] = useState({});
  const [isAddingToInventory, setIsAddingToInventory] = useState(false);

  // State for inventory variants

  const [inventoryStockMap, setInventoryStockMap] = useState({});

  const recognitionRef = useRef(null);

  // --- PLACEHOLDER SCROLL DATA ---
const placeholders = [
  "Search products...",
  "Search distributors...",
  "Search variants...",
  "Search orders...",
  "Search categories...",
];
// ---SAMPLE IMAGES---//
const myImages = [
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=720/app/images/category/cms_images/icon/1487_1679466558536.png",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=720/app/images/category/cms_images/icon/14_1678949253289.png", 
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=360/app/images/category/cms_images/icon/888_1688712847171.png",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=360/app/images/category/cms_images/icon/12_1670926444151.png",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=360/app/images/category/cms_images/icon/15_1676610279582.png",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=720/app/images/category/cms_images/icon/332_1680269009421.png",
  // Add as many as you want
];
const imageCache = JSON.parse(localStorage.getItem("imageCache") || "{}");

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const getConsistentRandomImage = (productId) => {
  const key = `${productId}-${9999}`;
  const hash = hashString(key);
  const index = hash % myImages.length;
  return myImages[index];
};

const [placeholderIndex, setPlaceholderIndex] = useState(0);
const [displayedPlaceholder, setDisplayedPlaceholder] = useState(placeholders[0]);

useEffect(() => {
  const interval = setInterval(() => {
    setFade(false); // start fade-out
    setTimeout(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
      setFade(true); // fade-in after placeholder change
    }, 300); // delay sync with transition
  }, 1500);
  return () => clearInterval(interval);
}, []);

useEffect(() => {
  setDisplayedPlaceholder(placeholders[placeholderIndex]);
}, [placeholderIndex]);


  // --- FETCH PRODUCTS FROM BACKEND AND BUILD CATEGORY STRUCTURE ---
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        // Fetch products from connected distributors
        const response = await API.get('/products/connected-distributors');
        const products = response.data.products || [];
        setProductData(products);

        // Build category structure dynamically
        const structure = {};
        products.forEach(product => {
          const category = product.category || "Other";
          const subcategory = product.subcategory || "General";
          if (!structure[category]) structure[category] = {};
          if (!structure[category][subcategory]) structure[category][subcategory] = [];
          structure[category][subcategory].push(product.name);
        });
        setCategoryStructure(structure);

        // Set default active category and subcategory
        const firstCategory = Object.keys(structure)[0] || null;
        setActiveCategory(firstCategory);
        setActivesubcategory(firstCategory ? Object.keys(structure[firstCategory])[0] : null);

      } catch (error) {
        setProductData([]);
        setCategoryStructure({});
      }
      setIsLoading(false);
    };
    fetchProducts();
    // eslint-disable-next-line
  }, []);

  // --- ORDER QUANTITIES ---
  useEffect(() => {
    const initialQuantities = {};
    productData.forEach(product => {
      product.variants.forEach(variant => {
        initialQuantities[`${product.id}-${variant.id}`] = {
          quantity: 0,
          unit: "box"
        };
      });
    });
    setOrderQuantities(initialQuantities);
  }, [productData]);
  
     useEffect(() => {
    // Only run if inventoryArr or productData are loaded
    if (inventoryArr.length === 0 && productData.length === 0) return;
  
    const fetchCart = async () => {
      try {
        // 1. Fetch from backend
        const res = await API.get('/cart');
        let backendCart = Array.isArray(res.data) ? res.data : [];
              // 3. Enrich cart items with product/variant info
        const enrichedCart = backendCart.map(item => {

          // Find product in inventoryArr or productData
          const product =
            productData.find(p => String(p.id) === String(item.productId))
          if (!product) return item;
          console.log("Found product:", product);
          // Find variant by id or _id
          const variant =
            product.variants.find(
              v => String(v.id) === String(item.variantId) || String(v._id) === String(item.variantId)
            );
          if (!variant) return item;
  
          return {
            ...item,
            id: `${product.id}-${variant.id || variant._id}`,
            productName: product.name,
            productIcon: product.icon,
            variantName: variant.name || "",
            price: variant.sellingPrice || 0,
            totalPrice: (variant.sellingPrice || 0) * (item.quantity || 1),
            distributor: product.distributor || "Unknown Distributor",
            sku: variant.sku || "",
            distributorId: product.distributorId || item.distributorId,
            distributorName: product.distributor || "Unknown Distributor"
          };
        });
        console.log("Enriched cart items:", enrichedCart);
  
        setCartItems(enrichedCart);
      } catch (error) {
        setCartItems([]);
      }
      setProductsLoaded(true);
    };
  
    fetchCart();
    // eslint-disable-next-line
  }, [inventoryArr, productData]);
  
    useEffect(() => {
    if (productsLoaded) {
      API.post('/cart/save', { cartItems });
    }
  }, [cartItems, productsLoaded]);
  
  // --- UTILITY FUNCTIONS ---
  const updateUnit = (productId, variantId, unit) => {
    const key = `${productId}-${variantId}`;
    setOrderQuantities(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        unit
      }
    }));
  };

 const addToCart = (product) => {
  const newItems = product.variants.map(variant => {
    const key = `${product.id}-${variant.id}`;
    const quantity = orderQuantities[key]?.quantity || 0;
    if (quantity > 0) {
      return {
        id: key,
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        productIcon: product.icon,
        sku: variant.sku || "",
        variantName: variant.name,
        price: variant.sellingPrice,
        quantity,
        unit: orderQuantities[key]?.unit || "box",
        totalPrice: variant.sellingPrice * quantity,
        distributorId: product.distributorId,
        distributor: product.distributor || "Unknown Distributor",
        distributorName: product.distributor || "Unknown Distributor"
      };
    }
    return null;
  }).filter(Boolean);

  if (newItems.length === 0) {
    alert("Please select quantity for at least one variant");
    return;
  }

  setCartItems(prevCart => {
    const updatedCart = [...prevCart];

    newItems.forEach(newItem => {
      const existingIndex = updatedCart.findIndex(
        item => item.productId === newItem.productId && item.variantId === newItem.variantId
      );

      if (existingIndex !== -1) {
        const existingItem = updatedCart[existingIndex];
        const newQuantity = existingItem.quantity + newItem.quantity;
        updatedCart[existingIndex] = {
          ...existingItem,
          quantity: newQuantity,
          totalPrice: newQuantity * existingItem.price,
        };
      } else {
        updatedCart.push(newItem);
      }
    });

    return updatedCart;
  });

  // Reset input quantities
  const resetQuantities = {};
  product.variants.forEach(variant => {
    const key = `${product.id}-${variant.id}`;
    resetQuantities[key] = {
      ...orderQuantities[key],
      quantity: 0
    };
  });

  setOrderQuantities(prev => ({
    ...prev,
    ...resetQuantities
  }));
};


  const removeFromCart = (itemId) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.totalPrice, 0).toLocaleString();
  };

// First, add this helper function inside your component
const hasAnyQuantities = () => {
  return Object.values(orderQuantities).some(item => item.quantity > 0);
};

// Add this function to handle adding all items
const addAllToCart = () => {
  const itemsToAdd = [];

  currentProducts.forEach(product => {
    product.variants.forEach(variant => {
      const key = `${product.id}-${variant.id}`;
      const quantity = orderQuantities[key]?.quantity || 0;
      if (quantity > 0) {
        itemsToAdd.push({
          id: key,
          distributorId: product.distributorId,
          sku: variant.sku || "",
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          productIcon: product.icon,
          variantName: variant.name,
          price: variant.sellingPrice,
          quantity,
          unit: orderQuantities[key]?.unit || "box",
          totalPrice: variant.sellingPrice * quantity,
          distributor: product.distributor || "Unknown Distributor",
          distributorName: product.distributor || "Unknown Distributor"
        });
      }
    });
  });

  if (itemsToAdd.length === 0) {
    alert("Please select quantity for at least one item");
    return;
  }

  setCartItems(prevCart => {
    const updatedCart = [...prevCart];

    itemsToAdd.forEach(newItem => {
      const existingIndex = updatedCart.findIndex(
        item => item.productId === newItem.productId && item.variantId === newItem.variantId
      );

      if (existingIndex !== -1) {
        const existingItem = updatedCart[existingIndex];
        const newQuantity = existingItem.quantity + newItem.quantity;
        updatedCart[existingIndex] = {
          ...existingItem,
          quantity: newQuantity,
          totalPrice: newQuantity * existingItem.price,
        };
      } else {
        updatedCart.push(newItem);
      }
    });

    return updatedCart;
  });

  // Reset all selected quantities
  const resetQuantities = {};
  Object.keys(orderQuantities).forEach(key => {
    resetQuantities[key] = { ...orderQuantities[key], quantity: 0 };
  });

  setOrderQuantities(prev => ({
    ...prev,
    ...resetQuantities
  }));
};


// Add this JSX right before the closing </div> of the main container
// (before the Cart Sidebar)
  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      const selectedItems = getSelectedCartItems();
      // Group by distributor
      const distributorGroups = {};
      selectedItems.forEach(item => {
        const distributor = item.distributorId; // Only use the ID!
        if (!distributorGroups[distributor]) distributorGroups[distributor] = [];
        distributorGroups[distributor].push(item);
      });
      console.log("Placing order payload:", { distributorGroups });

      // Place an order for each distributor
      for (const [distributorId, items] of Object.entries(distributorGroups)) {
        await API.post('/orders/create', {
          distributorId,
          items: items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            quantity: item.quantity,
            unit: item.unit
          }))
        });
      }

      setCartItems([]);
      setShowCart(false);
      alert('Order(s) placed successfully!');
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- SEARCH ---
  const performGlobalSearch = (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowGlobalSearch(false);
      return;
    }
    const results = [];
    const queryLower = query.toLowerCase();
    productData.forEach(product => {
      if (product.name.toLowerCase().includes(queryLower)) {
        results.push({ ...product, matchType: 'product' });
      } else if (product.distributor.toLowerCase().includes(queryLower)) {
        results.push({ ...product, matchType: 'distributor' });
      } else {
        const matchingVariants = product.variants.filter(variant =>
          variant.name.toLowerCase().includes(queryLower)
        );
        if (matchingVariants.length > 0) {
          results.push({ ...product, matchType: 'variant', matchingVariants });
        }
      }
    });
    setSearchResults(results);
    setShowGlobalSearch(results.length > 0);
  };

  // --- VOICE SEARCH ---
  const startVoiceSearch = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        performGlobalSearch(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } else {
      alert('Speech recognition not supported in this browser');
    }
  };
  const stopVoiceSearch = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
  };

  const navigateToProduct = (product) => {
    console.log("Navigating to product:", product);
    setActiveCategory(product.category);
    setActivesubcategory(product.subcategory);
    setShowGlobalSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, "gi");
    return (
      <span
        dangerouslySetInnerHTML={{
          __html: text.replace(regex, (match) => `<mark class="bg-yellow-200 px-1 rounded">${match}</mark>`),
        }}
      />
    );
  };
  const getStockStatus = (variants) => {
    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const hasOutOfStock = variants.some(v => v.stock === 0);
    const hasLowStock = variants.some(v => v.stock > 0 && v.stock <= 5);
    if (totalStock === 0) return { status: 'out', color: 'red', text: 'Out of Stock' };
    if (hasOutOfStock || hasLowStock) return { status: 'low', color: 'yellow', text: 'Low Stock' };
    return { status: 'good', color: 'green', text: 'In Stock' };
  };

  const getPriceRange = (variants) => {
    const prices = variants.map(v => v.sellingPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `₹${min.toLocaleString()}` : `₹${min.toLocaleString()} - ₹${max.toLocaleString()}`;
  };

  const updateQuantity = (productId, variantId, value) => {
    const key = `${productId}-${variantId}`;
    setOrderQuantities(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        quantity: Math.max(0, value)
      }
    }));
  };

  // --- CATEGORY/subcategory LOGIC ---
  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    setActivesubcategory(null); // Reset subcategory when changing category
  };

  const handlesubcategoryClick = (subcategory) => {
    setActivesubcategory(subcategory);
  };

  // --- PRODUCT FILTERING ---
  const getCurrentProducts = () => {
    let products;
    if (viewMode === "categories") {
      products = inventoryArr.filter(p =>
        p.category === activeCategory &&
        (!activesubcategory || p.subcategory === activesubcategory)
      );
    } else {
      // Group by distributors
      const distributorProducts = {};
      inventoryArr.forEach(product => {
        if (!distributorProducts[product.distributor]) {
          distributorProducts[product.distributor] = [];
        }
        distributorProducts[product.distributor].push(product);
      });
      products = distributorProducts[activeCategory] || [];
    }
    // Apply filters
    return products.filter(product => {
      if (filterType === "low-stock") {
        return product.variants.some(v => v.stock > 0 && v.stock <= 5);
      } else if (filterType === "out-of-stock") {
        return product.variants.some(v => v.stock === 0);
      }
      return true;
    }).sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'stock':
          aVal = a.variants.reduce((sum, v) => sum + v.stock, 0);
          bVal = b.variants.reduce((sum, v) => sum + v.stock, 0);
          break;
        case 'price':
          aVal = Math.min(...a.variants.map(v => v.sellingPrice));
          bVal = Math.min(...b.variants.map(v => v.sellingPrice));
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      if (sortOrder === 'desc') {
        return aVal < bVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });
  };

  const currentProducts = getCurrentProducts();

  // --- DISTRIBUTOR MODAL LOGIC ---
  const allDistributors = [...new Set(productData.map(p => p.distributorId).filter(Boolean))];
  const filteredDistributors = allDistributors.filter(d =>
    d.toLowerCase().includes(distributorSearch.toLowerCase())
  );

  // Fetch products for the selected distributor (from Products model)
  const [modalProducts, setModalProducts] = useState([]);
  const fetchDistributorProducts = async (distributorId) => {
    setIsLoading(true);
    try {
      const res = await API.get(`/products/get?distributorId=${distributorId}`);
      setModalProducts(res.data || []);
    } catch {
      setModalProducts([]);
    }
    setIsLoading(false);
  };

  // When modalDistributor changes, fetch products
  useEffect(() => {
    if (modalDistributor) fetchDistributorProducts(modalDistributor);
  }, [modalDistributor]);

  // Cache for distributor products
  const [distributorProductsCache, setDistributorProductsCache] = useState({});

  // Fetch products for the selected distributor (from Products model)
  useEffect(() => {
    if (!modalDistributor) return;

    // If already cached, use cache
    if (distributorProductsCache[modalDistributor]) {
      setModalProducts(distributorProductsCache[modalDistributor]);
      return;
    }
    // Otherwise, fetch and cache
    setIsLoading(true);
    API.get(`/products/get?distributorId=${modalDistributor}`)
      .then(res => {
        const products = res.data || [];
        setModalProducts(products);
        setDistributorProductsCache(prev => ({
          ...prev,
          [modalDistributor]: products
        }));
      })
      .catch(() => setModalProducts([]))
      .finally(() => setIsLoading(false));
  }, [modalDistributor]);

  const updateCartItemQuantity = (itemId, newQuantity) => {
  setCartItems(prev =>
    prev.map(item =>
      item.id === itemId
        ? { ...item, quantity: newQuantity, totalPrice: item.price * newQuantity }
        : item
    )
  );
};

  // Fetch inventory variant IDs for quick lookup
  const fetchInventoryVariantIds = async () => {
    try {
      const res = await API.get('/inventory');
      const arr = Array.isArray(res.data) ? res.data : (res.data.inventory || []);
      setInventoryArr(arr);
      setProductData(arr);

      // Build category structure from inventoryArr
      const structure = {};
      arr.forEach(product => {
        const category = product.category || "Other";
        const subcategory = product.subcategory || "General";
        if (!structure[category]) structure[category] = {};
        if (!structure[category][subcategory]) structure[category][subcategory] = [];
        structure[category][subcategory].push(product.name);
      });
      setCategoryStructure(structure);

      // Set default active category and subcategory if not set
      const firstCategory = Object.keys(structure)[0] || null;
      setActiveCategory(firstCategory);
      setActivesubcategory(firstCategory ? Object.keys(structure[firstCategory])[0] : null);

      // Build stock map
      const stockMap = {};
      arr.forEach(item => {
        item.variants.forEach(variant => {
          stockMap[variant._id] = variant.stock || 0;
        });
      });
      setInventoryStockMap(stockMap);
    } catch {
      setInventoryArr([]);
      setCategoryStructure({});
      setInventoryStockMap({});
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchInventoryVariantIds();
  }, []);

  const handleAddVariantToInventory = async (variantId) => {
    setIsAddingToInventory(true);
    try {
      await API.post("/inventory/add", { variantId });
      await fetchInventoryVariantIds(); // <-- ensure this is awaited
      alert("Variant added to your inventory!");
    } catch {
      alert("Failed to add variant to inventory.");
    }
    setIsAddingToInventory(false);
  };

  // Distributor information state
  const [distributorInfo, setDistributorInfo] = useState({}); // { distributorId: { companyName, ... } }

  useEffect(() => {
    if (productData.length === 0) return;
    const uniqueIds = [...new Set(productData.map(p => p.distributorId).filter(Boolean))];
    if (uniqueIds.length === 0) return;

    API.post('/distributors/batch', { ids: uniqueIds })
      .then(res => {
        const infoMap = {};
        (res.data.distributors || []).forEach(d => {
          infoMap[d._id] = d;
        });
        setDistributorInfo(infoMap);
      })
      .catch(() => setDistributorInfo({}));
  }, [productData]);

  // New function to group cart items by distributor
  const groupCartByDistributor = () => {
    const groups = {};
    cartItems.forEach(item => {
      const distributorId = item.distributorId;
      if (!distributorId) {
        console.warn('Cart item missing distributorId:', item);
        return;
      }
      if (!groups[distributorId]) groups[distributorId] = [];
      groups[distributorId].push(item);
    });
    return groups;
  };

  const getSelectedCartItems = () => {
    const groups = groupCartByDistributor();
    let selected = [];
    Object.entries(groups).forEach(([distributor, items]) => {
      if (selectedDistributors[distributor] !== false) {
        selected = selected.concat(items);
      }
    });
    return selected;
  };

  const location = useLocation();

  useEffect(() => {
    setShowDistributorModal(false);
    setModalDistributor(null);
  }, [location.pathname]);


  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="relative">
      {/* Header */}
      <header className="sticky top-0 z-40 h-20 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm pr-10 pt-4">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-full">
            
            {/* Brand Section */}
            <div className="flex items-center space-x-4 min-w-0">
              <div className="flex items-center space-x-3">
                <div className="hidden sm:block">
                  <h1 className="text-xl lg:text-3xl font-bold text-blue-500 tracking-tight pl-12">
                    Tiwari Stores
                    <div className="relative inline-block ml-4">
                      <span className="relative -top-0.5 left-0 text-sm font-medium text-gray-600 bg-gray-200 px-3 py-1 rounded-full">
                        {currentProducts.length}
                      </span>
                    </div>
                  </h1>
                </div>
              </div>
            </div>

            {/* Search Section with highest z-index */}
            <div className="flex-1 max-w-2xl mx-6 lg:mx-8 pl-8">
              <div className="relative z-50">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                
                <input
                  type="text"
                  placeholder={displayedPlaceholder}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    performGlobalSearch(e.target.value);
                  }}
                  className="shadow-sm block w-full pl-12 pr-16 py-3 lg:py-3.5 text-gray-900 placeholder-gray-500 bg-gray-50/80 border-2 border-gray-200/80 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all duration-200 text-sm lg:text-base"
                />
                
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <button
                    onClick={isListening ? stopVoiceSearch : startVoiceSearch}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      isListening
                        ? 'bg-red-500 text-white shadow-md hover:bg-red-600'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>

                {/* Search Results Dropdown with maximum z-index */}
                {showGlobalSearch && (
                  <>
                    {/* Backdrop overlay to ensure dropdown is on top */}
                    <div 
                      className="fixed inset-0 z-[9998]" 
                      onClick={() => setShowGlobalSearch(false)}
                    />
                    
                    {/* Dropdown with highest z-index */}
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-2xl shadow-2xl z-[9999] max-h-80 overflow-y-auto animate-in fade-in-0 slide-in-from-top-2 duration-200">
                      <div className="p-2">
                        {searchResults.length > 0 ? (
                          searchResults.map(product => (
                            <div
                              key={`search-${product.id}`}
                              onClick={() => navigateToProduct(product)}
                              className="flex items-center space-x-3 p-4 rounded-xl hover:bg-gray-50/80 cursor-pointer transition-all duration-150 group"
                            >
                              <div className="flex-shrink-0 text-2xl group-hover:scale-110 transition-transform duration-200">
                                {product.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                  {highlightText(product.name, searchQuery)}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                  {highlightText(product.distributor, searchQuery)} • {product.category}
                                </p>
                              </div>
                              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-gray-500">
                            <div className="text-4xl mb-2">🔍</div>
                            <p className="font-medium">No results found</p>
                            <p className="text-sm">Try adjusting your search terms</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center space-x-3">
              {/* Cart Button */}
              <button
                onClick={() => setShowCart(true)}
                className="relative flex items-center justify-center w-10 h-10 lg:w-11 lg:h-11 bg-green-200 text-gray-600 hover:text-gray-100 hover:bg-green-500 rounded-full transition-all duration-200 group"
              >
                <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6" />
                {cartItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium shadow-sm animate-pulse">
                    {cartItems.length}
                  </span>
                )}
              </button>

              {/* Distributor Button */}
              <button
                onClick={() => {
                  setShowDistributorModal(true);
                  setDistributorSearch("");
                  setModalDistributor(null);
                }}
                className="flex items-center space-x-2 px-4 py-2 lg:px-5 lg:py-2.5 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Building2 className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline text-sm lg:text-base">Distributor</span>
              </button>
            </div>
          </div>
        </div>
      </header>

        </div>


      {/* Category Tabs Bar */}
      <div className="w-full bg-white pt-4 sm:pl-16 sm:pr-16 ">
       {/* Row: Desktop - "Shop for..." + Tabs + Filters */}
        <div className="hidden sm:flex items-center justify-between w-full px-4 pt-1 pt-4">
          {/* Left: Shop for text + Tabs */}
          <div className="flex items-center gap-4 ">
            {/* Shop for... */}
            <div className="text-2xl font-semibold text-gray-800 pl-4">Shop for...</div>

            {/* Category Tabs (32px padding from left edge of this group) */}
            <div className="flex flex-wrap gap-2 overflow-x-auto bg-gray-100/60 rounded-full ">
              {Object.keys(categoryStructure).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setActivesubcategory(null);
                    setViewMode("categories");
                  }}
                  className={`relative h-[42px] px-4 py-1 text-sm sm:text-base  font-semibold  rounded-full transition-all duration-300
                    ${
                      activeCategory === cat
                        ? "border-2 border-blue-600 text-gray-800 font-bold bg-white"
                        : "border-transparent text-gray-700 hover:border-gray-300 hover:text-black bg-gray-100/60"
                    }`}
                  style={{ outline: "none" }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Filter Buttons */}
          <div className="flex items-center gap-2 pb-1 shadow-md rounded-3xl md:pl-2 md:pr-2 md:mr-2">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                filterType === "all"
                  ? "bg-blue-700 text-white shadow"
                  : "bg-gray-100 text-gray-700 hover:bg-sky-100"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setFilterType("low-stock")}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                filterType === "low-stock"
                  ? "bg-yellow-500 text-white shadow"
                  : "bg-gray-100 text-gray-700 hover:bg-sky-100"
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setFilterType("out-of-stock")}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                filterType === "out-of-stock"
                  ? "bg-red-500 text-white shadow"
                  : "bg-gray-100 text-gray-700 hover:bg-sky-100"
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>


            {/* Mobile: Tabs + Hamburger Filter */}
            <div className="sm:hidden flex items-center w-full overflow-x-auto scrollbar-hide px-4 space-x-2 mt-2">
              {/* Tabs */}
              <div className="flex flex-nowrap space-x-2">
                {Object.keys(categoryStructure).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setActivesubcategory(null);
                      setViewMode("categories");
                    }}
                    className={`relative h-[40px] px-5 py-1 text-sm font-semibold whitespace-nowrap border border-gray-300 rounded-full transition-all duration-300
                      ${
                        activeCategory === cat
                          ? "bg-blue-700 text-white shadow-inner"
                          : "bg-white text-gray-700 hover:bg-gray-100 hover:text-black"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Hamburger Filter Button */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="inline-flex items-center justify-center p-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md hover:scale-105 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black/10 z-50 overflow-hidden">
                      <div className="divide-y divide-gray-100">
                        <button
                          onClick={() => {
                            setFilterType("all");
                            setDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-sky-50"
                        >
                          All Items
                        </button>
                        <button
                          onClick={() => {
                            setFilterType("low-stock");
                            setDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-yellow-50"
                        >
                          Low Stock
                        </button>
                        <button
                          onClick={() => {
                            setFilterType("out-of-stock");
                            setDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-red-50"
                        >
                          Out of Stock
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


      {/* Main Content: Subcategories + Products */}
      <div
        className="flex w-full px-0 sm:px-6 py-4 sm:py-8 gap-2 sm:gap-6 rounded-3xl md:pl-32 md:pr-16"
        style={{
          background: activeCategory ? "#FFFFFF" : undefined,
          transition: "background 0.3s"
        }}
      >
        {/* subcategory Area */}
       <div
        className="flex-shrink-0 w-[100px] sm:w-[150px] md:w-[180px] lg:w-[220px] max-w-[220px] min-w-[100px] md:mt-0">

          <div className="bg-white rounded-sm shadow-sm p-4 top-[120px] mb-4">
            <div className="flex flex-col gap-2">
              {Object.keys(categoryStructure[activeCategory] || {}).map(subcat => (
            <button
              key={subcat}
              onClick={() => handlesubcategoryClick(subcat)}
              className={`font-eudoxus px-3 py-2 rounded-sm gap-2 transition-colors
                ${
                  activesubcategory === subcat
                    ? "md:border-r-8 border-r-4 sm:border-r-2 border-blue-500 text-gray-800 shadow font-semibold text-left"
                    : "bg-white text-gray-600 border-blue-100 hover:bg-gray-100 font-medium text-left"
                }
                text-sm sm:text-base md:text-[0.6rem] lg:text-[1.15rem]
              `}
            >
              {subcat}
            </button>

              ))}
            </div>
          </div>
        </div>

        {/* Product Area */}
      <div className="flex-1 min-w-0 md:pr-16">
          <div className="bg-white rounded-3xl p-6 sticky top-[120px]">
            {currentProducts.length === 0 ? (
              <div className="bg-gray-50 rounded-2xl p-12 text-center">
                <div className="text-gray-400 text-6xl mb-4">📦</div>
                <p className="text-gray-500 font-medium">No products found for this category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {currentProducts.map(product => {
                  const stockInfo = getStockStatus(product.variants, product.id);
                  const hasCartItems = stockInfo.status === 'in-cart';

                  return (
                    <div
                      key={product.id}
                      className="group bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-lg hover:border-blue-200 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
                      onClick={() => setSelectedProduct(product)}
                      onMouseEnter={() => setHoveredProduct(product.id)}
                      onMouseLeave={() => setHoveredProduct(null)}
                    >
                      {/* Product Image */}
                      <div className="relative bg-gray-50 rounded-xl h-32 flex items-center justify-center mb-4 overflow-hidden">
                        <img 
                          src={getConsistentRandomImage(product.id)}
                          alt={product.name}
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                        />
                        
                        {/* Stock Status Badge */}
                        <div className="absolute top-2 right-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            stockInfo.status === 'good' ? 'bg-green-100 text-green-700' :
                            stockInfo.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                            stockInfo.status === 'out' ? 'bg-red-100 text-red-700' :
                            stockInfo.status === 'in-cart' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {stockInfo.status === 'good' ? 'In Stock' :
                             stockInfo.status === 'low' ? 'Low Stock' :
                             stockInfo.status === 'out' ? 'Out of Stock' :
                             stockInfo.status === 'in-cart' ? 'In Cart' :
                             'Unknown'}
                          </span>
                        </div>

                        {/* Cart Indicator */}
                        {hasCartItems && (
                          <div className="absolute bottom-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                            In Cart
                          </div>
                        )}
                      </div>

                      {/* Product Info - Simplified */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {product.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">Distributor - {product.distributor}</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            {/* Show discount pricing */}
                            {(() => {
                              const priceRange = getPriceRange(product.variants);
                              const prices = priceRange.split(' - ');
                              const minPrice = parseInt(prices[0].replace('₹', '').replace(',', ''));
                              const maxPrice = prices.length > 1 ? parseInt(prices[1].replace('₹', '').replace(',', '')) : minPrice;
                              const originalMinPrice = minPrice + 3;
                              const originalMaxPrice = maxPrice + 3;
                              const originalRange = prices.length > 1 ? 
                                `₹${originalMinPrice.toLocaleString()} - ₹${originalMaxPrice.toLocaleString()}` :
                                `₹${originalMinPrice.toLocaleString()}`;
                              
                              return (
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <p className="text-xs text-gray-400 line-through">
                                      {originalRange}
                                    </p>
                                  </div>
                                  <p className="text-sm font-bold text-green-600">
                                    {priceRange}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-blue-600">
                              {product.dailyAvgSales}/day
                            </p>
                          </div>
                        </div>

                        {/* Quick Action */}
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-400 text-center">Click to view details</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Redesigned Modal */}
          {selectedProduct && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-5xl max-h-[90vh] w-full overflow-hidden">
                
                {/* Modal Header - Cleaner */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                        <img 
                          src={getConsistentRandomImage(selectedProduct.id)}
                          alt={selectedProduct.name}
                          className="w-12 h-12 object-cover rounded-xl"
                        />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold leading-tight">{selectedProduct.name}</h2>
                        <p className="text-blue-100 text-sm">{selectedProduct.distributor}</p>
                        <p className="text-blue-200 text-xs mt-1">{selectedProduct.variants.length} variants available</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Modal Content - Better Organization */}
                <div className="flex flex-col h-[70vh]">
                  
                  {/* Quick Stats Bar */}
                  <div className="bg-gray-50 px-8 py-4 border-b border-gray-200">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">{getPriceRange(selectedProduct.variants)}</p>
                        <p className="text-sm text-gray-500">Price Range</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{selectedProduct.dailyAvgSales}</p>
                        <p className="text-sm text-gray-500">Daily Sales</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {getStockStatus(selectedProduct.variants, selectedProduct.id).cartItems?.length || 0}
                        </p>
                        <p className="text-sm text-gray-500">In Cart</p>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-8 py-6">
                    
                    {/* Cart Status - If Any */}
                    {getStockStatus(selectedProduct.variants, selectedProduct.id).status === 'in-cart' && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-blue-900 flex items-center">
                            <ShoppingCart className="w-5 h-5 mr-2" />
                            Items in Your Cart
                          </h3>
                          <span className="text-sm text-blue-600 font-medium">
                            {getStockStatus(selectedProduct.variants, selectedProduct.id).cartItems.length} items
                          </span>
                        </div>
                        <div className="space-y-2">
                          {getStockStatus(selectedProduct.variants, selectedProduct.id).cartItems.map(item => (
                            <div key={item.id} className="flex justify-between items-center bg-white rounded-lg p-3 border border-blue-200">
                              <span className="font-medium text-blue-900">{item.variantName}</span>
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                Qty: {item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Variants Grid - Cleaner Layout */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-6">Available Variants</h3>
                      
                      <div className="space-y-4">
                        {selectedProduct.variants.map(variant => {
                          const cartItem = cartItems.find(item => 
                            String(item.productId) === String(selectedProduct.id) && 
                            (String(item.variantId) === String(variant.id) || String(item.variantId) === String(variant._id))
                          );

                          return (
                            <div key={variant.id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-all duration-200 hover:shadow-md">
                              
                              {/* Variant Header */}
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h4 className="text-lg font-semibold text-gray-900">{variant.name}</h4>
                                    {cartItem && (
                                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                        In Cart: {cartItem.quantity}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500 mb-1">SKU: {variant.sku}</p>
                                  <div className="flex items-center space-x-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                      variant.stock === 0 ? 'bg-red-100 text-red-700' :
                                      variant.stock <= 5 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      <div className={`w-2 h-2 rounded-full mr-2 ${
                                        variant.stock === 0 ? 'bg-red-500' :
                                        variant.stock <= 5 ? 'bg-yellow-500' :
                                        'bg-green-500'
                                      }`}></div>
                                      {variant.stock} units
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Price & Details Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-gray-50 rounded-xl p-4 text-center">
                                  <p className="text-sm text-gray-500 mb-1">Cost Price</p>
                                  <p className="text-lg font-bold text-gray-900">₹{variant.costPrice.toLocaleString()}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 text-center">
                                  <p className="text-sm text-gray-500 mb-1">MRP</p>
                                  <div className="space-y-1">
                                    <p className="text-sm text-gray-400 line-through">₹{(variant.sellingPrice + 3).toLocaleString()}</p>
                                    <p className="text-lg font-bold text-green-600">₹{variant.sellingPrice.toLocaleString()}</p>
                                  </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 text-center">
                                  <p className="text-sm text-gray-500 mb-1">Profit Margin</p>
                                  <p className="text-lg font-bold text-blue-600">
                                    ₹{(variant.sellingPrice - variant.costPrice).toLocaleString()}
                                  </p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 text-center">
                                  <p className="text-sm text-gray-500 mb-1">Expiry</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {variant.expiry === "N/A" ? "No Expiry" : new Date(variant.expiry).toLocaleDateString('en-IN')}
                                  </p>
                                </div>
                              </div>

                              {/* Order Controls - Better Spacing */}
                              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center space-x-4">
                                  <div className="flex items-center bg-white rounded-lg border border-gray-300 overflow-hidden">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateQuantity(selectedProduct.id, variant.id, (orderQuantities[`${selectedProduct.id}-${variant.id}`]?.quantity || 0) - 1);
                                      }}
                                      className="p-3 hover:bg-gray-100 transition-colors"
                                    >
                                      <Minus className="w-4 h-4" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max={variant.stock}
                                      value={orderQuantities[`${selectedProduct.id}-${variant.id}`]?.quantity || 0}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        updateQuantity(selectedProduct.id, variant.id, parseInt(e.target.value) || 0);
                                      }}
                                      className="w-20 px-3 py-3 text-center border-0 bg-transparent focus:outline-none font-medium"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateQuantity(selectedProduct.id, variant.id, (orderQuantities[`${selectedProduct.id}-${variant.id}`]?.quantity || 0) + 1);
                                      }}
                                      className="p-3 hover:bg-gray-100 transition-colors"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                  
                                  <select
                                    value={orderQuantities[`${selectedProduct.id}-${variant.id}`]?.unit || "box"}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      updateUnit(selectedProduct.id, variant.id, e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="border border-gray-300 rounded-lg px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="box">Box</option>
                                    <option value="piece">Piece</option>
                                    <option value="pack">Pack</option>
                                  </select>
                                </div>

                                <div className="text-right">
                                  <p className="text-sm text-gray-500">Total</p>
                                  <p className="text-lg font-bold text-gray-900">
                                    ₹{((orderQuantities[`${selectedProduct.id}-${variant.id}`]?.quantity || 0) * variant.sellingPrice).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer - Sticky */}
                  <div className="bg-white border-t border-gray-200 px-8 py-6">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
                      >
                        Close
                      </button>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Selected Items</p>
                          <p className="text-lg font-bold text-gray-900">
                            {Object.values(orderQuantities).reduce((sum, item) => sum + (item.quantity || 0), 0)} items
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(selectedProduct);
                          }}
                          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add All to Cart Button */}
      <div className="fixed bottom-4 right-2 sm:bottom-6 sm:right-6 z-40">
        <button
          onClick={addAllToCart}
          className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 font-semibold rounded-lg shadow hover:bg-blue-50 transition"
        >
        
          <span className="hidden sm:inline">Add All to </span>
          <span className="ml-2 bg-white text-blue-600 text-xs px-2 py-1 rounded-full">
            {Object.values(orderQuantities).reduce((sum, item) => sum + (item.quantity || 0), 0)}
          </span>
        </button>
        <button
          onClick={() => setShowCart(true)}
          className="flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="hidden sm:inline">Cart</span>
          <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            {cartItems.length}
          </span>
        </button>
      </div>

      {/* Cart Component */}
      <RetailerCart 
        showCart={showCart}
        setShowCart={setShowCart}
        cartItems={cartItems}
        groupCartByDistributor={groupCartByDistributor}
        updateCartItemQuantity={updateCartItemQuantity}
        removeFromCart={removeFromCart}
        distributorInfo={distributorInfo}
        onOrderPlaced={(selectedDistributorIds) => {
        fetchInventoryVariantIds();
        setCartItems(prev =>
          prev.filter(item => !selectedDistributorIds.includes(item.distributorId))
        );
      }}
      />

      {/* Distributor Modal */}
{showDistributorModal && (
  <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center w-full">
    <div className="bg-white rounded-3xl shadow-lg w-full h-5/6 max-w-4xl mx-2 flex flex-col">
      {/* Blue Header */}
      <div className="bg-blue-800 text-white rounded-t-3xl p-6 relative flex items-center justify-between">
        <h2 className="text-xl font-bold">Select Distributor</h2>
        <button
          className="text-white hover:text-gray-300"
          onClick={() => {
            setShowDistributorModal(false);
            setModalDistributor(null);
          }}
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {!modalDistributor ? (
          <>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search distributors..."
                value={distributorSearch}
                onChange={e => setDistributorSearch(e.target.value)}
                className="w-full px-4 py-2 rounded-full border-2 focus:ring focus:ring-gray-300"
              />
            </div>
            <div className="space-y-2">
              {filteredDistributors.length === 0 && (
                <div className="text-gray-400 text-center py-4">No distributors found</div>
              )}
              {filteredDistributors.map(d => (
                <button
                  key={d}
                  className="w-full text-left px-4 py-2 rounded-3xl hover:bg-blue-200 transition"
                  onClick={() => setModalDistributor(d)}
                >
                  {distributorInfo[d]?.companyName || d}
                  {distributorInfo[d]?.ownerName && (
                    <span className="ml-2 text-gray-500 text-xs">
                      ({distributorInfo[d].ownerName})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center mb-4">
              <button
                className="mr-2 text-blue-700 hover:underline text-sm"
                onClick={() => setModalDistributor(null)}
              >
                ← Back
              </button>
              <span className="font-semibold text-blue-700">{modalDistributor}</span>
            </div>
            {modalProducts.length === 0 ? (
              <div className="text-gray-400 text-center py-4">No products for this distributor</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2">Product</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">Stock</th>
                    <th className="text-center py-2">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {modalProducts.map(product =>
                    product.variants.map(variant => {
                      const inInventory = inventoryStockMap[variant._id] !== undefined;
                      return (
                        <tr key={variant._id} className="border-b last:border-b-0">
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{product.icon}</span>
                              <span>{product.name} <span className="text-xs text-gray-400">({variant.name})</span></span>
                            </div>
                          </td>
                          <td className="py-2 text-right">₹{variant.sellingPrice?.toLocaleString()}</td>
                          <td className="py-2 text-right">
                            {inInventory ? (
                              <span className="inline-flex px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                                Stock: {inventoryStockMap[variant._id]}
                              </span>
                            ) : (
                              <button
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                disabled={isAddingToInventory}
                                onClick={() => handleAddVariantToInventory(variant._id)}
                              >
                                {isAddingToInventory ? "Adding..." : "Add"}
                              </button>
                            )}
                          </td>
                          <td className="py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateQuantity(product.id, variant.id, (orderQuantities[`${product.id}-${variant.id}`]?.quantity || 0) - 1)}
                                className="p-1 rounded-l bg-gray-100 hover:bg-gray-200"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={orderQuantities[`${product.id}-${variant.id}`]?.quantity || 0}
                                onChange={(e) => updateQuantity(product.id, variant.id, parseInt(e.target.value) || 0)}
                                className="w-10 px-1 py-1 text-center text-xs border-t border-b"
                              />
                              <button
                                onClick={() => updateQuantity(product.id, variant.id, (orderQuantities[`${product.id}-${variant.id}`]?.quantity || 0) + 1)}
                                className="p-1 rounded-r bg-gray-100 hover:bg-gray-200"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <select
                                value={orderQuantities[`${product.id}-${variant.id}`]?.unit || "box"}
                                onChange={(e) => updateUnit(product.id, variant.id, e.target.value)}
                                className="ml-2 text-xs border rounded px-2 py-1"
                              >
                                <option value="box">Box</option>
                                <option value="piece">Piece</option>
                                <option value="pack">Pack</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
      {/* Footer */}
      <div className="p-4 border-t">
        <button
          onClick={() => {
            // Add all selected variants to cart
            const itemsToAdd = [];
            modalProducts.forEach(product => {
              product.variants.forEach(variant => {
                const key = `${product.id}-${variant.id}`;
                const quantity = orderQuantities[key]?.quantity || 0;
                if (quantity > 0) {
                  // Robustly assign distributorId
                  const distributorId =
                    product.distributorId ||
                    (productData.find(p => String(p.id) === String(product.id))?.distributorId) ||
                    modalDistributor ||
                    undefined;

                  itemsToAdd.push({
                    id: key,
                    productId: product.id,
                    variantId: variant.id,
                    productName: product.name,
                    productIcon: product.icon,
                    variantName: variant.name,
                    price: variant.sellingPrice,
                    sku:variant.sku,
                    quantity,
                    unit: orderQuantities[key]?.unit || "box",
                    totalPrice: variant.sellingPrice * quantity,
                    distributorId, // <- always set
                    distributor: distributorInfo[distributorId]?.companyName || distributorId,
                    distributorName: distributorInfo[distributorId]?.companyName || distributorId
                  });
                }
              });
            });
            if (itemsToAdd.length === 0) {
              alert("Please select quantity for at least one variant");
              return;
            }
              setCartItems(prevCart => {
         const updatedCart = [...prevCart];

        itemsToAdd.forEach(newItem => {
          const existingIndex = updatedCart.findIndex(
            item => item.productId === newItem.productId && item.variantId === newItem.variantId
          );

          if (existingIndex !== -1) {
            const existingItem = updatedCart[existingIndex];
            const newQuantity = existingItem.quantity + newItem.quantity;
            updatedCart[existingIndex] = {
              ...existingItem,
              quantity: newQuantity,
              totalPrice: newQuantity * existingItem.price,
            };
          } else {
            updatedCart.push(newItem);
          }
    });

    return updatedCart;
  });
            // Reset quantities
            const resetQuantities = {};
            modalProducts.forEach(product => {
              product.variants.forEach(variant => {
                const key = `${product.id}-${variant.id}`;
                resetQuantities[key] = {
                  ...orderQuantities[key],
                  quantity: 0
                };
              });
            });
            setOrderQuantities(prev => ({
              ...prev,
              ...resetQuantities
            }));
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Add Selected to Cart
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}