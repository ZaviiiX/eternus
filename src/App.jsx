// src/App.jsx
import { useLocation } from "react-router-dom";
import AppRouter from "./router/AppRouter";
import Navbar from "./components/Layout/Navbar";
import Footer from "./components/Layout/Footer";
import "./index.css";

export default function App() {
  const { pathname } = useLocation();

  // Sakrij globalni navbar/footer na dashboardu i login stranici
  const hideChrome =
    pathname.startsWith("/dashboard") || pathname.startsWith("/login");

  return (
    <div className="bg-[#0E0E10] min-h-screen text-white font-[Inter,sans-serif]">
      {!hideChrome && <Navbar />}
      <AppRouter />
      {!hideChrome && <Footer />}
    </div>
  );
}
