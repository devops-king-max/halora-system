import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Principal } from "@halora/api-client";
import { apiClient } from "../api";

interface AuthContextType {
  principal: Principal | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  reloadPrincipal: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const reloadPrincipal = useCallback(async () => {
    try {
      const p = await apiClient.auth.getMe();
      setPrincipal(p);
    } catch {
      // If getMe fails, try refresh first
      try {
        await apiClient.auth.staffRefresh();
        const p = await apiClient.auth.getMe();
        setPrincipal(p);
      } catch {
        setPrincipal(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadPrincipal();
  }, [reloadPrincipal]);

  const login = async (identifier: string, password: string) => {
    const res = await apiClient.auth.staffLogin(identifier, password);
    setPrincipal(res.principal);
  };

  const logout = async () => {
    try {
      await apiClient.auth.staffLogout();
    } catch {
      // continue logout locally
    } finally {
      setPrincipal(null);
      apiClient.setAccessToken(null);
    }
  };

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!principal) return false;
      return principal.permissions.includes(permission);
    },
    [principal]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!principal) return false;
      return permissions.some((perm) => principal.permissions.includes(perm));
    },
    [principal]
  );

  return (
    <AuthContext.Provider
      value={{
        principal,
        isLoading,
        isAuthenticated: !!principal,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        reloadPrincipal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
