/// <reference types="vite/client" />
import { HaloraApiClient } from "@halora/api-client";
import { QueryClient } from "@tanstack/react-query";

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:3000/api/v1";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // Do not blindly retry mutations
    },
  },
});

export const apiClient = new HaloraApiClient({
  baseUrl: apiBaseUrl,
  realm: "STAFF",
  onUnauthenticated: () => {
    // When session is expired, redirect to login
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  },
});
