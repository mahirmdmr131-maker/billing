import React, { createContext, useContext, useMemo } from 'react';
import { User, Role, Permission } from '../../types';
import { hasPermission as checkPermission, hasModuleAccess, getPermissionsForUser } from '../../utils/rbac';

interface PermissionContextType {
  hasPermission: (permission: Permission) => boolean;
  hasModule: (modulePrefix: string) => boolean;
  userPermissions: Permission[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const PermissionContext = createContext<PermissionContextType>({
  hasPermission: () => false,
  hasModule: () => false,
  userPermissions: [],
  isSuperAdmin: false,
  isAdmin: false,
});

export const PermissionProvider: React.FC<{ user: User | null; roles: Role[]; children: React.ReactNode }> = ({ user, roles, children }) => {
  const value = useMemo(() => {
    if (!user) {
      return {
        hasPermission: () => false,
        hasModule: () => false,
        userPermissions: [],
        isSuperAdmin: false,
        isAdmin: false,
      };
    }

    const permissions = getPermissionsForUser(user, roles);
    const isSuperAdmin = user.role === 'super_admin';
    const isAdmin = isSuperAdmin || user.role === 'admin';

    return {
      hasPermission: (permission: Permission) => checkPermission(user, roles, permission),
      hasModule: (modulePrefix: string) => hasModuleAccess(user, roles, modulePrefix),
      userPermissions: permissions,
      isSuperAdmin,
      isAdmin,
    };
  }, [user, roles]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

export const usePermissions = () => useContext(PermissionContext);

