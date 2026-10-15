import React from "react";
import { Tabs } from "expo-router";
import { Icon } from "react-native-paper";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#b03a5b",
        tabBarInactiveTintColor: "#8e8e93",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e5e7eb",
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: "#ffffff",
        },
        headerTintColor: "#b03a5b",
        headerTitleStyle: {
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarLabel: "Trang chủ",
          tabBarIcon: ({ color, size }) => (
            <Icon source="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Loại sản phẩm",
          tabBarLabel: "Loại sản phẩm",
          tabBarIcon: ({ color, size }) => (
            <Icon source="view-grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Giỏ hàng",
          tabBarLabel: "Giỏ hàng",
          tabBarIcon: ({ color, size }) => (
            <Icon source="cart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Tài khoản",
          tabBarLabel: "Tài khoản",
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
