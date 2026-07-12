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
          
          await fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors', // Avoid CORS errors on mobile WebView redirect
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sheetsPayload)
          });
          
          addLog('Planilha Google Sheets sincronizada com sucesso!', 'success', 'Sistema');
        } catch (sheetsErr) {
          console.error('GAS Spreadsheet Sync failed:', sheetsErr);
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
      
      {/* CLEAN MINIMALIST HEADER */}
      <header id="coletor-header" className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-md">
        
        {/* Profile Operator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner shrink-0 overflow-hidden text-cyan-400 font-extrabold text-sm uppercase">
            {currentUser.name ? currentUser.name.substring(0, 2) : 'OP'}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white truncate max-w-[130px]">{currentUser.name}</div>
            <div className="text-[10px] text-slate-500 font-bold font-mono tracking-wider uppercase flex items-center gap-1">
              <Shield size={11} className="text-cyan-500 shrink-0" />
              {currentUser.role}
            </div>
          </div>
        </div>

        {/* Brand center name */}
        <div className="text-center shrink-0">
          <span className="text-white font-extrabold font-sans tracking-widest text-sm uppercase">
            CANINANA <span className="text-cyan-500">SCAN</span>
          </span>
        </div>

        {/* Action Header Items */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Signal Indicator */}
          <div className="flex items-center">
            {isOnline ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" title="Online"></span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" title="Offline"></span>
            )}
          </div>

          {/* Sync Button */}
          <button
            onClick={syncDataWithSupabase}
            disabled={isSyncing}
            className={`w-9 h-9 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-850 cursor-pointer active:scale-95 transition ${
              isSyncing ? 'animate-spin border-cyan-500 text-cyan-400' : ''
            }`}
            title="Sincronizar"
          >
            <CloudLightning size={15} />
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-950 hover:bg-rose-950/40 flex items-center justify-center text-slate-400 hover:text-rose-400 active:scale-95 transition cursor-pointer"
            title="Sair"
          >
            <LogOut size={15} />
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

            {/* ABRIR PLANILHA DE PRODUCAO PRINCIPAL BUTTON */}
            <div className="pt-2">
              <button 
                type="button"
                onClick={() => setShowSpreadsheetModal(true)}
                className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-cyan-400 text-xs font-bold font-mono tracking-wider py-4 rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-98"
              >
                📊 ABRIR PLANILHA ORIGINAL (SAÍDAS DIÁRIAS)
              </button>
            </div>
          </div>
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

      {/* EMBEDDED SPREADSHEET MODAL (IFRAME WITH BLUR BACKGROUND & X BUTTON) */}
      {showSpreadsheetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col p-4 animate-fade-in">
          {/* Header Panel */}
          <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-t-3xl shadow-lg shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></span>
              <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">Planilha Automatizada (Saídas Diárias)</span>
            </div>
            <button 
              onClick={() => setShowSpreadsheetModal(false)}
              className="w-8 h-8 rounded-xl bg-slate-950 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-850 flex items-center justify-center transition active:scale-95 cursor-pointer font-bold font-mono text-xs"
            >
              X
            </button>
          </div>
          
          {/* Embedded Google Sheets IFrame pointing directly to Saídas Diárias */}
          <div className="flex-1 bg-slate-950 border-x border-b border-slate-800 rounded-b-3xl overflow-hidden shadow-2xl relative">
            <iframe 
              src="https://docs.google.com/spreadsheets/d/1hpSmTKNZPfvopm_ZayB3KXibNF2CFLwnpqG-OC8WFvg/htmlembed?widget=false&headers=false&chrome=false&gid=2040683050" 
              className="w-full h-full border-none bg-white"
              title="Planilha Caninana Saídas Diárias"
            ></iframe>
          </div>
        </div>
      )}

      {/* FLOATING FOOTER NAV RAIL - Transparent background, elevated icons, floating */}
      <nav id="coletor-bottom-nav" className="grid grid-cols-3 gap-4 pt-1 pb-4 px-8 fixed bottom-6 left-0 w-full z-45 bg-transparent pointer-events-none">
        <div className="col-span-3 flex justify-around items-center w-full max-w-sm mx-auto bg-slate-950/80 backdrop-blur-lg border border-slate-800/80 rounded-3xl py-2 px-4 shadow-[0_15px_30px_rgba(0,0,0,0.6)] pointer-events-auto">
          {[
            { id: 'Scanner', icon: Scan, label: 'Escanear' },
            { id: 'Logs', icon: Activity, label: 'Logs' },
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
