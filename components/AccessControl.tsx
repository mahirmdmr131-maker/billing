import React, { useState, useMemo } from 'react';
import { AppData, User, Role, UserRole, Permission } from '../types';
import { ALL_PERMISSIONS_BY_CATEGORY, DEFAULT_SYSTEM_ROLES, clearPermissionCache, createAuditLog } from '../utils/rbac';

interface AccessControlProps {
  data: AppData;
  updateData: (updater: ((prev: AppData) => AppData) | Partial<AppData>) => void;
}

export const AccessControl: React.FC<AccessControlProps> = ({ data, updateData }) => {
  const currentUser = data.currentUser;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = isSuperAdmin || currentUser?.role === 'admin';

  const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles' | 'matrix'>('users');

  // Search and filter states
  const [userSearch, setUserSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal states for User Management
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Role Management states
  const [allRoles, setAllRoles] = useState<Role[]>(() => {
    return data.roles && data.roles.length > 0 ? data.roles : DEFAULT_SYSTEM_ROLES;
  });
  const [selectedRoleId, setSelectedRoleId] = useState<string>('manager');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [copyFromRoleId, setCopyFromRoleId] = useState('');

  // User edit form state
  const [editFormData, setEditFormData] = useState<Partial<User>>({});

  const combinedRoles = useMemo(() => {
    return data.roles && data.roles.length > 0 ? data.roles : DEFAULT_SYSTEM_ROLES;
  }, [data.roles]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    data.users.forEach(u => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set);
  }, [data.users]);

  const filteredUsers = useMemo(() => {
    return data.users.filter(u => {
      const matchesSearch =
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.phone && u.phone.includes(userSearch)) ||
        (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.employeeId && u.employeeId.toLowerCase().includes(userSearch.toLowerCase()));

      const matchesDept = departmentFilter === 'ALL' || u.department === departmentFilter;
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      return matchesSearch && matchesDept && matchesRole;
    });
  }, [data.users, userSearch, departmentFilter, roleFilter]);

  const selectedRole = useMemo(() => {
    return combinedRoles.find(r => r.id === selectedRoleId) || combinedRoles[0];
  }, [combinedRoles, selectedRoleId]);

  // Helper to sync roles into AppData
  const saveRoles = (newRolesList: Role[]) => {
    clearPermissionCache();
    updateData(prev => {
      const log = createAuditLog(
        prev.currentUser,
        'Updated Role Permissions',
        'RoleManagement',
        `Modified permission matrix for roles`
      );
      return {
        ...prev,
        roles: newRolesList,
        auditLogs: [log, ...(prev.auditLogs || [])]
      };
    });
  };

  // Toggle permission for selected role
  const handleTogglePermission = (permissionKey: Permission) => {
    if (!isAdmin) return;
    if (selectedRole.isSystem && !isSuperAdmin) {
      alert("Only Super Administrators can modify built-in system role permissions.");
      return;
    }

    const currentPerms = selectedRole.permissions;
    const hasPerm = currentPerms.includes(permissionKey);
    const updatedPerms = hasPerm
      ? currentPerms.filter(p => p !== permissionKey)
      : [...currentPerms, permissionKey];

    const updatedRoles = combinedRoles.map(r =>
      r.id === selectedRole.id ? { ...r, permissions: updatedPerms } : r
    );

    saveRoles(updatedRoles);
  };

  // Bulk enable/disable permissions for a category
  const handleCategoryBulkToggle = (categoryPermissions: Permission[], enable: boolean) => {
    if (!isAdmin) return;
    if (selectedRole.isSystem && !isSuperAdmin) {
      alert("Only Super Administrators can modify built-in system role permissions.");
      return;
    }

    let updatedPerms = [...selectedRole.permissions];
    if (enable) {
      categoryPermissions.forEach(p => {
        if (!updatedPerms.includes(p)) updatedPerms.push(p);
      });
    } else {
      updatedPerms = updatedPerms.filter(p => !categoryPermissions.includes(p));
    }

    const updatedRoles = combinedRoles.map(r =>
      r.id === selectedRole.id ? { ...r, permissions: updatedPerms } : r
    );

    saveRoles(updatedRoles);
  };

  // Handle user edit submit
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // Protection check
    if (editFormData.role === 'super_admin' && !isSuperAdmin) {
      alert("Only Super Admin can assign Super Admin role.");
      return;
    }

    updateData(prev => {
      const updatedUsers = prev.users.map(u => {
        if (u.id === selectedUser.id) {
          return {
            ...u,
            ...editFormData,
          };
        }
        return u;
      });

      const log = createAuditLog(
        prev.currentUser,
        'Updated User Profile',
        'UserManagement',
        `Updated details and role for user ${selectedUser.username}`
      );

      return {
        ...prev,
        users: updatedUsers,
        auditLogs: [log, ...(prev.auditLogs || [])]
      };
    });

    setIsEditUserModalOpen(false);
    setSelectedUser(null);
  };

  // Lock / Unlock user account
  const handleToggleLockUser = (user: User) => {
    if (user.role === 'super_admin' && !isSuperAdmin) {
      alert("Only Super Admin can modify Super Admin account status.");
      return;
    }

    updateData(prev => {
      const updatedUsers = prev.users.map(u => {
        if (u.id === user.id) {
          return { ...u, isLocked: !u.isLocked };
        }
        return u;
      });

      const log = createAuditLog(
        prev.currentUser,
        user.isLocked ? 'Unlocked User Account' : 'Locked User Account',
        'UserManagement',
        `${user.isLocked ? 'Unlocked' : 'Locked'} account for ${user.username}`
      );

      return {
        ...prev,
        users: updatedUsers,
        auditLogs: [log, ...(prev.auditLogs || [])]
      };
    });
  };

  // Active / Inactive account toggle
  const handleToggleActiveUser = (user: User) => {
    if (user.role === 'super_admin' && !isSuperAdmin) {
      alert("Only Super Admin can disable Super Admin account.");
      return;
    }

    updateData(prev => {
      const updatedUsers = prev.users.map(u => {
        if (u.id === user.id) {
          return { ...u, isActive: !u.isActive };
        }
        return u;
      });

      const log = createAuditLog(
        prev.currentUser,
        user.isActive ? 'Disabled User Account' : 'Enabled User Account',
        'UserManagement',
        `${user.isActive ? 'Disabled' : 'Enabled'} account for ${user.username}`
      );

      return {
        ...prev,
        users: updatedUsers,
        auditLogs: [log, ...(prev.auditLogs || [])]
      };
    });
  };

  // Reset password
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;

    updateData(prev => {
      const updatedUsers = prev.users.map(u => {
        if (u.id === selectedUser.id) {
          return { ...u, passwordHash: newPassword };
        }
        return u;
      });

      const log = createAuditLog(
        prev.currentUser,
        'Reset User Password',
        'UserManagement',
        `Reset password for user ${selectedUser.username}`
      );

      return {
        ...prev,
        users: updatedUsers,
        auditLogs: [log, ...(prev.auditLogs || [])]
      };
    });

    setIsResetPasswordModalOpen(false);
    setNewPassword('');
    setSelectedUser(null);
    alert('Password reset successfully.');
  };

  // Create custom role
  const handleCreateCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    let initialPermissions: Permission[] = [];
    if (copyFromRoleId) {
      const source = combinedRoles.find(r => r.id === copyFromRoleId);
      if (source) initialPermissions = [...source.permissions];
    }

    const newRole: Role = {
      id: `custom_${Date.now()}`,
      name: newRoleName,
      description: newRoleDescription || 'Custom business role',
      permissions: initialPermissions,
      isSystem: false,
    };

    const updatedRoles = [...combinedRoles, newRole];
    saveRoles(updatedRoles);

    setSelectedRoleId(newRole.id);
    setIsCreateRoleModalOpen(false);
    setNewRoleName('');
    setNewRoleDescription('');
    setCopyFromRoleId('');
  };

  // Delete custom role
  const handleDeleteCustomRole = (roleId: string) => {
    const target = combinedRoles.find(r => r.id === roleId);
    if (!target) return;
    if (target.isSystem) {
      alert("System built-in roles cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to delete custom role "${target.name}"?`)) return;

    const updatedRoles = combinedRoles.filter(r => r.id !== roleId);
    saveRoles(updatedRoles);
    setSelectedRoleId('manager');
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-black uppercase tracking-widest">
                Enterprise RBAC Security
              </span>
              {isSuperAdmin && (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1">
                  👑 Super Admin Access
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black tracking-tight">Access Control & Role Management</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Configure fine-grained permissions, customize security roles, manage user accounts, and enforce organizational compliance.
            </p>
          </div>

          <div className="flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 backdrop-blur-md">
            <button
              onClick={() => setActiveSubTab('users')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeSubTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              User Accounts ({data.users.length})
            </button>
            <button
              onClick={() => setActiveSubTab('matrix')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeSubTab === 'matrix' || activeSubTab === 'roles'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Roles & Permission Matrix
            </button>
          </div>
        </div>
      </div>

      {/* SUBTAB 1: USER MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <svg className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search user by name, username, phone, email, or employee ID..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
              />
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs uppercase text-slate-700"
              >
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs uppercase text-slate-700"
              >
                <option value="ALL">All Roles</option>
                {combinedRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map(user => {
              const userRoleObj = combinedRoles.find(r => r.id === (user.role === 'custom' ? user.customRoleId : user.role));
              const roleName = userRoleObj ? userRoleObj.name : user.role.toUpperCase();

              return (
                <div key={user.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 font-black flex items-center justify-center text-lg uppercase shadow-inner">
                          {user.username.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">{user.username}</h3>
                          <p className="text-xs text-slate-400 font-medium">ID: {user.employeeId || user.id.slice(-6)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          user.role === 'super_admin' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          user.role === 'admin' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {roleName}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.isLocked ? 'bg-red-100 text-red-700' :
                          user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {user.isLocked ? 'Locked' : user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      {user.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Email:</span>
                          <span className="font-semibold text-slate-700">{user.email}</span>
                        </div>
                      )}
                      {user.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Phone:</span>
                          <span className="font-semibold text-slate-700">{user.phone}</span>
                        </div>
                      )}
                      {user.department && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Department:</span>
                          <span className="font-semibold text-slate-700">{user.department}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Joined:</span>
                        <span className="font-semibold text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setEditFormData(user);
                        setIsEditUserModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 012.828 0L20.5 5.828a2 2 0 010 2.828l-8.5 8.5H9v-2.5l8.5-8.5z" /></svg>
                      Edit Profile
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsResetPasswordModalOpen(true);
                        }}
                        title="Reset Password"
                        className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-all"
                      >
                        🔑
                      </button>

                      <button
                        onClick={() => handleToggleLockUser(user)}
                        title={user.isLocked ? "Unlock User" : "Lock User"}
                        className={`p-2 rounded-lg text-xs font-bold transition-all ${
                          user.isLocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {user.isLocked ? '🔓' : '🔒'}
                      </button>

                      <button
                        onClick={() => handleToggleActiveUser(user)}
                        title={user.isActive ? "Disable Account" : "Enable Account"}
                        className={`p-2 rounded-lg text-xs font-bold transition-all ${
                          user.isActive ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {user.isActive ? '⏸️' : '▶️'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: ROLE MANAGEMENT & PERMISSION MATRIX */}
      {(activeSubTab === 'matrix' || activeSubTab === 'roles') && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Roles Selector Sidebar */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Access Roles</h3>
              {isAdmin && (
                <button
                  onClick={() => setIsCreateRoleModalOpen(true)}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  + Custom Role
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {combinedRoles.map(role => {
                const isSelected = selectedRoleId === role.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{role.name}</span>
                      {role.isSystem ? (
                        <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          System
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomRole(role.id);
                          }}
                          className={`text-xs p-1 rounded hover:bg-red-500/20 ${isSelected ? 'text-white' : 'text-red-500'}`}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    <p className={`text-xs mt-1 line-clamp-1 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {role.description || `${role.permissions.length} permissions configured`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Permission Matrix Main Panel */}
          <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-800">{selectedRole.name} Matrix</h3>
                  {selectedRole.isSystem && (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">
                      System Presets
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedRole.description || 'Manage fine-grained module permissions for this role'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter permissions..."
                  value={permissionSearch}
                  onChange={e => setPermissionSearch(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Permission Categories Accordion / Cards */}
            <div className="space-y-6 max-h-[700px] overflow-y-auto pr-2">
              {ALL_PERMISSIONS_BY_CATEGORY.map(cat => {
                const categoryPermKeys = cat.permissions.map(p => p.key);
                const filteredPerms = cat.permissions.filter(p =>
                  p.label.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                  p.description.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                  cat.label.toLowerCase().includes(permissionSearch.toLowerCase())
                );

                if (filteredPerms.length === 0) return null;

                const allEnabled = categoryPermKeys.every(k => selectedRole.permissions.includes(k));
                const someEnabled = categoryPermKeys.some(k => selectedRole.permissions.includes(k));

                return (
                  <div key={cat.category} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-sm">{cat.label}</h4>
                        <span className="text-xs text-slate-400">
                          ({categoryPermKeys.filter(k => selectedRole.permissions.includes(k)).length}/{categoryPermKeys.length} enabled)
                        </span>
                      </div>

                      {isAdmin && (!selectedRole.isSystem || isSuperAdmin) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCategoryBulkToggle(categoryPermKeys, true)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded"
                          >
                            Enable All
                          </button>
                          <button
                            onClick={() => handleCategoryBulkToggle(categoryPermKeys, false)}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-200/60 px-2 py-1 rounded"
                          >
                            Disable All
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white">
                      {filteredPerms.map(perm => {
                        const isGranted = selectedRole.permissions.includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            onClick={() => handleTogglePermission(perm.key)}
                            className={`p-3 rounded-xl border flex items-start justify-between cursor-pointer transition-all ${
                              isGranted
                                ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950'
                                : 'bg-slate-50/40 border-slate-100 text-slate-500 hover:border-slate-200'
                            }`}
                          >
                            <div className="space-y-0.5 pr-3">
                              <span className="font-bold text-xs block">{perm.label}</span>
                              <span className="text-[11px] text-slate-400 block leading-tight">{perm.description}</span>
                            </div>

                            <button
                              type="button"
                              className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                                isGranted ? 'bg-indigo-600' : 'bg-slate-300'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                                  isGranted ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit User */}
      {isEditUserModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Edit User Account</h3>
              <button onClick={() => setIsEditUserModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editFormData.username || ''}
                  onChange={e => setEditFormData({ ...editFormData, username: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={editFormData.employeeId || ''}
                    onChange={e => setEditFormData({ ...editFormData, employeeId: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Department</label>
                  <input
                    type="text"
                    value={editFormData.department || ''}
                    onChange={e => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email || ''}
                  onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Assigned Role</label>
                <select
                  value={editFormData.role === 'custom' ? editFormData.customRoleId : editFormData.role}
                  onChange={e => {
                    const val = e.target.value;
                    const isCustom = val.startsWith('custom_');
                    if (isCustom) {
                      setEditFormData({ ...editFormData, role: 'custom', customRoleId: val });
                    } else {
                      setEditFormData({ ...editFormData, role: val as UserRole, customRoleId: undefined });
                    }
                  }}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none"
                >
                  {combinedRoles.map(r => (
                    <option key={r.id} value={r.id} disabled={r.id === 'super_admin' && !isSuperAdmin}>
                      {r.name} {r.id === 'super_admin' ? '👑 (Super Admin Only)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditUserModalOpen(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-800">Reset Password for {selectedUser.username}</h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setIsResetPasswordModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs shadow-md">
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Custom Role */}
      {isCreateRoleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Create Custom Business Role</h3>
              <button onClick={() => setIsCreateRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateCustomRole} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Role Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Warehouse Supervisor"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Briefly describe operational responsibilities"
                  value={newRoleDescription}
                  onChange={e => setNewRoleDescription(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Copy Permissions From (Optional)</label>
                <select
                  value={copyFromRoleId}
                  onChange={e => setCopyFromRoleId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none"
                >
                  <option value="">Start Empty</option>
                  {combinedRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreateRoleModalOpen(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30">
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessControl;
