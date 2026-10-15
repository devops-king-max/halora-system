import React from "react";
import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";
import { QueryClientProvider } from "@tanstack/react-query";
import { theme } from "../src/theme";
import { queryClient } from "../src/api";
import { AuthProvider } from "../src/AuthContext";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#ffffff" },
              headerTintColor: "#b03a5b",
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: "#f9fafb" },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="products/[id]"
              options={{ title: "Chi tiết sản phẩm" }}
            />
            <Stack.Screen
              name="products/index"
              options={{ title: "Danh sách sản phẩm" }}
            />
            <Stack.Screen
              name="checkout"
              options={{ title: "Thanh toán đơn hàng" }}
            />
            <Stack.Screen
              name="orders/index"
              options={{ title: "Đơn hàng của tôi" }}
            />
            <Stack.Screen
              name="orders/[id]"
              options={{ title: "Chi tiết đơn hàng" }}
            />
            <Stack.Screen
              name="addresses/index"
              options={{ title: "Sổ địa chỉ nhận hàng" }}
            />
            <Stack.Screen
              name="addresses/new"
              options={{ title: "Thêm địa chỉ mới" }}
            />
            <Stack.Screen
              name="addresses/[id]"
              options={{ title: "Cập nhật địa chỉ" }}
            />
            <Stack.Screen
              name="login"
              options={{ title: "Đăng nhập", presentation: "modal" }}
            />
            <Stack.Screen
              name="register"
              options={{ title: "Đăng ký tài khoản", presentation: "modal" }}
            />
            <Stack.Screen
              name="forgot-password"
              options={{ title: "Quên mật khẩu", presentation: "modal" }}
            />
            <Stack.Screen
              name="reset-password"
              options={{ title: "Đặt lại mật khẩu", presentation: "modal" }}
            />
            <Stack.Screen
              name="change-password"
              options={{ title: "Đổi mật khẩu" }}
            />
          </Stack>
        </AuthProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
