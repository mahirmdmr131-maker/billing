import React, { useState, useEffect } from 'react';
import {
  biometricService,
  BiometricDevice,
  EmployeeStaff,
  AttendanceLog
} from '../services/biometricService';

export const BiometricAttendance: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'devices' | 'employees' | 'logs'>('devices');

  // Service Data State
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [employees, setEmployees] = useState<EmployeeStaff[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  // UI / Action state
  const [isSyncing, setIsSyncing] = useState(false);
  const [pingStatus, setPingStatus] = useState<Record<string, { testing: boolean; result?: string; success?: boolean }>>({});
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Filter state for logs
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showManualPunchModal, setShowManualPunchModal] = useState(false);

  // New Device Form
  const [deviceForm, setDeviceForm] = useState<Omit<BiometricDevice, 'id'>>({
    name: '',
    ipAddress: '192.168.1.205',
    port: 4370,
    protocol: 'tcp_ip',
    location: 'Main Gate',
    status: 'online',
    enrolledUsersCount: 0,
    storedLogsCount: 0,
    serialNumber: ''
  });

  // New Employee Form
  const [empForm, setEmpForm] = useState<Omit<EmployeeStaff, 'id' | 'createdAt'>>({
    employeeCode: `EMP-00${Math.floor(Math.random() * 90 + 10)}`,
    name: '',
    biometricUserId: `${Math.floor(Math.random() * 800 + 100)}`,
    cardNo: '',
    department: 'Processing & Milling',
    designation: 'Operator',
    shiftTiming: '09:00 AM - 06:00 PM',
    status: 'Active'
  });

  // Manual Punch Form
  const [punchForm, setPunchForm] = useState({
    employeeCode: '',
    date: new Date().toISOString().split('T')[0],
    checkInTime: '09:00 AM',
    checkOutTime: '06:00 PM',
    verificationType: 'Manual Entry' as const,
    notes: 'Approved manual attendance override'
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    setDevices(biometricService.getDevices());
    setEmployees(biometricService.getEmployees());
    setLogs(biometricService.getLogs());
  };

  // Sync logs from network devices
  const handleSyncFromDevices = async () => {
    setIsSyncing(true);
    setToastMsg({ type: 'info', text: 'Polling connected biometric devices over local TCP/IP network...' });

    const res = await biometricService.syncLogsFromDevices();
    loadAllData();
    setIsSyncing(false);
    setToastMsg({ type: 'success', text: res.message });
  };

  // Test Ping IP / Port
  const handleTestPing = async (dev: BiometricDevice) => {
    setPingStatus((prev) => ({ ...prev, [dev.id]: { testing: true } }));
    const result = await biometricService.pingDevice(dev.ipAddress, dev.port);

    setPingStatus((prev) => ({
      ...prev,
      [dev.id]: {
        testing: false,
        result: result.message,
        success: result.success
      }
    }));

    if (result.success) {
      biometricService.updateDevice(dev.id, { status: 'online', lastPing: new Date().toISOString() });
    } else {
      biometricService.updateDevice(dev.id, { status: 'offline' });
    }
    setDevices(biometricService.getDevices());
  };

  // Save Device
  const handleSaveDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceForm.name || !deviceForm.ipAddress) {
      alert('Please fill device name and IP address.');
      return;
    }
    biometricService.addDevice(deviceForm);
    loadAllData();
    setShowAddDeviceModal(false);
    setToastMsg({ type: 'success', text: `Biometric Device '${deviceForm.name}' added successfully!` });
    setDeviceForm({
      name: '',
      ipAddress: '192.168.1.205',
      port: 4370,
      protocol: 'tcp_ip',
      location: 'Main Gate',
      status: 'online',
      enrolledUsersCount: 0,
      storedLogsCount: 0,
      serialNumber: ''
    });
  };

  // Delete Device
  const handleDeleteDevice = (id: string, name: string) => {
    if (confirm(`Remove biometric device '${name}'?`)) {
      biometricService.deleteDevice(id);
      loadAllData();
      setToastMsg({ type: 'info', text: 'Device removed' });
    }
  };

  // Save Employee
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name || !empForm.employeeCode || !empForm.biometricUserId) {
      alert('Please fill employee name, code, and biometric user ID.');
      return;
    }
    biometricService.addEmployee(empForm);
    loadAllData();
    setShowAddEmpModal(false);
    setToastMsg({ type: 'success', text: `Employee '${empForm.name}' enrolled with Biometric ID #${empForm.biometricUserId}` });
  };

  // Delete Employee
  const handleDeleteEmployee = (id: string, name: string) => {
    if (confirm(`Remove employee '${name}' from attendance roster?`)) {
      biometricService.deleteEmployee(id);
      loadAllData();
      setToastMsg({ type: 'info', text: 'Employee removed' });
    }
  };

  // Save Manual Punch
  const handleSaveManualPunch = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.employeeCode === punchForm.employeeCode);
    if (!emp) {
      alert('Please select an employee');
      return;
    }

    const dev = devices[0] || { id: 'manual', name: 'Manual Override' };

    biometricService.addManualLog({
      employeeCode: emp.employeeCode,
      employeeName: emp.name,
      biometricUserId: emp.biometricUserId,
      date: punchForm.date,
      checkInTime: punchForm.checkInTime,
      checkOutTime: punchForm.checkOutTime,
      workHours: 9,
      deviceId: dev.id,
      deviceName: dev.name,
      verificationType: punchForm.verificationType,
      status: 'Present',
      notes: punchForm.notes
    });

    loadAllData();
    setShowManualPunchModal(false);
    setToastMsg({ type: 'success', text: `Manual punch logged for ${emp.name}` });
  };

  // Export Attendance CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Employee Code', 'Name', 'Biometric ID', 'Check In', 'Check Out', 'Hours', 'Verification', 'Status', 'Notes'];
    const rows = filteredLogs.map((l) => [
      l.date,
      l.employeeCode,
      `"${l.employeeName}"`,
      l.biometricUserId,
      l.checkInTime,
      l.checkOutTime || '--',
      l.workHours || 0,
      l.verificationType,
      l.status,
      `"${l.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats
  const onlineDevicesCount = devices.filter((d) => d.status === 'online').length;
  const todayLogs = logs.filter((l) => l.date === selectedDate);
  const presentToday = todayLogs.filter((l) => l.status === 'Present').length;
  const lateToday = todayLogs.filter((l) => l.status === 'Late').length;

  // Filtered Logs
  const filteredLogs = logs.filter((l) => {
    const matchesDate = !selectedDate || l.date === selectedDate;
    const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.biometricUserId.includes(searchTerm);
    return matchesDate && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              : toastMsg.type === 'error'
              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
              : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
          }`}
        >
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600 ml-2">✕</button>
        </div>
      )}

      {/* Main Top Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 20a10.003 10.003 0 006.239-2.239l.042.048m-4.588-4.41l-.456-.446a3 3 0 010-4.242 3 3 0 014.243 0l.456.446m-9.172 0l.456.446a3 3 0 010 4.242 3 3 0 01-4.243 0l-.456-.446m12.728 0l-.456-.446a3 3 0 010-4.242 3 3 0 014.243 0l.456.446" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              Biometric Attendance Maintenance
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                TCP/IP & ADMS Push
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Network Biometric Box Management (ZKTeco, eSSL, Realtime) & Employee Punch Maintenance
            </p>
          </div>
        </div>

        <button
          onClick={handleSyncFromDevices}
          disabled={isSyncing}
          className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95"
        >
          <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{isSyncing ? 'Polling Devices...' : '⚡ Sync Logs From Boxes'}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Biometric Devices</span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {onlineDevicesCount} / {devices.length} <span className="text-xs font-semibold text-emerald-500">Online</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
            📟
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Enrolled Staff</span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {employees.length} <span className="text-xs font-semibold text-slate-400">Employees</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-xl flex items-center justify-center font-bold">
            👥
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Present Today</span>
            <div className="text-xl font-black text-emerald-600 mt-1">
              {presentToday} <span className="text-xs font-semibold text-slate-400">Punches</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
            ✅
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Late Arrivals</span>
            <div className="text-xl font-black text-amber-500 mt-1">
              {lateToday} <span className="text-xs font-semibold text-slate-400">Late</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
            ⏰
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm gap-2">
        <button
          onClick={() => setActiveSubTab('devices')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
            activeSubTab === 'devices'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          📟 Biometric Network Boxes ({devices.length})
        </button>
        <button
          onClick={() => setActiveSubTab('employees')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
            activeSubTab === 'employees'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          👤 Employee Biometric Roster ({employees.length})
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
            activeSubTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          📋 Attendance Logs & Punch Sheet
        </button>
      </div>

      {/* --- SUB TAB 1: Biometric Box Devices --- */}
      {activeSubTab === 'devices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Connected Network Devices
            </h4>
            <button
              onClick={() => setShowAddDeviceModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <span>➕ Add Biometric Box</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((dev) => {
              const ping = pingStatus[dev.id];
              return (
                <div
                  key={dev.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 hover:border-indigo-500/50 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-2xl text-xl">
                        📟
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100">{dev.name}</h5>
                        <p className="text-xs text-slate-400">{dev.location}</p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        dev.status === 'online'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      ● {dev.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">IP Address</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{dev.ipAddress}:{dev.port}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Protocol</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">{dev.protocol}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Users Enrolled</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{dev.enrolledUsersCount} Users</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Stored Logs</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{dev.storedLogsCount} Records</span>
                    </div>
                  </div>

                  {ping && ping.result && (
                    <div
                      className={`text-xs p-2.5 rounded-xl font-medium ${
                        ping.success ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {ping.result}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleTestPing(dev)}
                      disabled={ping?.testing}
                      className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition"
                    >
                      {ping?.testing ? 'Pinging IP...' : '📡 Test Ping'}
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(dev.id, dev.name)}
                      className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- SUB TAB 2: Employee Roster --- */}
      {activeSubTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Staff Biometric User Registry
            </h4>
            <button
              onClick={() => setShowAddEmpModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <span>➕ Enroll New Employee</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-black text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Emp Code</th>
                    <th className="p-4">Staff Name</th>
                    <th className="p-4">Biometric ID</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Designation</th>
                    <th className="p-4">Shift Timings</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{emp.employeeCode}</td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{emp.name}</td>
                      <td className="p-4 font-mono font-bold">
                        <span className="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                          ID #{emp.biometricUserId}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{emp.department}</td>
                      <td className="p-4 text-slate-500">{emp.designation}</td>
                      <td className="p-4 text-slate-500">{emp.shiftTiming}</td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold">
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                          className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB TAB 3: Attendance Logs & Punch Sheet --- */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Controls & Filters Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Status Filter</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Early Exit">Early Exit</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Search Staff / ID</label>
                <input
                  type="text"
                  placeholder="Search name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none w-48"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowManualPunchModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                📝 Manual Punch
              </button>

              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-black text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Emp Code</th>
                    <th className="p-4">Staff Name</th>
                    <th className="p-4">Biometric ID</th>
                    <th className="p-4">In Time</th>
                    <th className="p-4">Out Time</th>
                    <th className="p-4">Device Name</th>
                    <th className="p-4">Verification</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400 italic">
                        No attendance logs found for selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono">{log.date}</td>
                        <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{log.employeeCode}</td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{log.employeeName}</td>
                        <td className="p-4 font-mono font-bold">#{log.biometricUserId}</td>
                        <td className="p-4 text-emerald-600 font-bold">{log.checkInTime}</td>
                        <td className="p-4 text-slate-500 font-bold">{log.checkOutTime || '--'}</td>
                        <td className="p-4 text-slate-500">{log.deviceName}</td>
                        <td className="p-4 text-slate-500">{log.verificationType}</td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              log.status === 'Present'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : log.status === 'Late'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1: Add Biometric Box Device --- */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add Biometric Box Device</h3>
            <form onSubmit={handleSaveDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Device Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Gate ZKTeco K40"
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">IP Address</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.201"
                    value={deviceForm.ipAddress}
                    onChange={(e) => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={deviceForm.port}
                    onChange={(e) => setDeviceForm({ ...deviceForm, port: parseInt(e.target.value) || 4370 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Protocol / Driver</label>
                <select
                  value={deviceForm.protocol}
                  onChange={(e) => setDeviceForm({ ...deviceForm, protocol: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                >
                  <option value="tcp_ip">TCP/IP SDK (ZKTeco / eSSL / Realtime - Port 4370)</option>
                  <option value="adms_push">ADMS Cloud Push Protocol</option>
                  <option value="usb_serial">USB / RS485 Serial Scanner</option>
                  <option value="http_webhook">HTTP Webhook Listener</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Device Location / Section</label>
                <input
                  type="text"
                  placeholder="Factory 1 - Packaging Line"
                  value={deviceForm.location}
                  onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDeviceModal(false)}
                  className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Save Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Add Employee --- */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Enroll Employee Biometric ID</h3>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Emp Code</label>
                  <input
                    type="text"
                    required
                    value={empForm.employeeCode}
                    onChange={(e) => setEmpForm({ ...empForm, employeeCode: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Biometric Punch ID</label>
                  <input
                    type="text"
                    required
                    value={empForm.biometricUserId}
                    onChange={(e) => setEmpForm({ ...empForm, biometricUserId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={empForm.department}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                  <input
                    type="text"
                    value={empForm.designation}
                    onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Manual Punch Entry --- */}
      {showManualPunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Manual Attendance Entry</h3>
            <form onSubmit={handleSaveManualPunch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Employee</label>
                <select
                  required
                  value={punchForm.employeeCode}
                  onChange={(e) => setPunchForm({ ...punchForm, employeeCode: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.employeeCode}>
                      {emp.name} ({emp.employeeCode} - ID #{emp.biometricUserId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">In Time</label>
                  <input
                    type="text"
                    value={punchForm.checkInTime}
                    onChange={(e) => setPunchForm({ ...punchForm, checkInTime: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Out Time</label>
                  <input
                    type="text"
                    value={punchForm.checkOutTime}
                    onChange={(e) => setPunchForm({ ...punchForm, checkOutTime: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  value={punchForm.notes}
                  onChange={(e) => setPunchForm({ ...punchForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualPunchModal(false)}
                  className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Save Punch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
