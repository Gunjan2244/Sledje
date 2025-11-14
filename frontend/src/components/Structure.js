import React, { useState } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Login from "./Login";

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
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-[9999] p-4"
          onClick={closeLoginModal}
        >
          <div
            className="bg-transparent max-w-6xl w-full max-h-[95vh] rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pass closeLoginModal as a prop so Login can close itself after success */}
            <Login onClose={closeLoginModal} />
          </div>
        </div>
      )}
    </div>
  );
}