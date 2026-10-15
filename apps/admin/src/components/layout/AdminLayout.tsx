import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Typography,
  Tag,
  Space,
  Button,
} from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  AppstoreOutlined,
  TagOutlined,
  SkinOutlined,
  UserOutlined,
  TeamOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  InboxOutlined,
  DatabaseOutlined,
  SlidersOutlined,
  GiftOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BarChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../context/AuthContext";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { principal, logout, hasPermission } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const userMenuItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Hồ sơ tài khoản",
      onClick: () => navigate("/profile"),
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      danger: true,
      label: "Đăng xuất",
      onClick: handleLogout,
    },
  ];

  // Build menu items filtering by permissions
  const menuItems: MenuProps["items"] = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: <Link to="/">Tổng quan</Link>,
    },
    {
      type: "group",
      label: "BÁN HÀNG & KHÁCH HÀNG",
      children: [
        hasPermission("orders.read") && {
          key: "/orders",
          icon: <ShoppingCartOutlined />,
          label: <Link to="/orders">Đơn hàng</Link>,
        },
        hasPermission("invoices.read") && {
          key: "/invoices",
          icon: <FileTextOutlined />,
          label: <Link to="/invoices">Hóa đơn</Link>,
        },
        hasPermission("customers.read") && {
          key: "/customers",
          icon: <UserOutlined />,
          label: <Link to="/customers">Khách hàng</Link>,
        },
        hasPermission("promotions.read") && {
          key: "/promotions",
          icon: <GiftOutlined />,
          label: <Link to="/promotions">Khuyến mãi & Voucher</Link>,
        },
      ].filter(Boolean) as MenuProps["items"],
    },
    {
      type: "group",
      label: "DANH MỤC & SẢN PHẨM",
      children: [
        hasPermission("categories.read") && {
          key: "/categories",
          icon: <AppstoreOutlined />,
          label: <Link to="/categories">Loại sản phẩm</Link>,
        },
        hasPermission("brands.read") && {
          key: "/brands",
          icon: <TagOutlined />,
          label: <Link to="/brands">Thương hiệu</Link>,
        },
        hasPermission("products.read") && {
          key: "/products",
          icon: <SkinOutlined />,
          label: <Link to="/products">Sản phẩm</Link>,
        },
      ].filter(Boolean) as MenuProps["items"],
    },
    {
      type: "group",
      label: "KHO & CUNG ỨNG",
      children: [
        hasPermission("inventory.read") && {
          key: "/inventory",
          icon: <DatabaseOutlined />,
          label: <Link to="/inventory">Tồn kho & Lịch sử</Link>,
        },
        hasPermission("goodsReceipts.read") && {
          key: "/goods-receipts",
          icon: <InboxOutlined />,
          label: <Link to="/goods-receipts">Phiếu nhập hàng</Link>,
        },
        hasPermission("inventoryAdjustments.read") && {
          key: "/inventory-adjustments",
          icon: <SlidersOutlined />,
          label: <Link to="/inventory-adjustments">Điều chỉnh kho</Link>,
        },
        hasPermission("suppliers.read") && {
          key: "/suppliers",
          icon: <ShopOutlined />,
          label: <Link to="/suppliers">Nhà cung cấp</Link>,
        },
      ].filter(Boolean) as MenuProps["items"],
    },
    {
      type: "group",
      label: "BÁO CÁO & PHÂN TÍCH",
      children: [
        hasPermission("reports.read") && {
          key: "/reports",
          icon: <BarChartOutlined />,
          label: <Link to="/reports">Báo cáo thống kê</Link>,
        },
      ].filter(Boolean) as MenuProps["items"],
    },
    {
      type: "group",
      label: "QUẢN TRỊ HỆ THỐNG",
      children: [
        hasPermission("employees.read") && {
          key: "/employees",
          icon: <TeamOutlined />,
          label: <Link to="/employees">Nhân viên</Link>,
        },
        hasPermission("accounts.read") && {
          key: "/accounts",
          icon: <IdcardOutlined />,
          label: <Link to="/accounts">Tài khoản</Link>,
        },
        hasPermission("roles.read") && {
          key: "/roles",
          icon: <SafetyCertificateOutlined />,
          label: <Link to="/roles">Vai trò & Quyền</Link>,
        },
      ].filter(Boolean) as MenuProps["items"],
    },
  ];

  // Selected menu key based on current location
  const selectedKey = "/" + location.pathname.split("/")[1];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
        width={250}
        style={{
          borderRight: "1px solid #f0f0f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#c05c74",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: "bold",
              marginRight: collapsed ? 0 : 12,
            }}
          >
            H
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1f1f1f", lineHeight: 1.2 }}>
                HALORA
              </div>
              <div style={{ fontSize: 11, color: "#8c8c8c" }}>Hệ thống quản trị mỹ phẩm</div>
            </div>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey === "/" ? "/" : selectedKey]}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: "16px", width: 48, height: 48 }}
          />

          <Space size="middle">
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                <Avatar style={{ backgroundColor: "#c05c74" }} icon={<UserOutlined />} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <Text strong style={{ fontSize: 13, lineHeight: 1.2 }}>
                    {principal?.displayName || principal?.username || "Nhân viên"}
                  </Text>
                  <Space size={4}>
                    {principal?.roles?.slice(0, 2).map((role) => (
                      <Tag key={role} color="magenta" style={{ fontSize: 10, margin: 0, padding: "0 4px" }}>
                        {role}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: "24px 24px 0", overflow: "initial" }}>
          <div
            style={{
              padding: 24,
              background: "#fff",
              minHeight: "calc(100vh - 150px)",
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};
