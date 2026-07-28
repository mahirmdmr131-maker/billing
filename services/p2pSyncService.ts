import { AppData, Sale, Product, Customer, Expense } from '../types';

export interface DiscoveredPeer {
  id: string;
  name: string;
  ip: string;
  port: number;
  lastSeen: number;
  connected?: boolean;
  syncing?: boolean;
  lastSyncTime?: number;
}

export interface P2PSyncStats {
  peersDiscovered: number;
  activeConnections: number;
  totalSyncedItems: number;
  lastSyncTimestamp: number | null;
  status: 'idle' | 'scanning' | 'connecting' | 'syncing' | 'connected' | 'error';
  statusMessage?: string;
}

// Generate persistent Device Peer ID
const getDeviceId = (): string => {
  let id = localStorage.getItem('am_p2p_device_id');
  if (!id) {
    id = 'node_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('am_p2p_device_id', id);
  }
  return id;
};

// Device display name
const getDeviceName = (): string => {
  let name = localStorage.getItem('am_p2p_device_name');
  if (!name) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const platform = isMobile ? 'Mobile' : 'Desktop';
    name = `AM-Manager ${platform} (${Math.floor(Math.random() * 900 + 100)})`;
    localStorage.setItem('am_p2p_device_name', name);
  }
  return name;
};

export class P2PSyncService {
  private deviceId: string = getDeviceId();
  private deviceName: string = getDeviceName();
  private peers: Map<string, DiscoveredPeer> = new Map();
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private pollInterval: any = null;
  private stats: P2PSyncStats = {
    peersDiscovered: 0,
    activeConnections: 0,
    totalSyncedItems: 0,
    lastSyncTimestamp: null,
    status: 'idle',
    statusMessage: 'Ready for local network P2P discovery'
  };

  private onStatsChangeCallbacks: Set<(stats: P2PSyncStats) => void> = new Set();
  private onPeersChangeCallbacks: Set<(peers: DiscoveredPeer[]) => void> = new Set();
  private onDataReceivedCallbacks: Set<(incomingData: Partial<AppData>) => void> = new Set();

  constructor() {
    this.initBroadcastChannel();
  }

  // Cross-tab broadcast channel for local peer simulation / multi-window sync
  private initBroadcastChannel() {
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('am_manager_p2p_channel');
        this.broadcastChannel.onmessage = (event) => {
          const { type, senderId, senderName, payload } = event.data || {};
          if (senderId === this.deviceId) return;

          if (type === 'PING') {
            this.handleLocalPing(senderId, senderName);
          } else if (type === 'PONG') {
            this.handleLocalPong(senderId, senderName);
          } else if (type === 'SYNC_DATA') {
            this.notifyDataReceived(payload);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel initialization skipped:', e);
    }
  }

  // Start continuous network scanning & peer announcement
  public startScanning(currentAppDataSupplier?: () => AppData) {
    this.updateStats({ status: 'scanning', statusMessage: 'Scanning local network for AM-Manager peers...' });

    // Announce immediately
    this.announcePresence();

    // Broadcast local tab presence
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'PING',
        senderId: this.deviceId,
        senderName: this.deviceName
      });
    }

    // Interval poll (every 10 seconds)
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      await this.announcePresence();
      await this.fetchNetworkPeers();
      await this.pollSignals(currentAppDataSupplier);
    }, 10000);

    // Initial fetch
    this.fetchNetworkPeers();
  }

  public stopScanning() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.updateStats({ status: 'idle', statusMessage: 'Network scanning paused' });
  }

  // Announce this node to local backend signal hub
  private async announcePresence() {
    try {
      await fetch('/api/p2p/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.deviceId,
          name: this.deviceName
        })
      });
    } catch (err) {
      // Background ping silently fails if offline
    }
  }

  // Fetch all active peers on network
  private async fetchNetworkPeers() {
    try {
      const res = await fetch('/api/p2p/peers');
      if (res.ok) {
        const data = await res.json();
        const peerList: any[] = data.peers || [];

        peerList.forEach((p) => {
          if (p.id !== this.deviceId) {
            const existing = this.peers.get(p.id) || {
              id: p.id,
              name: p.name,
              ip: p.ip,
              port: p.port,
              lastSeen: p.lastSeen,
              connected: false
            };
            existing.lastSeen = p.lastSeen;
            existing.name = p.name;
            this.peers.set(p.id, existing);
          }
        });

        this.notifyPeersChanged();
        this.updateStats({
          peersDiscovered: this.peers.size,
          status: this.peers.size > 0 ? 'connected' : 'scanning',
          statusMessage: this.peers.size > 0 ? `Discovered ${this.peers.size} local peer(s)` : 'Scanning local network...'
        });
      }
    } catch (err) {
      // Fallback
    }
  }

  // Check incoming WebRTC signals
  private async pollSignals(currentAppDataSupplier?: () => AppData) {
    try {
      const res = await fetch(`/api/p2p/signals/${this.deviceId}`);
      if (res.ok) {
        const signals = await res.json();

        // Handle WebRTC Offer
        if (signals.offer && signals.offer.senderId) {
          const { senderId, sdp } = signals.offer;
          await this.handleIncomingOffer(senderId, sdp, currentAppDataSupplier);
        }

        // Handle Answers
        if (signals.answers) {
          for (const [senderId, answerSdp] of Object.entries(signals.answers)) {
            const pc = this.peerConnections.get(senderId);
            if (pc && pc.signalingState !== 'stable') {
              await pc.setRemoteDescription(new RTCSessionDescription(answerSdp as any));
            }
          }
        }
      }
    } catch (err) {
      // Signal polling error silently handled
    }
  }

  // WebRTC Connect to a target peer
  public async connectToPeer(targetPeerId: string, getAppData: () => AppData): Promise<boolean> {
    try {
      this.updateStats({ status: 'connecting', statusMessage: `Initiating WebRTC P2P channel to ${targetPeerId}...` });

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      this.peerConnections.set(targetPeerId, pc);

      // Create WebRTC DataChannel
      const dc = pc.createDataChannel('am_p2p_data', { ordered: true });
      this.setupDataChannelHandlers(dc, targetPeerId, getAppData);

      // Handle ICE Candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await fetch('/api/p2p/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senderId: this.deviceId,
              targetId: targetPeerId,
              type: 'candidate',
              data: event.candidate
            })
          });
        }
      };

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Relay Offer
      await fetch('/api/p2p/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.deviceId,
          targetId: targetPeerId,
          type: 'offer',
          data: offer
        })
      });

      // Also trigger HTTP Fallback sync if WebRTC DataChannel takes too long
      setTimeout(() => {
        if (dc.readyState !== 'open') {
          console.log('WebRTC DataChannel connection pending, executing HTTP local sync fallback');
          this.triggerHttpFallbackSync(targetPeerId, getAppData());
        }
      }, 3000);

      return true;
    } catch (err: any) {
      console.error('WebRTC P2P Connection error:', err);
      this.updateStats({ status: 'error', statusMessage: `Connection failed: ${err.message}` });
      return false;
    }
  }

  // Handle incoming WebRTC offer from another peer
  private async handleIncomingOffer(senderId: string, offerSdp: any, getAppData?: () => AppData) {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      this.peerConnections.set(senderId, pc);

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        this.setupDataChannelHandlers(dc, senderId, getAppData);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch('/api/p2p/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.deviceId,
          targetId: senderId,
          type: 'answer',
          data: answer
        })
      });
    } catch (err) {
      console.error('Error handling WebRTC offer:', err);
    }
  }

  // Attach handlers to WebRTC DataChannel
  private setupDataChannelHandlers(dc: RTCDataChannel, peerId: string, getAppData?: () => AppData) {
    this.dataChannels.set(peerId, dc);

    dc.onopen = () => {
      console.log(`P2P DataChannel connected to ${peerId}`);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.connected = true;
        this.notifyPeersChanged();
      }

      this.updateStats({
        activeConnections: this.dataChannels.size,
        status: 'connected',
        statusMessage: `Connected directly via WebRTC DataChannel to peer`
      });

      // Automatically send local AppData for synchronization
      if (getAppData) {
        this.sendSyncPayloadToDataChannel(dc, getAppData());
      }
    };

    dc.onclose = () => {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.connected = false;
        this.notifyPeersChanged();
      }
      this.dataChannels.delete(peerId);
      this.updateStats({ activeConnections: this.dataChannels.size });
    };

    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'SYNC_DATA' && message.payload) {
          this.notifyDataReceived(message.payload);
          this.updateStats({
            lastSyncTimestamp: Date.now(),
            statusMessage: `Successfully synchronized data with peer via P2P channel!`
          });
        }
      } catch (e) {
        console.error('DataChannel message parse error:', e);
      }
    };
  }

  // Send local AppData over DataChannel
  private sendSyncPayloadToDataChannel(dc: RTCDataChannel, appData: AppData) {
    if (dc.readyState === 'open') {
      dc.send(
        JSON.stringify({
          type: 'SYNC_DATA',
          senderId: this.deviceId,
          senderName: this.deviceName,
          timestamp: Date.now(),
          payload: {
            sales: appData.sales || [],
            products: appData.products || [],
            customers: appData.customers || [],
            expenses: appData.expenses || [],
            futureOrders: appData.futureOrders || []
          }
        })
      );
    }
  }

  // HTTP Direct Sync Fallback
  private async triggerHttpFallbackSync(targetPeerId: string, localData: AppData) {
    try {
      this.updateStats({ status: 'syncing', statusMessage: 'Synchronizing payload over local HTTP tunnel...' });

      // Send local data
      const res = await fetch('/api/p2p/sync-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.deviceId,
          targetId: targetPeerId,
          timestamp: Date.now(),
          data: {
            sales: localData.sales,
            products: localData.products,
            customers: localData.customers,
            expenses: localData.expenses
          }
        })
      });

      if (res.ok) {
        // Broadcast across local broadcast channel as well
        if (this.broadcastChannel) {
          this.broadcastChannel.postMessage({
            type: 'SYNC_DATA',
            senderId: this.deviceId,
            senderName: this.deviceName,
            payload: {
              sales: localData.sales,
              products: localData.products,
              customers: localData.customers,
              expenses: localData.expenses
            }
          });
        }

        const peer = this.peers.get(targetPeerId);
        if (peer) {
          peer.lastSyncTime = Date.now();
          this.notifyPeersChanged();
        }

        this.updateStats({
          lastSyncTimestamp: Date.now(),
          status: 'connected',
          statusMessage: 'P2P Data Synchronization complete!'
        });
      }
    } catch (err: any) {
      console.error('HTTP Sync Fallback failed:', err);
    }
  }

  // Sync to all discovered peers
  public syncToAllPeers(localData: AppData) {
    this.peers.forEach((peer) => {
      const dc = this.dataChannels.get(peer.id);
      if (dc && dc.readyState === 'open') {
        this.sendSyncPayloadToDataChannel(dc, localData);
      } else {
        this.connectToPeer(peer.id, () => localData);
      }
    });

    // Also broadcast tab-to-tab
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC_DATA',
        senderId: this.deviceId,
        senderName: this.deviceName,
        payload: {
          sales: localData.sales,
          products: localData.products,
          customers: localData.customers,
          expenses: localData.expenses
        }
      });
    }
  }

  // Handle local broadcast ping
  private handleLocalPing(senderId: string, senderName: string) {
    this.peers.set(senderId, {
      id: senderId,
      name: senderName || 'Local AM-Manager Tab',
      ip: '127.0.0.1',
      port: 3000,
      lastSeen: Date.now(),
      connected: true
    });
    this.notifyPeersChanged();

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'PONG',
        senderId: this.deviceId,
        senderName: this.deviceName
      });
    }
  }

  private handleLocalPong(senderId: string, senderName: string) {
    this.peers.set(senderId, {
      id: senderId,
      name: senderName || 'Local AM-Manager Tab',
      ip: '127.0.0.1',
      port: 3000,
      lastSeen: Date.now(),
      connected: true
    });
    this.notifyPeersChanged();
  }

  // Merge external incoming AppData into local AppData safely
  public static mergeAppData(local: AppData, incoming: Partial<AppData>): { mergedData: AppData; itemsMergedCount: number } {
    let itemsMergedCount = 0;

    // 1. Merge Sales
    const existingSaleIds = new Set(local.sales.map((s) => s.id));
    const newSales: Sale[] = [];
    if (incoming.sales) {
      incoming.sales.forEach((s) => {
        if (!existingSaleIds.has(s.id)) {
          newSales.push(s);
          itemsMergedCount++;
        }
      });
    }

    // 2. Merge Products
    const existingProductIds = new Set(local.products.map((p) => p.id));
    const newProducts: Product[] = [];
    if (incoming.products) {
      incoming.products.forEach((p) => {
        if (!existingProductIds.has(p.id)) {
          newProducts.push(p);
          itemsMergedCount++;
        }
      });
    }

    // 3. Merge Customers
    const existingCustomerIds = new Set(local.customers.map((c) => c.id));
    const newCustomers: Customer[] = [];
    if (incoming.customers) {
      incoming.customers.forEach((c) => {
        if (!existingCustomerIds.has(c.id)) {
          newCustomers.push(c);
          itemsMergedCount++;
        }
      });
    }

    // 4. Merge Expenses
    const existingExpenseIds = new Set(local.expenses.map((e) => e.id));
    const newExpenses: Expense[] = [];
    if (incoming.expenses) {
      incoming.expenses.forEach((e) => {
        if (!existingExpenseIds.has(e.id)) {
          newExpenses.push(e);
          itemsMergedCount++;
        }
      });
    }

    const mergedData: AppData = {
      ...local,
      sales: [...newSales, ...local.sales],
      products: [...newProducts, ...local.products],
      customers: [...newCustomers, ...local.customers],
      expenses: [...newExpenses, ...local.expenses]
    };

    return { mergedData, itemsMergedCount };
  }

  // Listener subscriptions
  public subscribeStats(cb: (stats: P2PSyncStats) => void) {
    this.onStatsChangeCallbacks.add(cb);
    cb(this.stats);
    return () => this.onStatsChangeCallbacks.delete(cb);
  }

  public subscribePeers(cb: (peers: DiscoveredPeer[]) => void) {
    this.onPeersChangeCallbacks.add(cb);
    cb(Array.from(this.peers.values()));
    return () => this.onPeersChangeCallbacks.delete(cb);
  }

  public subscribeDataReceived(cb: (data: Partial<AppData>) => void) {
    this.onDataReceivedCallbacks.add(cb);
    return () => this.onDataReceivedCallbacks.delete(cb);
  }

  private updateStats(partial: Partial<P2PSyncStats>) {
    this.stats = { ...this.stats, ...partial };
    this.onStatsChangeCallbacks.forEach((cb) => cb(this.stats));
  }

  private notifyPeersChanged() {
    const list = Array.from(this.peers.values());
    this.onPeersChangeCallbacks.forEach((cb) => cb(list));
  }

  private notifyDataReceived(incoming: Partial<AppData>) {
    this.onDataReceivedCallbacks.forEach((cb) => cb(incoming));
  }

  // Getters & Setters
  public getDeviceId() {
    return this.deviceId;
  }

  public getDeviceName() {
    return this.deviceName;
  }

  public setDeviceName(newName: string) {
    this.deviceName = newName;
    localStorage.setItem('am_p2p_device_name', newName);
    this.announcePresence();
  }
}

export const p2pSyncService = new P2PSyncService();
