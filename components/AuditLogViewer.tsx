import React, { useState, useMemo } from 'react';
import { AppData, AuditLogEntry } from '../types';

interface AuditLogViewerProps {
  data: AppData;
  updateData: (updater: ((prev: AppData) => AppData) | Partial<AppData>) => void;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ data, updateData }) => {
  const currentUser = data.currentUser;
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const logs = useMemo(() => {
    return data.auditLogs || [];
  }, [data.auditLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat = categoryFilter === 'ALL' || log.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [logs, searchTerm, categoryFilter]);

  const handleClearLogs = () => {
    if (!isSuperAdmin) {
      alert("Only Super Administrators can purge audit logs.");
      return;
    }
    if (confirm("Are you sure you want to clear all activity logs? This action is irreversible.")) {
      updateData(prev => ({ ...prev, auditLogs: [] }));
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Username', 'User Role', 'Action', 'Category', 'Details', 'IP Address'];
    const rows = filteredLogs.map(l => [
      l.timestamp,
      `"${l.username}"`,
      l.userRole,
      `"${l.action}"`,
      l.category,
      `"${l.details.replace(/"/g, '""')}"`,
      l.ipAddress || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-black uppercase tracking-widest inline-block mb-2">
            Compliance & Activity Trail
          </span>
          <h2 className="text-3xl font-black tracking-tight">System Audit Logs</h2>
          <p className="text-slate-400 text-sm mt-1">
            Real-time security log tracking user logins, stock updates, permissions changes, and critical business events.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export CSV
          </button>

          {isSuperAdmin && (
            <button
              onClick={handleClearLogs}
              className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              Clear Logs
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <svg className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search activity log by keyword, user, or action..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs uppercase text-slate-700 w-full md:w-auto"
        >
          <option value="ALL">All Categories</option>
          <option value="Auth">Authentication</option>
          <option value="Product">Products</option>
          <option value="Inventory">Inventory</option>
          <option value="Sales">Sales & Invoices</option>
          <option value="Purchase">Purchases</option>
          <option value="UserManagement">User Accounts</option>
          <option value="RoleManagement">Roles & Permissions</option>
          <option value="Settings">Settings</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <svg className="w-12 h-12 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="font-bold text-slate-600">No activity logs recorded yet</p>
            <p className="text-xs">System events and user actions will automatically appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-xs font-semibold text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800 text-xs">{log.username}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">{log.userRole}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                          {log.category}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-bold text-xs text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-600 font-medium max-w-md break-words">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogViewer;
