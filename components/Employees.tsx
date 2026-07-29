import React, { useState, useMemo } from 'react';
import { AppData, User } from '../types';
import { IconUser, IconAdd } from './Icons';

interface EmployeesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const Employees: React.FC<EmployeesProps> = ({ data, updateData }) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'payroll'>('employees');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    phone: '',
    role: 'staff' as 'admin' | 'staff'
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) return;
    
    // In a real app we'd hash the password properly. For this MVP we just store it or mock it.
    const newUser: User = {
      id: crypto.randomUUID(),
      username: formData.username,
      passwordHash: formData.password, // Storing raw for MVP, normally hash
      phone: formData.phone,
      role: formData.role,
      createdAt: new Date().toISOString()
    };

    updateData(prev => ({
      ...prev,
      users: [...prev.users, newUser]
    }));
    
    setShowAddForm(false);
    setFormData({ username: '', password: '', phone: '', role: 'staff' });
  };

  const removeUser = (id: string) => {
    if (confirm("Are you sure you want to remove this employee?")) {
      updateData(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== id)
      }));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Human Resources</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manage Employees & Payroll</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['employees', 'attendance', 'payroll'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'employees' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Team Directory</h3>
            <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center space-x-2">
              <IconAdd className="w-4 h-4" /><span>Add Employee</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.users.map(user => (
              <div key={user.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-black text-xl uppercase">
                      {user.username.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800">{user.username}</h4>
                      <p className="text-xs text-slate-500 font-medium">{user.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {user.role}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-xs transition-all">
                    Edit Role
                  </button>
                  {user.id !== data.currentUser?.id && (
                    <button onClick={() => removeUser(user.id)} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs transition-all">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showAddForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8">
                <h3 className="text-xl font-black mb-6">New Employee</h3>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Username</label>
                    <input type="text" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Password / PIN</label>
                    <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Mobile Number</label>
                    <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Access Role</label>
                    <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase text-xs tracking-widest">
                      <option value="staff">Staff (Limited Access)</option>
                      <option value="admin">Admin (Full Access)</option>
                    </select>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl">Cancel</button>
                    <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg">Save User</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="font-bold text-slate-700">Daily Attendance</h3>
            <div className="flex items-center space-x-2">
              <input type="date" value={new Date().toISOString().split('T')[0]} readOnly className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Employee</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Check In</th>
                  <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Check Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.users.map(user => {
                  const today = new Date().toISOString().split('T')[0];
                  const record = (data.attendance || []).find(a => a.userId === user.id && a.date === today);
                  const status = record?.status || 'Absent';
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{user.username}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{user.role}</p>
                      </td>
                      <td className="p-4 text-center">
                        <select 
                          value={status}
                          onChange={e => {
                            const newStatus = e.target.value as any;
                            const newRecord = {
                              id: record?.id || crypto.randomUUID(),
                              userId: user.id,
                              date: today,
                              status: newStatus,
                              checkIn: newStatus === 'Present' ? (record?.checkIn || new Date().toLocaleTimeString('en-US', { hour12: false })) : undefined
                            };
                            updateData(prev => {
                              const otherRecords = (prev.attendance || []).filter(a => a.id !== newRecord.id);
                              return { ...prev, attendance: [...otherRecords, newRecord] };
                            });
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest outline-none border-none cursor-pointer ${status === 'Present' ? 'bg-emerald-100 text-emerald-700' : status === 'Absent' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}
                        >
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                          <option value="Half-Day">Half-Day</option>
                          <option value="Leave">Leave</option>
                        </select>
                      </td>
                      <td className="p-4 text-center text-sm font-medium text-slate-500">{record?.checkIn || '-'}</td>
                      <td className="p-4 text-center text-sm font-medium text-slate-500">
                        {record?.checkOut ? record.checkOut : (status === 'Present' ? (
                           <button onClick={() => {
                             updateData(prev => {
                               const records = prev.attendance || [];
                               const newRecords = records.map(r => r.id === record?.id ? {...r, checkOut: new Date().toLocaleTimeString('en-US', { hour12: false })} : r);
                               return { ...prev, attendance: newRecords };
                             });
                           }} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-lg font-bold">Checkout</button>
                        ) : '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.users.map(user => {
              const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
              const record = (data.payroll || []).find(p => p.userId === user.id && p.month === currentMonth);
              const baseSalary = record?.baseSalary || 0;
              const bonus = record?.bonus || 0;
              const deductions = record?.deductions || 0;
              const netPay = record?.netPay || 0;
              const status = record?.status || 'Pending';

              return (
                <div key={user.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="font-black text-slate-800 text-lg">{user.username}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentMonth}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {status}
                    </span>
                  </div>
                  
                  {status === 'Pending' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Base (₹)</label>
                          <input type="number" defaultValue={baseSalary} onBlur={e => {
                            const val = Number(e.target.value);
                            updateData(prev => {
                               const payroll = prev.payroll || [];
                               const existing = payroll.find(p => p.userId === user.id && p.month === currentMonth);
                               const newRecord = existing ? { ...existing, baseSalary: val, netPay: val + (existing.bonus||0) - (existing.deductions||0) } : { id: crypto.randomUUID(), userId: user.id, month: currentMonth, baseSalary: val, bonus: 0, deductions: 0, netPay: val, status: 'Pending' as any };
                               return { ...prev, payroll: [...payroll.filter(p => p.id !== existing?.id), newRecord] };
                            });
                          }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bonus (₹)</label>
                          <input type="number" defaultValue={bonus} onBlur={e => {
                            const val = Number(e.target.value);
                            updateData(prev => {
                               const payroll = prev.payroll || [];
                               const existing = payroll.find(p => p.userId === user.id && p.month === currentMonth);
                               if(!existing) return prev;
                               const newRecord = { ...existing, bonus: val, netPay: existing.baseSalary + val - existing.deductions };
                               return { ...prev, payroll: [...payroll.filter(p => p.id !== existing.id), newRecord] };
                            });
                          }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none text-emerald-600" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deduct (₹)</label>
                          <input type="number" defaultValue={deductions} onBlur={e => {
                            const val = Number(e.target.value);
                            updateData(prev => {
                               const payroll = prev.payroll || [];
                               const existing = payroll.find(p => p.userId === user.id && p.month === currentMonth);
                               if(!existing) return prev;
                               const newRecord = { ...existing, deductions: val, netPay: existing.baseSalary + existing.bonus - val };
                               return { ...prev, payroll: [...payroll.filter(p => p.id !== existing.id), newRecord] };
                            });
                          }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none text-rose-600" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Pay (₹)</label>
                          <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-black text-sm text-indigo-600">{netPay.toLocaleString()}</div>
                        </div>
                      </div>
                      
                      <button onClick={() => {
                         updateData(prev => {
                           const payroll = prev.payroll || [];
                           const existing = payroll.find(p => p.userId === user.id && p.month === currentMonth);
                           if(!existing) return prev;
                           const newRecord = { ...existing, status: 'Paid' as any, paidAt: new Date().toISOString() };
                           return { ...prev, payroll: [...payroll.filter(p => p.id !== existing.id), newRecord] };
                         });
                      }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md">
                        Mark as Paid
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500">Net Salary Paid</span>
                        <span className="font-black text-emerald-600">₹{netPay.toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                        Paid on {new Date(record?.paidAt || '').toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
