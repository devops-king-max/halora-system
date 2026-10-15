import * as SecureStore from "expo-secure-store";
import { HaloraApiClient } from "@halora/api-client";
import { QueryClient } from "@tanstack/react-query";

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

const REFRESH_TOKEN_KEY = "halora_customer_refresh_token";

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeRefreshToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (err) {
    console.warn("Failed to update refresh token in SecureStore", err);
  }
}

export async function clearStoredRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (err) {
    console.warn("Failed to clear refresh token from SecureStore", err);
  }
}

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3000/api/v1";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const apiClient = new HaloraApiClient({
  baseUrl: apiBaseUrl,
  realm: "CUSTOMER",
  getRefreshToken: getStoredRefreshToken,
  setRefreshToken: storeRefreshToken,
});
