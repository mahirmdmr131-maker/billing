import React, { useState, useEffect } from 'react';
import { AppData } from '../types';
import { p2pSyncService, P2PSyncService, DiscoveredPeer, P2PSyncStats } from '../services/p2pSyncService';

interface P2PNetworkSyncProps {
  appData: AppData;
  onUpdateAppData: (newAppData: AppData) => void;
}

export const P2PNetworkSync: React.FC<P2PNetworkSyncProps> = ({ appData, onUpdateAppData }) => {
  const [stats, setStats] = useState<P2PSyncStats>({
    peersDiscovered: 0,
    activeConnections: 0,
    totalSyncedItems: 0,
    lastSyncTimestamp: null,
    status: 'idle',
    statusMessage: 'Ready for network discovery'
  });
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [deviceName, setDeviceName] = useState(p2pSyncService.getDeviceName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastNotification, setLastNotification] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  useEffect(() => {
    // Start network scan
    p2pSyncService.startScanning(() => appData);

    // Subscribe to stats
    const unsubStats = p2pSyncService.subscribeStats(setStats);
    // Subscribe to discovered peers
    const unsubPeers = p2pSyncService.subscribePeers(setPeers);

    // Subscribe to incoming peer data
    const unsubData = p2pSyncService.subscribeDataReceived((incomingData) => {
      const { mergedData, itemsMergedCount } = P2PSyncService.mergeAppData(appData, incomingData);
      if (itemsMergedCount > 0) {
        onUpdateAppData(mergedData);
        setLastNotification({
          type: 'success',
          text: `Merged ${itemsMergedCount} new record(s) from peer device!`
        });
      } else {
        setLastNotification({
          type: 'info',
          text: 'Data already up to date with peer device.'
        });
      }
    });

    return () => {
      unsubStats();
      unsubPeers();
      unsubData();
      p2pSyncService.stopScanning();
    };
  }, [appData, onUpdateAppData]);

  const handleDeviceNameSave = () => {
    p2pSyncService.setDeviceName(deviceName);
    setIsEditingName(false);
  };

  const handleManualScan = () => {
    p2pSyncService.startScanning(() => appData);
  };

  const handleSyncPeer = async (peer: DiscoveredPeer) => {
    setIsSyncing(true);
    const success = await p2pSyncService.connectToPeer(peer.id, () => appData);
    if (success) {
      setLastNotification({
        type: 'info',
        text: `Connected to ${peer.name}. Exchanging data...`
      });
    }
    setIsSyncing(false);
  };

  const handleSyncAll = () => {
    p2pSyncService.syncToAllPeers(appData);
    setLastNotification({
      type: 'info',
      text: 'Broadcasting local data synchronization to all discovered peers...'
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a10 10 0 0114.142 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              P2P Network Discovery & Local Sync
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                WebRTC / LAN mDNS
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detects other AM-Manager devices on your local network and syncs records seamlessly.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualScan}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <span>🔍 Scan Network</span>
          </button>
          <button
            onClick={handleSyncAll}
            disabled={peers.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5"
          >
            <span>⚡ Sync All Peers</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {lastNotification && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in ${
            lastNotification.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
          }`}
        >
          <span>{lastNotification.text}</span>
          <button onClick={() => setLastNotification(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Local Device Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">This Device Identity</span>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold"
                />
                <button
                  onClick={handleDeviceNameSave}
                  className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{deviceName}</span>
                <button onClick={() => setIsEditingName(true)} className="text-xs text-indigo-500 hover:underline">
                  ✏️ Edit
                </button>
              </div>
            )}
            <p className="text-[11px] font-mono text-slate-400">ID: {p2pSyncService.getDeviceId()}</p>
          </div>
          <div className="text-right">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Broadcasting</span>
          </div>
        </div>

        {/* Network Status metric */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">P2P Status</span>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize mt-1">
            {stats.statusMessage || stats.status}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats.lastSyncTimestamp ? `Last sync: ${new Date(stats.lastSyncTimestamp).toLocaleTimeString()}` : 'No sync in this session yet'}
          </div>
        </div>
      </div>

      {/* Discovered Peers List */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Discovered Local Peers ({peers.length})
          </h4>
          <span className="text-xs text-slate-500">
            {stats.activeConnections} active WebRTC channel(s)
          </span>
        </div>

        {peers.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Scanning local Wi-Fi / Ethernet network...</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Open AM-Manager on another laptop, tablet, or phone connected to the same Wi-Fi to auto-detect and sync data.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {peers.map((peer) => (
              <div
                key={peer.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:border-indigo-500/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${peer.connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">{peer.name}</h5>
                    <p className="text-[10px] font-mono text-slate-400">IP: {peer.ip} • ID: {peer.id.substring(0, 12)}...</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {peer.connected ? (
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      Connected
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold">
                      Available
                    </span>
                  )}

                  <button
                    onClick={() => handleSyncPeer(peer)}
                    disabled={isSyncing}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition"
                  >
                    Sync Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
