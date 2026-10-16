import React, { createContext, useContext, useEffect, useState } from "react";
import { Customer } from "@halora/api-client";
import {
  apiClient,
  getStoredRefreshToken,
  clearStoredRefreshToken,
  queryClient,
} from "./api";

interface CustomerLoginInput {
  email: string;
  password: string;
}

interface CustomerRegisterInput {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
}

interface AuthContextType {
  user: Customer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: CustomerLoginInput) => Promise<void>;
  register: (data: CustomerRegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getStoredRefreshToken();
        if (token) {
          await apiClient.auth.customerRefresh(token);
          const profile = await apiClient.customerPortal.getProfile();
          setUser(profile);
        }
      } catch (err) {
        console.warn("Session restore failed", err);
        await clearStoredRefreshToken();
        apiClient.setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (data: CustomerLoginInput) => {
    await apiClient.auth.customerLogin(data.email, data.password);
    const profile = await apiClient.customerPortal.getProfile();
    setUser(profile);
    queryClient.clear();
  };

  const register = async (data: CustomerRegisterInput) => {
    await apiClient.auth.customerRegister({
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      phone: data.phone,
      password: data.password,
    });

    // Auto login after registration
    await apiClient.auth.customerLogin(data.email, data.password);
    const profile = await apiClient.customerPortal.getProfile();
    setUser(profile);
    queryClient.clear();
  };

  const logout = async () => {
    try {
      const token = await getStoredRefreshToken();
      if (token) {
        await apiClient.auth.customerLogout(token);
      }
    } catch (err) {
      console.warn("Logout request failed", err);
    } finally {
      await clearStoredRefreshToken();
      apiClient.setAccessToken(null);
      setUser(null);
      queryClient.clear();
    }
  };

  const refreshProfile = async () => {
    try {
      const profile = await apiClient.customerPortal.getProfile();
      setUser(profile);
    } catch (err) {
      console.warn("Failed to refresh customer profile", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
