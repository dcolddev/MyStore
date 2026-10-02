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
import SaleNew from "./pages/SaleNew";
import SalesHistory from "./pages/SalesHistory";
import Expenses from "./pages/Expenses";
import ExpenseNew from "./pages/ExpenseNew";
import Debts from "./pages/Debts";
import DebtNew from "./pages/DebtNew";
import Checkout from "./pages/Checkout";
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
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-success/:orderId" element={<OrderSuccess />} />
              <Route path="/stores/new" element={<StoreNew />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/new" element={<ProductNew />} />
              <Route path="/stores/:storeId" element={<Dashboard />} />
              <Route path="/stores/:storeId/products" element={<Products />} />
              <Route path="/stores/:storeId/products/new" element={<ProductNew />} />
              <Route path="/stores/:storeId/products/:productId/restock" element={<ProductRestock />} />
              <Route path="/stores/:storeId/sales/new" element={<SaleNew />} />
              <Route path="/stores/:storeId/sales/history" element={<SalesHistory />} />
              <Route path="/stores/:storeId/expenses" element={<Expenses />} />
              <Route path="/stores/:storeId/expenses/new" element={<ExpenseNew />} />
              <Route path="/stores/:storeId/debts" element={<Debts />} />
              <Route path="/stores/:storeId/debts/new" element={<DebtNew />} />
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
