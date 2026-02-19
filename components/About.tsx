import React from 'react';
import { AppData } from '../types';

interface AboutProps {
  data: AppData;
}

const About: React.FC<AboutProps> = ({ data }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in zoom-in duration-500">
      <div className="bg-white rounded-[50px] shadow-2xl border border-slate-100 overflow-hidden text-center relative">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-50 rounded-full -ml-24 -mb-24 opacity-50"></div>

        <div className="p-12 relative z-10 flex flex-col items-center">
          <div className="mb-10">
            {data.business?.logo ? (
              <img 
                src={data.business.logo} 
                alt="Logo" 
                className="w-32 h-32 mx-auto bg-white p-4 rounded-[40px] shadow-xl border border-slate-100 object-contain" 
              />
            ) : (
              <div className="w-28 h-28 bg-indigo-600 rounded-[40px] flex items-center justify-center text-white text-4xl font-black shadow-2xl">
                AM
              </div>
            )}
          </div>

          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">
            AM Food Manager
          </h2>
          <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.4em] mb-8">
            Enterprise Management Suite
          </p>

          <div className="w-20 h-1.5 bg-slate-200 rounded-full mb-10"></div>

          <div className="space-y-6 max-w-lg text-slate-600 leading-relaxed font-medium">
            <p className="text-sm">
              A comprehensive offline business management ecosystem designed specifically for the food processing industry. Built to ensure data integrity, privacy, and rapid operations.
            </p>
            
            <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Architect & Lead Developer</p>
                <p className="text-2xl font-black text-slate-900 uppercase">Mr. Mahir</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Version</p>
                  <p className="text-sm font-black text-indigo-600">v2.1.0-PRO</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Build</p>
                  <p className="text-sm font-black text-indigo-600">2025.03.R4</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Core Technology Stack</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['PWA-READY', 'OFFLINE-FIRST', 'END-TO-END ENCRYPTION'].map(tech => (
                <span key={tech} className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[9px] font-black text-slate-500 uppercase">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-16 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            © 2025 A M Food Processing. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;