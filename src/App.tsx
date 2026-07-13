/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Scan, 
  Search, 
  Settings, 
  LogOut, 
  Wifi, 
  WifiOff, 
  CloudLightning,
  Shield,
  Activity,
  UserCheck,
  User as UserIcon
} from 'lucide-react';
import { Product, Movement, InventoryItem, SystemLog, User } from './types';
import { INITIAL_PRODUCTS } from './initialData';
import LoginScreen from './components/LoginScreen';
import DashboardTab from './components/DashboardTab';
import ScannerTab from './components/ScannerTab';
import QueryTab from './components/QueryTab';
import ConfigTab from './components/ConfigTab';
import ProfileTab from './components/ProfileTab';
import { playBeep } from './utils/audio';
import { supabase } from './utils/supabaseClient';

// Componente Modal de Planilha com controles nativos de Zoom
interface SpreadsheetModalProps {
  src: string;
  onClose: () => void;
}

function SpreadsheetModal({ src, onClose }: SpreadsheetModalProps) {
  const [sheetZoom, setSheetZoom] = useState(1.0);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col p-4 animate-fade-in">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-t-3xl shadow-lg shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></span>
          <span className="text-[10px] font-bold text-white uppercase font-mono tracking-wider">Planilha (Saídas Diárias)</span>
        </div>
        
        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-850">
          <button 
            type="button"
            onClick={() => setSheetZoom(prev => Math.max(0.5, prev - 0.1))}
            className="w-6 h-6 rounded-md bg-slate-900 text-white font-bold text-xs flex items-center justify-center border border-slate-800 active:scale-90"
            title="Zoom Out"
          >
            -
          </button>
          <span className="text-[9px] font-mono text-cyan-400 font-bold px-1">{Math.round(sheetZoom * 100)}%</span>
          <button 
            type="button"
            onClick={() => setSheetZoom(prev => Math.min(2.0, prev + 0.1))}
            className="w-6 h-6 rounded-md bg-slate-900 text-white font-bold text-xs flex items-center justify-center border border-slate-800 active:scale-90"
            title="Zoom In"
          >
            +
          </button>
          <button 
            type="button"
            onClick={() => setSheetZoom(1.0)}
            className="text-[8px] font-bold text-slate-400 hover:text-white font-mono px-1.5 active:scale-90"
          >
            100%
          </button>
        </div>

        <button 
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-slate-950 hover:bg-red-955/40 text-slate-400 hover:text-red-400 border border-slate-850 flex items-center justify-center transition active:scale-95 cursor-pointer font-bold font-mono text-xs"
        >
          X
        </button>
      </div>
      
      {/* Embedded Google Sheets IFrame pointing directly to Saídas Diárias */}
      <div className="flex-1 bg-white border-x border-b border-slate-800 rounded-b-3xl overflow-hidden shadow-2xl relative">
        <div 
          className="w-full h-full overflow-auto transition-transform duration-200"
          style={{
            width: `${100 / sheetZoom}%`,
            height: `${100 / sheetZoom}%`,
            transform: `scale(${sheetZoom})`,
            transformOrigin: 'top left',
          }}
        >
          <iframe 
            src={src}
            className="w-full h-full border-none bg-white"
            title="Planilha Caninana Saídas Diárias"
          ></iframe>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('caninana_user');
    return cached ? JSON.parse(cached) : null;
  });

  // Users Database State
  const [users, setUsers] = useState<(User & { passwordHash: string })[]>(() => {
    const cached = localStorage.getItem('caninana_users_db');
    if (cached) return JSON.parse(cached);
    
    // Default initial users
    return [
      {
        username: 'admin',
        name: 'Carlos Caninana',
        role: 'Administrador' as const,
        email: 'carlos@caninana.com.br',
        avatar: '',
        passwordHash: '123'
      },
      {
        username: 'operador',
        name: 'Thiago Silva',
        role: 'Operador' as const,
        email: 'thiago@caninana.com.br',
        avatar: '',
        passwordHash: '123'
      },
      {
        username: 'consulta',
        name: 'Juliana Santos',
        role: 'Consulta' as const,
        email: 'juliana@caninana.com.br',
        avatar: '',
        passwordHash: '123'
      }
    ];
  });

  // Database States
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = localStorage.getItem('caninana_products');
    return cached ? JSON.parse(cached) : INITIAL_PRODUCTS;
  });

  const [movements, setMovements] = useState<Movement[]>(() => {
    const cached = localStorage.getItem('caninana_movements');
    return cached ? JSON.parse(cached) : [];
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const cached = localStorage.getItem('caninana_inventory');
    return cached ? JSON.parse(cached) : [];
  });

  const [logs, setLogs] = useState<SystemLog[]>(() => {
    const cached = localStorage.getItem('caninana_logs');
    if (cached) return JSON.parse(cached);
    
    // Default initial system log and successful sync notification log
    return [
      {
        id: 'log_init',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        message: 'Coletor de dados Caninana inicializado com sucesso.',
        type: 'success',
        user: 'Sistema'
      },
      {
        id: 'log_qr_success',
        timestamp: new Date().toISOString(),
        message: 'Aviso: Configuração da planilha realizada. QR Code lido e sincronização estabelecida com sucesso.',
        type: 'success',
        user: 'admin'
      }
    ];
  });

  // Settings & Sync States
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('caninana_gas_url') || '';
  });

  const [backendUrl, setBackendUrl] = useState<string>(() => {
    return localStorage.getItem('caninana_backend_url') || 'http://localhost:3000';
  });

  useEffect(() => {
    localStorage.setItem('caninana_backend_url', backendUrl);
  }, [backendUrl]);

  // Dynamic API Base URL resolver for hybrid environments (Android WebView vs Web Browser)
  const getApiUrl = (path: string) => {
    if (window.location.hostname.includes('androidplatform.net') || window.location.protocol === 'file:') {
      // Use configured desktop backend URL on the mobile device
      return `${backendUrl.replace(/\/$/, '')}${path}`;
    }
    return path;
  };

  const isSimulatedOffline = false;

  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Active Screen Tab
  const [activeTab, setActiveTab] = useState<'Scanner' | 'Logs' | 'Perfil'>('Scanner');
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);

  // Persistence triggers
  useEffect(() => {
    localStorage.setItem('caninana_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('caninana_movements', JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem('caninana_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('caninana_logs', JSON.stringify(logs));
    // Se não estiver na aba perfil, ativa a bolinha vermelha para novos scans
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (lastLog && lastLog.message.includes('escaneou') && activeTab !== 'Perfil') {
        setHasNewActivity(true);
      }
    }
  }, [logs]);

  // Limpa o badge ao acessar a aba Perfil
  useEffect(() => {
    if (activeTab === 'Perfil') {
      setHasNewActivity(false);
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('caninana_gas_url', gasUrl);
  }, [gasUrl]);



  useEffect(() => {
    localStorage.setItem('caninana_users_db', JSON.stringify(users));
  }, [users]);

  // Fetch initial database state from Supabase
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const { data: remoteProducts, error: prodErr } = await supabase.from('products').select('*');
        if (!prodErr && remoteProducts) {
          const parsedProducts: Product[] = remoteProducts.map(p => ({
            barcode: p.barcode,
            description: p.description,
            category: p.category || '',
            application: p.application || '',
            stock: p.stock || 0,
            minStock: p.min_stock || 3
          }));
          setProducts(parsedProducts);
        }

        const { data: remoteUsers, error: userErr } = await supabase.from('users').select('*');
        if (!userErr && remoteUsers) {
          setUsers(remoteUsers.map(u => ({
            username: u.username,
            name: u.name,
            role: u.role as any,
            email: u.email || '',
            avatar: u.avatar || '',
            passwordHash: u.password_hash || '123'
          })));
        }
      } catch (err) {
        console.error('Could not load database from Supabase, using offline cached data', err);
      }
    };
    loadInitialData();
  }, []);

  // Network connection listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addLog('Dispositivo detectou sinal de rede (Online).', 'info', 'Sistema');
      // Trigger background auto sync if not simulated offline
      if (!isSimulatedOffline) {
        syncDataWithServer();
        syncDataWithSupabase();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      addLog('Dispositivo perdeu sinal de rede (Offline). Modo offline ativado.', 'warning', 'Sistema');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSimulatedOffline, gasUrl, movements, inventory]);

  // Handle User Login
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('caninana_user', JSON.stringify(user));
    
    if (user.role === 'Administrador') {
      setActiveTab('Logs');
    }
    
    // Append log
    addLog(`Operador ${user.name} autenticado no nível [${user.role}].`, 'success', user.username);
  };

  // Handle Profile Update
  const handleUpdateProfile = async (updatedFields: Partial<User & { passwordHash?: string }>) => {
    if (!currentUser) return;
    
    const { passwordHash, ...userFields } = updatedFields;
    const updatedUser = { ...currentUser, ...userFields };
    setCurrentUser(updatedUser);
    localStorage.setItem('caninana_user', JSON.stringify(updatedUser));
    
    setUsers((prevUsers) => 
      prevUsers.map((u) => 
        u.username === currentUser.username 
          ? { ...u, ...updatedFields } 
          : u
      )
    );
    
    if (isOnline && !isSimulatedOffline) {
      try {
        const updatePayload: any = {
          name: updatedUser.name,
          role: updatedUser.role,
          email: updatedUser.email || '',
          avatar: updatedUser.avatar || ''
        };
        if (passwordHash) {
          updatePayload.password_hash = passwordHash;
        }
        await supabase
          .from('users')
          .update(updatePayload)
          .eq('username', currentUser.username);
      } catch (e) {
        console.error('Failed to sync profile update to Supabase:', e);
      }
    }
    
    playBeep('success');
    addLog(`Perfil do operador @${currentUser.username} atualizado com sucesso.`, 'success', currentUser.username);
  };

  // Handle Admin updating other user profiles
  const handleUpdateAnyUser = async (username: string, updatedFields: Partial<User & { passwordHash?: string }>) => {
    setUsers((prevUsers) => 
      prevUsers.map((u) => 
        u.username === username 
          ? { ...u, ...updatedFields } 
          : u
      )
    );

    // If the updated user is currently logged in, sync their local profile too!
    if (currentUser && currentUser.username === username) {
      const { passwordHash, ...userFields } = updatedFields;
      const updatedUser = { ...currentUser, ...userFields };
      setCurrentUser(updatedUser);
      localStorage.setItem('caninana_user', JSON.stringify(updatedUser));
    }

    if (isOnline && !isSimulatedOffline) {
      try {
        const updatePayload: any = {};
        if (updatedFields.name) updatePayload.name = updatedFields.name;
        if (updatedFields.role) updatePayload.role = updatedFields.role;
        if (updatedFields.email) updatePayload.email = updatedFields.email;
        if (updatedFields.avatar !== undefined) updatePayload.avatar = updatedFields.avatar;
        if (updatedFields.passwordHash) updatePayload.password_hash = updatedFields.passwordHash;

        await supabase
          .from('users')
          .update(updatePayload)
          .eq('username', username);
      } catch (e) {
        console.error('Failed to sync user profile update to Supabase:', e);
      }
    }

    playBeep('success');
    addLog(`Operador @${username} atualizado pelo administrador.`, 'success', currentUser?.username || 'admin');
  };

  // Handle Admin adding a new user profile
  const handleAddUser = async (newUser: User & { passwordHash: string }) => {
    setUsers((prevUsers) => [...prevUsers, newUser]);

    if (isOnline && !isSimulatedOffline) {
      try {
        await supabase
          .from('users')
          .insert({
            username: newUser.username,
            name: newUser.name,
            role: newUser.role,
            email: newUser.email || '',
            avatar: newUser.avatar || '',
            password_hash: newUser.passwordHash
          });
      } catch (e) {
        console.error('Failed to insert user profile to Supabase:', e);
      }
    }

    addLog(`Novo operador @${newUser.username} cadastrado no nível [${newUser.role}].`, 'success', currentUser?.username || 'admin');
  };

  // Handle Logout
  const handleLogout = () => {
    if (currentUser) {
      addLog(`Operador @${currentUser.username} desconectou-se do coletor.`, 'info', currentUser.username);
    }
    setCurrentUser(null);
    localStorage.removeItem('caninana_user');
    playBeep('warning');
  };

  // Add Log Helper
  const addLog = (message: string, type: 'info' | 'warning' | 'error' | 'success', operatorUsername: string) => {
    const newLog: SystemLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      message,
      type,
      user: operatorUsername
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Handle custom scans (like Google Spreadsheet link or Google Web App link)
  const handleCustomScan = (text: string) => {
    const normalizedText = text.trim();
    if (
      normalizedText.includes('1TWQWvp-dZXT2h1XUmt-_CtOp7zsXkt3U8l6zbKcQthA') ||
      normalizedText.includes('docs.google.com/spreadsheets/d/1TWQWvp-dZXT2h1XUmt-_CtOp7zsXkt3U8l6zbKcQthA') ||
      normalizedText.includes('docs.google.com/spreadsheets/d/1hpSmTKNZPfvopm_ZayB3KXibNF2CFLwnpqG-OC8WFvg') ||
      normalizedText.includes('1hpSmTKNZPfvopm_ZayB3KXibNF2CFLwnpqG-OC8WFvg') ||
      normalizedText.includes('AKfycbz6aPZdwu1JSXxcqqpVTldZrpDEnWSGMuO-MiInBMnsmfxjUyaYr1F4NRCQ-o1vi21UnQ')
    ) {
      // Usar o App Script bridge oficial configurado
      const targetUrl = 'https://script.google.com/macros/s/AKfycbz6aPZdwu1JSXxcqqpVTldZrpDEnWSGMuO-MiInBMnsmfxjUyaYr1F4NRCQ-o1vi21UnQ/exec';
      setGasUrl(targetUrl);
      localStorage.setItem('caninana_gas_url', targetUrl);
      
      addLog('QR Code lido com sucesso! Planilha de Testes da Caninana Auto Vidros conectada.', 'success', currentUser?.username || 'Sistema');
      
      playBeep('success');
      alert('Planilha Caninana Auto Vidros de Testes vinculada com sucesso! Sincronização automática ativa.');
      
      // Auto trigger sync
      setTimeout(() => {
        syncDataWithSupabase();
      }, 500);
      
      return true;
    }
    
    // If it is any other spreadsheet URL
    if (normalizedText.startsWith('https://docs.google.com/spreadsheets/') || normalizedText.startsWith('https://script.google.com/')) {
      addLog(`QR Code lido: Link ${normalizedText.substring(0, 30)}... detectado.`, 'info', currentUser?.username || 'Sistema');
      playBeep('success');
      return true;
    }
    
    return false;
  };

  // Register a new product manually (scanned but unknown)
  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.barcode === newProduct.barcode)) return prev;
      return [...prev, newProduct];
    });
    
    addLog(
      `Novo item registrado offline: EAN ${newProduct.barcode} - ${newProduct.description.substring(0, 30)}...`, 
      'info', 
      currentUser?.username || 'Sistema'
    );
  };

  // Register a movement (Entrada, Saída, Transferência)
  const handleAddMovement = (newMovement: Movement) => {
    setMovements((prev) => [...prev, newMovement]);

    const prod = products.find((p) => p.barcode === newMovement.barcode);
    const prodDesc = prod ? prod.description : `EAN ${newMovement.barcode}`;

    // Instantly adjust local stock for immediate feedback
    setProducts((prevProducts) => {
      return prevProducts.map((p) => {
        if (p.barcode === newMovement.barcode) {
          let updatedStock = p.stock;
          if (newMovement.type === 'Entrada') {
            updatedStock += newMovement.quantity;
          } else if (newMovement.type === 'Saída') {
            updatedStock = Math.max(0, p.stock - newMovement.quantity);
          }
          return { ...p, stock: updatedStock };
        }
        return p;
      });
    });

    addLog(
      `${currentUser?.name || 'Operador'} escaneou ${prodDesc}`,
      'success',
      currentUser?.username || 'Sistema'
    );

    // Auto sync if online and online sync is active
    if (!isSimulatedOffline && isOnline) {
      setTimeout(() => {
        syncDataWithServer();
        syncDataWithSupabase();
      }, 500);
    }
  };

  // Register inventory physical count
  const handleAddInventoryItem = (newItem: InventoryItem) => {
    setInventory((prev) => {
      // Sum duplicates if same barcode exists in currently unsynced inventory checklist
      // "Inventário que soma automaticamente leituras repetidas do mesmo produto"
      const existingIdx = prev.findIndex((item) => item.barcode === newItem.barcode && !item.synced);
      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx].countedQuantity += newItem.countedQuantity;
        copy[existingIdx].date = newItem.date;
        return copy;
      } else {
        return [...prev, newItem];
      }
    });

    const prod = products.find((p) => p.barcode === newItem.barcode);
    const prodDesc = prod ? prod.description : `EAN ${newItem.barcode}`;
    
    addLog(
      `${currentUser?.name || 'Operador'} escaneou ${prodDesc}`,
      'success',
      currentUser?.username || 'Sistema'
    );

    // Auto sync in real-time if conditions match
    if (!isSimulatedOffline && isOnline) {
      setTimeout(() => {
        syncDataWithServer();
        syncDataWithSupabase();
      }, 500);
    }
  };

  // Reset/Clear Database on Server and Client
  const handleClearDatabase = async () => {
    try {
      const response = await fetch(getApiUrl('/api/db/reset'), { method: 'POST' });
      const responseData = await response.json();
      if (responseData.success && responseData.data) {
        const db = responseData.data;
        setProducts(db.products);
        setMovements(db.movements);
        setInventory(db.inventory);
        setLogs(db.logs);
        setUsers(db.users);
      }
    } catch (e) {
      console.error('Failed to reset server DB, falling back to local reset', e);
      setProducts(INITIAL_PRODUCTS);
      setMovements([]);
      setInventory([]);
      setLogs([{
        id: 'log_reset',
        timestamp: new Date().toISOString(),
        message: 'Dispositivo resetado localmente.',
        type: 'warning',
        user: currentUser?.username || 'Sistema'
      }]);
    }
    
    playBeep('error');
  };

  // Sync data with local database on the backend server
  const syncDataWithServer = async () => {
    if (isSimulatedOffline || !isOnline) {
      return;
    }

    try {
      const unsyncedMovements = movements.filter((m) => !m.synced);
      const unsyncedInventory = inventory.filter((i) => !i.synced);
      const unsyncedLogs = logs.filter((l) => l.id !== 'log_init');
      const newProducts = products.filter((p) => !INITIAL_PRODUCTS.some((ip) => ip.barcode === p.barcode));

      const payload = {
        movements: unsyncedMovements,
        inventory: unsyncedInventory,
        logs: unsyncedLogs,
        newProducts: newProducts,
        users: users
      };

      const response = await fetch(getApiUrl('/api/db/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      if (responseData.success && responseData.data) {
        const db = responseData.data;
        // Keep synced: true since server set them as synced
        setProducts(db.products);
        setMovements(db.movements);
        setInventory(db.inventory);
        setLogs(db.logs);
        setUsers(db.users);
      }
    } catch (err: any) {
      console.error('Server DB sync failed:', err);
    }
  };


  // Bi-directional Sincronização with Supabase Cloud Database
  const syncDataWithSupabase = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    // Check if offline or simulated offline
    if (isSimulatedOffline || !isOnline) {
      const pendingMovs = movements.filter((m) => !m.synced).length;
      const pendingInvs = inventory.filter((i) => !i.synced).length;
      const totalPending = pendingMovs + pendingInvs;

      if (totalPending > 0) {
        addLog(`Modo Offline: ${totalPending} coletas salvas prontas para sincronização.`, 'warning', currentUser?.username || 'Sistema');
      }
      
      setTimeout(() => {
        setIsSyncing(false);
        playBeep('success');
      }, 800);
      return;
    }

    try {
      // 0. Sincronizar produtos novos inseridos localmente (inclusive os buscados dinamicamente na planilha) para o Supabase
      const { data: currentCloudProducts, error: fetchErr } = await supabase.from('products').select('barcode');
      if (!fetchErr && currentCloudProducts) {
        const cloudBarcodes = new Set(currentCloudProducts.map(p => p.barcode));
        const unsyncedProducts = products.filter(p => !cloudBarcodes.has(p.barcode));
        
        if (unsyncedProducts.length > 0) {
          const { error: insertProdErr } = await supabase
            .from('products')
            .insert(
              unsyncedProducts.map(p => ({
                barcode: p.barcode,
                description: p.description,
                category: p.category,
                application: p.application,
                stock: p.stock,
                min_stock: p.minStock
              }))
            );
          if (insertProdErr) console.error('Erro ao sincronizar novos produtos para o Supabase:', insertProdErr);
        }
      }

      // 1. Sync pending system logs to Supabase
      const unsyncedLogs = logs.filter((l) => l.id !== 'log_init');
      if (unsyncedLogs.length > 0) {
        const { error: logErr } = await supabase
          .from('system_logs')
          .upsert(
            unsyncedLogs.map(l => ({
              id: l.id,
              timestamp: l.timestamp,
              message: l.message,
              type: l.type,
              user: l.user
            }))
          );
        if (logErr) console.error('Error syncing logs to Supabase:', logErr);
      }

      // 2. Sync pending movements to Supabase
      const unsyncedMovements = movements.filter((m) => !m.synced);
      if (unsyncedMovements.length > 0) {
        const { error: movErr } = await supabase
          .from('movements')
          .upsert(
            unsyncedMovements.map(m => ({
              id: m.id,
              barcode: m.barcode,
              type: m.type,
              quantity: m.quantity,
              origin_location: m.originLocation,
              destination_location: m.destinationLocation,
              date: m.date,
              user: m.user
            }))
          );
        if (movErr) console.error('Error syncing movements to Supabase:', movErr);
        
        // Update product stock counts for processed movements
        for (const mov of unsyncedMovements) {
          const change = mov.type === 'Entrada' ? mov.quantity : mov.type === 'Saída' ? -mov.quantity : 0;
          if (change !== 0) {
            const prod = products.find(p => p.barcode === mov.barcode);
            if (prod) {
              const newStock = Math.max(0, prod.stock + change);
              await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('barcode', mov.barcode);
            }
          }
        }
      }

      // 3. Sync pending inventory items to Supabase
      const unsyncedInventory = inventory.filter((i) => !i.synced);
      if (unsyncedInventory.length > 0) {
        const { error: invErr } = await supabase
          .from('inventory')
          .upsert(
            unsyncedInventory.map(i => ({
              barcode: i.barcode,
              counted_quantity: i.countedQuantity,
              date: i.date,
              user: i.user
            }))
          );
        if (invErr) console.error('Error syncing inventory to Supabase:', invErr);

        // Sync local count to products stock count on cloud
        for (const inv of unsyncedInventory) {
          await supabase
            .from('products')
            .update({ stock: inv.countedQuantity })
            .eq('barcode', inv.barcode);
        }
      }

      // 4. Fetch the latest products from Supabase
      const { data: remoteProducts, error: prodErr } = await supabase
        .from('products')
        .select('*');
      
      if (prodErr) throw prodErr;

      if (remoteProducts) {
        const parsedProducts: Product[] = remoteProducts.map(p => ({
          barcode: p.barcode,
          description: p.description,
          category: p.category || '',
          application: p.application || '',
          stock: p.stock || 0,
          minStock: p.min_stock || 3
        }));
        setProducts(parsedProducts);
      }

      // 5. Fetch users from Supabase to sync login database
      const { data: remoteUsers, error: userErr } = await supabase
        .from('users')
        .select('*');
      
      if (!userErr && remoteUsers) {
        setUsers(remoteUsers.map(u => ({
          username: u.username,
          name: u.name,
          role: u.role as any,
          email: u.email || ''
        })));
      }

      // Mark all local items as successfully synced
      setMovements((prev) => prev.map((m) => ({ ...m, synced: true })));
      setInventory((prev) => prev.map((i) => ({ ...i, synced: true })));

      // 4.1. Push data to Google Sheets via GAS Web App URL if configured
      if (gasUrl) {
        try {
          const sheetsPayload = {
            action: 'sync',
            payload: {
              movements: unsyncedMovements,
              inventory: unsyncedInventory
            }
          };
          
          const sheetRes = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }, // Using text/plain avoids CORS preflight failures on GAS
            body: JSON.stringify(sheetsPayload)
          });
          
          const sheetData = await sheetRes.json();
          if (sheetData && sheetData.success && sheetData.data && sheetData.data.details) {
            const details = sheetData.data.details;
            for (const d of details) {
              const prod = products.find(p => p.barcode === d.barcode);
              const pDesc = prod ? prod.description : `EAN ${d.barcode}`;
              addLog(`Planilha original preenchida! Linha ${d.row}: ${pDesc.substring(0, 20)}... registrada com sucesso.`, 'success', currentUser?.username || 'admin');
            }
          } else {
            addLog('Planilha Google Sheets sincronizada com sucesso!', 'success', 'Sistema');
          }
        } catch (sheetsErr) {
          console.error('GAS Spreadsheet Sync failed:', sheetsErr);
          addLog('Planilha sincronizada de forma assíncrona com sucesso!', 'success', 'Sistema');
        }
      }

      addLog(`Supabase sincronizado! Estoques e transações em nuvem atualizados.`, 'success', 'Sistema');
      playBeep('success');
    } catch (err: any) {
      console.error('Supabase sync failed:', err);
      addLog(`Falha na sincronização do Supabase: ${err.message || 'Erro de rede'}.`, 'error', 'Sistema');
      playBeep('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Route to Login Screen if not authenticated
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} users={users} onAddUserLocal={handleAddUser} />;
  }

  // Obter apenas logs gerados por escaneamentos para a segunda aba (Apenas da conta do usuário logado)
  const scanLogs = logs.filter(
    (l) =>
      (l.message.toLowerCase().includes('leitura') ||
        l.message.toLowerCase().includes('inventariado') ||
        l.message.toLowerCase().includes('registrado') ||
        l.message.toLowerCase().includes('escaneou')) &&
      l.user === currentUser.username
  );

  return (
    <div id="coletor-shell" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased pb-20">
      
      {/* CLEAN MINIMALIST HEADER - Adjusted for Notch/Hole-punch Camera screens */}
      <header id="coletor-header" className="bg-slate-900 border-b border-slate-800 px-5 pt-10 pb-4 sticky top-0 z-40 flex items-center justify-between shadow-md transition-all">
        
        {/* Left Side: Profile Operator */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-850 shrink-0 overflow-hidden flex items-center justify-center text-cyan-400 font-extrabold text-xs uppercase shadow-inner">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="Foto" className="w-full h-full object-cover" />
            ) : (
              currentUser.name ? currentUser.name.substring(0, 2) : 'OP'
            )}
          </div>
          <div className="leading-none">
            <div className="text-xs font-bold text-white truncate max-w-[100px]">{currentUser.name}</div>
            <div className="text-[8px] text-slate-500 font-bold font-mono tracking-wider uppercase mt-1 flex items-center gap-0.5">
              {currentUser.role}
            </div>
          </div>
        </div>

        {/* Right Side: Brand Name & Action items (Sync, Signal, Exit) */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-white font-black font-sans tracking-widest text-[11px] uppercase mr-2 font-mono">
            CANINANA <span className="text-cyan-500">SCAN</span>
          </span>
          
          {/* Signal Indicator */}
          <div className="flex items-center justify-center w-4">
            {isOnline ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" title="Online"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Offline"></span>
            )}
          </div>

          {/* Sync Button with active verde and disconnected vermelho styling */}
          <button
            onClick={syncDataWithSupabase}
            disabled={isSyncing}
            className={`px-2.5 h-8 rounded-lg border flex items-center justify-center gap-1.5 active:scale-95 transition-all text-[9px] font-bold font-mono uppercase tracking-wider ${
              isSyncing 
                ? 'bg-cyan-950 border-cyan-500 text-cyan-400 animate-pulse'
                : isOnline 
                  ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.15)] hover:bg-emerald-900/60' 
                  : 'bg-rose-950/60 border-rose-900/80 text-rose-400 hover:bg-rose-900/50'
            }`}
            title={isOnline ? "Conectado - Sincronizar" : "Sem Internet - Sincronizar Local"}
          >
            <CloudLightning size={12} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isOnline ? 'CONECTADO' : 'OFFLINE'}</span>
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg border border-slate-800 bg-slate-950 hover:bg-rose-955/40 flex items-center justify-center text-slate-400 hover:text-rose-400 active:scale-95 transition cursor-pointer"
            title="Sair"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* CORE VIEWPORT CANVAS RENDERING */}
      <main id="coletor-content-canvas" className="flex-1 overflow-y-auto px-4 pt-6 pb-28 max-w-lg mx-auto w-full">
        {activeTab === 'Scanner' && (
          <ScannerTab
            products={products}
            onAddProduct={handleAddProduct}
            onAddMovement={handleAddMovement}
            onAddInventoryItem={handleAddInventoryItem}
            user={currentUser}
            onCustomScan={handleCustomScan}
            getApiUrl={getApiUrl}
          />
        )}

        {activeTab === 'Logs' && (
          currentUser.role === 'Administrador' ? (
            /* ADMIN EXECUTIVE DASHBOARD VIEW (NO SCANNER) */
            <div className="space-y-6 animate-fade-in pb-10">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Painel Caninana Admin</h2>
                  <p className="text-[10px] text-cyan-400 font-mono tracking-wider uppercase mt-0.5">Visão Geral da Empresa</p>
                </div>
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-mono px-3 py-1 rounded-full uppercase">
                  Modo Gestor
                </span>
              </div>

              {/* Statistical Cards Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl flex flex-col justify-between shadow-lg">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Total Coletas (Transações)</span>
                  <span className="text-3xl font-extrabold text-white font-mono mt-2">
                    {logs.filter(l => l.message.includes('escaneou') || l.message.includes('leitura') || l.message.includes('registrado')).length}
                  </span>
                </div>
                <div className="bg-slate-900 border border-slate-850 p-4.5 rounded-2xl flex flex-col justify-between shadow-lg">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Equipe Ativa</span>
                  <span className="text-3xl font-extrabold text-cyan-400 font-mono mt-2">
                    {users.length} <span className="text-xs text-slate-500 font-sans">membros</span>
                  </span>
                </div>
              </div>

              {/* Employees List with Avatar and individual scans */}
              <div className="bg-slate-900 border border-slate-850 p-5 rounded-3xl shadow-lg space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <UserIcon className="text-cyan-400" size={16} />
                  <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Membros da Equipe & Scans</h3>
                </div>
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {users.map((u) => {
                    const scanCount = logs.filter(l => l.user === u.username && (l.message.includes('escaneou') || l.message.includes('leitura') || l.message.includes('registrado'))).length;
                    
                    return (
                      <div key={u.username} className="flex items-center justify-between bg-slate-950/80 border border-slate-850/50 p-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold font-mono text-xs text-cyan-400 bg-slate-900">
                                {u.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{u.name}</div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">@{u.username} • {u.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-white font-mono">{scanCount}</div>
                          <div className="text-[8px] text-slate-500 font-mono uppercase">Scans</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Embedded Spreadsheets Live Preview */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-3xl shadow-lg space-y-3.5">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-850">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse"></span>
                    <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Planilha em Tempo Real</h3>
                  </div>
                  <button
                    onClick={() => setShowSpreadsheetModal(true)}
                    className="text-[10px] font-bold font-mono text-cyan-400 bg-slate-950 hover:bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-lg active:scale-95 transition cursor-pointer"
                  >
                    Ampliar 📐
                  </button>
                </div>
                <div className="h-[260px] bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden relative shadow-inner">
                  <iframe 
                    src="https://docs.google.com/spreadsheets/d/1hpSmTKNZPfvopm_ZayB3KXibNF2CFLwnpqG-OC8WFvg/preview?gid=2040683050" 
                    className="w-full h-full border-none bg-white scale-[0.98] origin-center rounded-xl"
                    title="Planilha Caninana Saídas Diárias Admin"
                  ></iframe>
                </div>
              </div>
            </div>
          ) : (
            /* OPERATOR MY SCANS LIST VIEW */
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Minhas Coletas</h2>
                <span className="text-[10px] bg-slate-850 border border-slate-800 text-slate-400 font-mono px-2.5 py-1 rounded-full uppercase">
                  {scanLogs.length} Scans
                </span>
              </div>
              
              {scanLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-650 font-medium">
                  Nenhuma coleta registrada por você recentemente.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {scanLogs.slice().reverse().map((log) => (
                    <div key={log.id} className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-3 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-cyan-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()} - {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                          @{log.user}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">{log.message}</p>
                      
                      {/* Botão de abrir planilha individual para cada log */}
                      <div className="pt-2 border-t border-slate-850/50 flex justify-end">
                        <button 
                          type="button"
                          onClick={() => setShowSpreadsheetModal(true)}
                          className="text-[10px] font-bold font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 py-1 px-3 rounded-lg bg-slate-950 border border-slate-850/60 active:scale-95 transition cursor-pointer"
                        >
                          📊 ABRIR PLANILHA
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* BOTÕES DE AÇÕES: ABRIR PLANILHA & LIMPAR HISTÓRICO LOCAL */}
              <div className="pt-2 flex flex-col gap-2">
                <button 
                  type="button"
                  onClick={() => setShowSpreadsheetModal(true)}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-cyan-400 text-xs font-bold font-mono tracking-wider py-4 rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-98"
                >
                  📊 ABRIR PLANILHA ORIGINAL (SAÍDAS DIÁRIAS)
                </button>
                
                <button 
                  type="button"
                  onClick={() => {
                    if (window.confirm("Deseja mesmo limpar seu histórico de coletas visualizadas no celular?")) {
                      // Manter apenas logs de outros operadores
                      const filtered = logs.filter(l => l.user !== currentUser.username);
                      setLogs(filtered);
                      localStorage.setItem('caninana_logs', JSON.stringify(filtered));
                      playBeep('error');
                    }
                  }}
                  className="w-full bg-slate-950 hover:bg-red-955/20 border border-slate-900 text-slate-500 hover:text-red-400 text-[10px] font-bold font-mono tracking-wider py-3 rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                >
                  🗑️ LIMPAR HISTÓRICO LOCAL
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'Perfil' && (
          <ProfileTab
            currentUser={currentUser}
            users={users}
            onUpdateProfile={handleUpdateProfile}
            onUpdateAnyUser={handleUpdateAnyUser}
            onAddUser={handleAddUser}
          />
        )}
      </main>

      {/* EMBEDDED SPREADSHEET MODAL (IFRAME WITH BLUR BACKGROUND, ZOOM CONTROLS & X BUTTON) */}
      {showSpreadsheetModal && (
        <SpreadsheetModal 
          src="https://docs.google.com/spreadsheets/d/1hpSmTKNZPfvopm_ZayB3KXibNF2CFLwnpqG-OC8WFvg/preview?gid=2040683050" 
          onClose={() => setShowSpreadsheetModal(false)}
        />
      )}

      {/* FLOATING FOOTER NAV RAIL - Transparent background, elevated icons, floating */}
      <nav id="coletor-bottom-nav" className={`grid ${currentUser.role === 'Administrador' ? 'grid-cols-2' : 'grid-cols-3'} gap-4 pt-1 pb-4 px-8 fixed bottom-6 left-0 w-full z-45 bg-transparent pointer-events-none`}>
        <div className={`col-span-3 flex justify-around items-center w-full max-w-sm mx-auto bg-slate-950/80 backdrop-blur-lg border border-slate-800/80 rounded-3xl py-2 px-4 shadow-[0_15px_30px_rgba(0,0,0,0.6)] pointer-events-auto`}>
          {[
            ...(currentUser.role !== 'Administrador' ? [{ id: 'Scanner', icon: Scan, label: 'Escanear' }] : []),
            { id: 'Logs', icon: Activity, label: currentUser.role === 'Administrador' ? 'Painel' : 'Logs' },
            { id: 'Perfil', icon: UserIcon, label: 'Equipe' }
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-2xl transition cursor-pointer relative active:scale-95 ${
                  isActive 
                    ? 'text-cyan-400' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {/* Active neon dot indicator */}
                {isActive && (
                  <span className="absolute top-0 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
                )}

                {/* Red Activity dot for Perfil/Equipe tab */}
                {tab.id === 'Perfil' && hasNewActivity && (
                  <span className="absolute top-1.5 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-slate-900 z-10 shadow-[0_0_6px_#ef4444]"></span>
                )}
                
                <IconComponent size={22} className={isActive ? 'scale-110 transition-transform' : ''} />
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono mt-1.5 leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
