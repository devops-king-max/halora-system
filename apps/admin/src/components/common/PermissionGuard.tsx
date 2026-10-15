import React from "react";
import { useAuth } from "../../context/AuthContext";

interface PermissionGuardProps {
  permission?: string;
  anyPermissions?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  anyPermissions,
  fallback = null,
  children,
}) => {
  const { hasPermission, hasAnyPermission } = useAuth();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (anyPermissions && !hasAnyPermission(anyPermissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
