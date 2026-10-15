import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AdminLayout } from "./components/layout/AdminLayout";
import { Spin } from "antd";

// Auth Pages
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { ProfilePage } from "./pages/auth/ProfilePage";

// Dashboard
import { DashboardPage } from "./pages/dashboard/DashboardPage";

// Catalog
import { CategoriesPage } from "./pages/categories/CategoriesPage";
import { BrandsPage } from "./pages/brands/BrandsPage";
import { ProductsPage } from "./pages/products/ProductsPage";
import { ProductDetailPage } from "./pages/products/ProductDetailPage";

// CRM & Employees
import { CustomersPage } from "./pages/customers/CustomersPage";
import { CustomerDetailPage } from "./pages/customers/CustomerDetailPage";
import { EmployeesPage } from "./pages/employees/EmployeesPage";
import { EmployeeDetailPage } from "./pages/employees/EmployeeDetailPage";
import { AccountsPage } from "./pages/accounts/AccountsPage";
import { RolesPage } from "./pages/roles/RolesPage";

// Inventory & Supply
import { SuppliersPage } from "./pages/suppliers/SuppliersPage";
import { SupplierDetailPage } from "./pages/suppliers/SupplierDetailPage";
import { GoodsReceiptsPage } from "./pages/goods-receipts/GoodsReceiptsPage";
import { GoodsReceiptDetailPage } from "./pages/goods-receipts/GoodsReceiptDetailPage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import { InventoryAdjustmentsPage } from "./pages/inventory-adjustments/InventoryAdjustmentsPage";
import { InventoryAdjustmentDetailPage } from "./pages/inventory-adjustments/InventoryAdjustmentDetailPage";

// Commercial & Sales
import { PromotionsPage } from "./pages/promotions/PromotionsPage";
import { PromotionDetailPage } from "./pages/promotions/PromotionDetailPage";
import { OrdersPage } from "./pages/orders/OrdersPage";
import { OrderDetailPage } from "./pages/orders/OrderDetailPage";
import { InvoicesPage } from "./pages/invoices/InvoicesPage";
import { InvoiceDetailPage } from "./pages/invoices/InvoiceDetailPage";
import { ReportsPage } from "./pages/reports/ReportsPage";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
        }}
      >
        <Spin size="large" tip="Đang kiểm tra thông tin xác thực..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const router = createBrowserRouter([
  // Public Auth routes
  {
    path: "/login",
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/forgot-password",
    element: (
      <PublicOnlyRoute>
        <ForgotPasswordPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/reset-password",
    element: (
      <PublicOnlyRoute>
        <ResetPasswordPage />
      </PublicOnlyRoute>
    ),
  },

  // Protected Admin Layout routes
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      {
        path: "categories",
        element: <CategoriesPage />,
      },
      {
        path: "brands",
        element: <BrandsPage />,
      },
      {
        path: "products",
        element: <ProductsPage />,
      },
      {
        path: "products/:id",
        element: <ProductDetailPage />,
      },
      {
        path: "customers",
        element: <CustomersPage />,
      },
      {
        path: "customers/:id",
        element: <CustomerDetailPage />,
      },
      {
        path: "employees",
        element: <EmployeesPage />,
      },
      {
        path: "employees/:id",
        element: <EmployeeDetailPage />,
      },
      {
        path: "accounts",
        element: <AccountsPage />,
      },
      {
        path: "roles",
        element: <RolesPage />,
      },
      {
        path: "suppliers",
        element: <SuppliersPage />,
      },
      {
        path: "suppliers/:id",
        element: <SupplierDetailPage />,
      },
      {
        path: "goods-receipts",
        element: <GoodsReceiptsPage />,
      },
      {
        path: "goods-receipts/:id",
        element: <GoodsReceiptDetailPage />,
      },
      {
        path: "inventory",
        element: <InventoryPage />,
      },
      {
        path: "inventory-adjustments",
        element: <InventoryAdjustmentsPage />,
      },
      {
        path: "inventory-adjustments/:id",
        element: <InventoryAdjustmentDetailPage />,
      },
      {
        path: "promotions",
        element: <PromotionsPage />,
      },
      {
        path: "promotions/:id",
        element: <PromotionDetailPage />,
      },
      {
        path: "orders",
        element: <OrdersPage />,
      },
      {
        path: "orders/:id",
        element: <OrderDetailPage />,
      },
      {
        path: "invoices",
        element: <InvoicesPage />,
      },
      {
        path: "invoices/:id",
        element: <InvoiceDetailPage />,
      },
      {
        path: "reports",
        element: <ReportsPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
