import React, { useState } from "react";
import Navbar from "./Navbar";
import Footer from "../../components/Footer";
import Login from "../../components/Login";

export default function NavbarWrapper({ children }) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <Navbar onLoginClick={openLoginModal} />

      {/* Page Content */}
      <main className={`flex-grow ${isLoginModalOpen ? "blur-background" : ""}`}>{children}</main>

      {/* Footer */}
      <Footer />

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          style={{ zIndex: 9999 }}
          onClick={closeLoginModal}
        >
          <div
            className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-4xl"
            style={{
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeLoginModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            <Login />
          </div>
        </div>
      )}
    </div>
  );
}