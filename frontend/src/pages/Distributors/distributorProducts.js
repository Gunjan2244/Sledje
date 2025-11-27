import React, { useEffect, useState, useCallback } from "react";
import { Search, Package, ChevronLeft, ChevronRight, Upload, X } from "lucide-react";
import API from "../../api";

export default function DistributorProducts() {
  const { user } = JSON.parse(localStorage.getItem("user"));
  const distributorId = user.id;

  const [distributorships, setDistributorships] = useState([]);
  const [activeDistributorship, setActiveDistributorship] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [importModal, setImportModal] = useState(null); // {variant, product}

  // ======================================
  // 1. Load all distributorships
  // ======================================
  const fetchDistributorships = async () => {
    try {
      const res = await API.get("/distributorships");
      setDistributorships(res.data);

      if (!activeDistributorship && res.data.length) {
        setActiveDistributorship(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load distributorships");
    }
  };

  // ======================================
  // 2. Load products under selected distributorship
  // ======================================
  const fetchProducts = useCallback(async () => {
    if (!activeDistributorship) return;

    try {
      setLoading(true);
      setError("");

      const res = await API.get("/products", {
        params: {
          distributorshipId: activeDistributorship,
          search: searchTerm.trim() || undefined,
        },
      });

      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [activeDistributorship, searchTerm]);

  useEffect(() => {
    fetchDistributorships();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ======================================
  // 3. Handle search
  // ======================================
  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  // ======================================
  // 4. Import modal submit
  // ======================================
  const handleImport = async (form) => {
    try {
      const payload = {
        distributorId,
        variantId: form.variantId,
        stock: Number(form.stock),
        costPrice: Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice),
        expiry: form.expiry || null,
      };

      await API.post("/distributor-inventory/import", payload);

      setImportModal(null);
      fetchProducts();
    } catch (err) {
      console.error(err);
      setError("Failed to import product variant");
    }
  };

  // ======================================
  // RENDER
  // ======================================
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-blue-800 mb-4">Product Catalog</h1>

      {/* Error */}
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 flex justify-between">
          <span>{error}</span>
          <X className="cursor-pointer" onClick={() => setError("")} />
        </div>
      )}

      {/* Distributorship tabs */}
      <div className="flex gap-3 mb-6 overflow-x-auto">
        {distributorships.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDistributorship(d.id)}
            className={`px-5 py-2 rounded-full border-2 transition-all font-medium ${
              activeDistributorship === d.id
                ? "bg-blue-700 text-white border-blue-700 shadow"
                : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" />
          <input
            className="w-full border rounded-lg px-10 py-2"
            placeholder="Search products by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="px-6 bg-blue-600 text-white rounded-lg">Search</button>
      </form>

      {/* Product List */}
      {loading ? (
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full mx-auto"></div>
          <p>Loading products...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.length ? (
            products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onImport={(variant) => setImportModal({ product, variant })}
              />
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500 py-10">
              <Package className="mx-auto mb-3 text-gray-300" size={50} />
              No products found.
            </div>
          )}
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <ImportVariantModal
          product={importModal.product}
          variant={importModal.variant}
          onClose={() => setImportModal(null)}
          onSubmit={handleImport}
        />
      )}
    </div>
  );
}

// ====================================================================
// COMPONENT: PRODUCT CARD
// ====================================================================
function ProductCard({ product, onImport }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow border">
      <img
        src={product.imageUrl || "/placeholder.png"}
        alt={product.name}
        className="w-full h-40 object-cover rounded-lg mb-4"
      />

      <h3 className="text-xl font-semibold">{product.name}</h3>
      <p className="text-sm text-gray-500">{product.category}</p>

      {/* Variant Carousel */}
      <div className="mt-4 overflow-x-auto flex gap-3 pb-2">
        {product.variants.map((variant) => (
          <div
            key={variant.id}
            className="min-w-[200px] p-3 bg-gray-50 border rounded-xl"
          >
            <h4 className="font-semibold text-gray-800">{variant.name}</h4>
            <p className="text-sm text-gray-600">MRP: ₹{variant.mrp}</p>
            <p className="text-sm text-gray-600">SKU: {variant.sku}</p>

            <button
              onClick={() => onImport(variant)}
              className="mt-3 w-full flex gap-2 justify-center items-center bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700"
            >
              <Upload size={18} />
              Import
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ====================================================================
// COMPONENT: IMPORT VARIANT MODAL
// ====================================================================
function ImportVariantModal({ product, variant, onClose, onSubmit }) {
  const [form, setForm] = useState({
    variantId: variant.id,
    stock: "",
    costPrice: "",
    sellingPrice: "",
    expiry: "",
  });

  const change = (field, value) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center p-4 z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Import Variant – {product.name}
          </h2>
          <X className="cursor-pointer" onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Stock */}
          <input
            type="number"
            placeholder="Stock"
            className="w-full border rounded px-3 py-2"
            value={form.stock}
            onChange={(e) => change("stock", e.target.value)}
          />

          {/* Cost Price */}
          <input
            type="number"
            placeholder="Cost Price"
            className="w-full border rounded px-3 py-2"
            value={form.costPrice}
            onChange={(e) => change("costPrice", e.target.value)}
          />

          {/* Selling Price */}
          <input
            type="number"
            placeholder="Selling Price"
            className="w-full border rounded px-3 py-2"
            value={form.sellingPrice}
            onChange={(e) => change("sellingPrice", e.target.value)}
          />

          {/* Expiry */}
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={form.expiry}
            onChange={(e) => change("expiry", e.target.value)}
          />

          <button className="w-full bg-blue-600 text-white py-2 rounded-lg">
            Import Variant
          </button>
        </form>
      </div>
    </div>
  );
}
