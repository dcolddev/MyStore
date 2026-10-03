import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import StoreNew from "./pages/StoreNew";
import Products from "./pages/Products";
import ProductNew from "./pages/ProductNew";
import ProductRestock from "./pages/ProductRestock";
import SalesHistory from "./pages/SalesHistory";
import Expenses from "./pages/Expenses";
import ExpenseNew from "./pages/ExpenseNew";
import Debts from "./pages/Debts";
import DebtNew from "./pages/DebtNew";
import Checkout from "./pages/Checkout";
import CustomerCheckout from "./pages/CustomerCheckout";
import CustomerAccount from "./pages/CustomerAccount";
import OrderSuccess from "./pages/OrderSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* E-Commerce Storefront Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/checkout" element={<CustomerCheckout />} />
              <Route path="/account" element={<CustomerAccount />} />
              <Route path="/order-success/:orderId" element={<OrderSuccess />} />

              {/* Merchant / Cashier POS & Store Management Routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/new" element={<ProductNew />} />
              <Route path="/products/:productId/restock" element={<ProductRestock />} />
              <Route path="/sales/history" element={<SalesHistory />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/expenses/new" element={<ExpenseNew />} />
              <Route path="/debts" element={<Debts />} />
              <Route path="/debts/new" element={<DebtNew />} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
