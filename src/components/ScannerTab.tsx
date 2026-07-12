/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Scan, 
  Settings2, 
  Plus, 
  Minus, 
  Check, 
  AlertCircle, 
  Camera, 
  MapPin, 
  Sparkles, 
  UserPlus 
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Product, Movement, InventoryItem, User } from '../types';
import { playBeep } from '../utils/audio';

interface ScannerTabProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onAddMovement: (movement: Movement) => void;
  onAddInventoryItem: (item: InventoryItem) => void;
  user: User;
  onCustomScan?: (text: string) => boolean;
  getApiUrl?: (path: string) => string;
}

export default function ScannerTab({ products, onAddProduct, onAddMovement, onAddInventoryItem, user, onCustomScan, getApiUrl }: ScannerTabProps) {
  const [scanMode, setScanMode] = useState<'Entrada' | 'Saída' | 'Transferência' | 'Inventário'>('Inventário');
  const [isContinuous, setIsContinuous] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [originLocation, setOriginLocation] = useState('Geral');
  const [destinationLocation, setDestinationLocation] = useState('Prateleira A');

  // Camera scanner states
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  // Scanned item modal/form states
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  
  // New Product Creator Dialog states
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('Vidros Dianteiros');
  const [newApplication, setNewApplication] = useState('');
  const [newMinStock, setNewMinStock] = useState(3);
  const [aiLoading, setAiLoading] = useState(false);

  // Animation visual feedback
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'html5-qrcode-scanner-viewport';

  // Auto clear notification
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 2500);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Toggle Camera
  const toggleCamera = async () => {
    if (scannerActive) {
      await stopCamera();
    } else {
      await startCamera();
    }
  };

  const startCamera = async () => {
    setScannerError(null);
    try {
      setScannerActive(true);
      const html5Qrcode = new Html5Qrcode(scannerId);
      html5QrcodeRef.current = html5Qrcode;

      const qrCodeSuccessCallback = (decodedText: string, decodedResult: any) => {
        handleBarcodeScanned(decodedText);
      };

      const config = { 
        fps: 25, 
        qrbox: (width: number, height: number) => {
          const size = Math.floor(Math.min(width, height) * 0.75);
          return {
            width: size,
            height: size
          };
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await html5Qrcode.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        undefined
      );
    } catch (err: any) {
      console.error("Camera start failed:", err);
      setScannerError("Câmera não disponível ou permissão negada. Use o Simulador de Código de Barras abaixo.");
      setScannerActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (err) {
        console.error("Stop failed:", err);
      }
    }
    html5QrcodeRef.current = null;
    setScannerActive(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current) {
        stopCamera();
      }
    };
  }, []);

  const handleBarcodeScanned = (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;

    if (onCustomScan && onCustomScan(code)) {
      return;
    }

    setFlashSuccess(true);
    setTimeout(() => setFlashSuccess(false), 300);

    const product = products.find((p) => p.barcode === code);

    if (isContinuous) {
      if (product) {
        playBeep('success');
        setNotification({ text: `Parabéns ${user.name}, seu scan de ${product.description.substring(0, 18)}... foi realizado com sucesso!`, type: 'success' });
        commitScan(code, product, 1);
      } else {
        playBeep('error');
        setNotification({ text: `Erro: Produto não encontrado!`, type: 'error' });
        setScannedBarcode(code);
        setMatchedProduct(null);
        setNewDescription('');
        setNewApplication('');
        setIsCreatingProduct(true);
      }
    } else {
      if (product) {
        playBeep('success');
        setNotification({ text: `Parabéns ${user.name}, seu scan de ${product.description.substring(0, 18)}... foi realizado com sucesso!`, type: 'success' });
      } else {
        playBeep('error');
        setNotification({ text: `Erro: Produto não encontrado!`, type: 'error' });
      }
      setScannedBarcode(code);
      setMatchedProduct(product || null);
      setQuantity(1);
      if (!product) {
        setNewDescription('');
        setNewApplication('');
      }
    }
  };

  const commitScan = (code: string, product: Product | null, qty: number) => {
    const timestamp = new Date().toISOString();

    if (scanMode === 'Inventário') {
      onAddInventoryItem({
        barcode: code,
        description: product ? product.description : 'Produto Novo',
        countedQuantity: qty,
        date: timestamp,
        user: user.username,
        synced: false,
      });
    } else {
      onAddMovement({
        id: 'mov_' + Math.random().toString(36).substring(2, 9),
        barcode: code,
        type: scanMode === 'Transferência' ? 'Transferência' : (scanMode as any),
        quantity: qty,
        originLocation: scanMode === 'Transferência' ? originLocation : undefined,
        destinationLocation: scanMode === 'Transferência' || scanMode === 'Entrada' ? destinationLocation : undefined,
        date: timestamp,
        user: user.username,
        synced: false,
      });
    }

    setScannedBarcode(null);
    setMatchedProduct(null);
  };

  const handleAiSuggest = async () => {
    if (!scannedBarcode || aiLoading) return;
    setAiLoading(true);
    playBeep('success');

    try {
      const response = await fetch(getApiUrl ? getApiUrl('/api/gemini/suggest-product') : '/api/gemini/suggest-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: scannedBarcode,
          descriptionHint: newDescription,
        }),
      });

      const data = await response.json();
      if (response.ok && data.description) {
        setNewDescription(data.description);
        setNewCategory(data.category);
        setNewApplication(data.application);
        playBeep('success');
      } else {
        throw new Error(data.error || 'Erro na sugestão de dados');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erro na IA: ${err.message || 'Verifique a chave do Gemini'}. Sugerindo valores padrão.`);
      setNewDescription(`Para-brisa Dianteiro Importado Cód: ${scannedBarcode}`);
      setNewCategory('Vidros Dianteiros');
      setNewApplication('Veículo Compatível');
      playBeep('error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAndCommitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBarcode) return;

    const newProd: Product = {
      barcode: scannedBarcode,
      description: newDescription || `Produto Novo EAN ${scannedBarcode}`,
      category: newCategory,
      application: newApplication || 'Aplicação Universal',
      stock: 0,
      minStock: Number(newMinStock) || 3,
    };

    onAddProduct(newProd);
    commitScan(scannedBarcode, newProd, quantity);
    setIsCreatingProduct(false);
    setScannedBarcode(null);
  };

  return (
    <div id="scanner-tab-container" className="p-4 max-w-lg mx-auto pb-24 space-y-5 text-slate-100">
      
      {/* MODE SELECTOR */}
      <div id="mode-selector" className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 grid grid-cols-4 gap-1.5 shadow-lg">
        {(['Entrada', 'Saída', 'Transferência', 'Inventário'] as const).map((mode) => (
          <button
            key={mode}
            id={`mode-btn-${mode.toLowerCase()}`}
            type="button"
            onClick={() => {
              setScanMode(mode);
            }}
            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider font-mono text-center cursor-pointer transition-all ${
              scanMode === mode 
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold' 
                : 'text-slate-500 hover:text-slate-350'
            }`}
          >
            {mode === 'Entrada' && 'Entrada'}
            {mode === 'Saída' && 'Saída'}
            {mode === 'Transferência' && 'Transf.'}
            {mode === 'Inventário' && 'Invent.'}
          </button>
        ))}
      </div>

      {/* CONTINUOUS READING AND SCANNING SETUP */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <Settings2 size={16} className="text-cyan-400" />
          <div>
            <div className="text-xs font-bold text-white uppercase font-mono">Leitura Contínua</div>
            <div className="text-[10px] text-slate-500">Auto-salva coletas em lote</div>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="continuous-scan-toggle"
            type="checkbox"
            className="sr-only peer"
            checked={isContinuous}
            onChange={(e) => {
              setIsContinuous(e.target.checked);
            }}
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
        </label>
      </div>

      {/* CORE CAMERA VIEWPORT PANELS - Square Aspect for QR Codes */}
      <div 
        id="camera-panel-wrapper" 
        className={`relative aspect-square w-full max-w-sm mx-auto rounded-3xl overflow-hidden border transition-all duration-300 ${
          flashSuccess ? 'border-green-500 scale-[1.01] shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'border-slate-800'
        } bg-slate-950 flex flex-col items-center justify-center`}
      >
        {/* Premium Notification Toast with User Avatar and App Logo */}
        {notification && (
          <div className={`absolute top-4 left-4 right-4 z-30 p-3 rounded-2xl border shadow-2xl animate-fade-in flex items-center gap-3 backdrop-blur-md ${
            notification.type === 'success' 
              ? 'bg-emerald-950/95 text-emerald-300 border-emerald-800/80 shadow-emerald-500/10' 
              : 'bg-red-950/90 text-red-300 border-red-800/80 shadow-red-500/10'
          }`}>
            {/* Small App Logo */}
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-700/60 shrink-0 bg-slate-900 flex items-center justify-center">
              <img src="./logo-caninana.jpeg" alt="CS" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>

            {/* Operator Profile Avatar */}
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-700/60 bg-cyan-950 flex items-center justify-center font-bold text-xs text-cyan-400 font-mono">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>

            {/* Notification message */}
            <div className="flex-1 text-[10px] font-sans leading-tight font-medium text-left">
              {notification.text}
            </div>
            
            <span className={`w-2.5 h-2.5 rounded-full ${notification.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse shrink-0`}></span>
          </div>
        )}
        {/* Professional Square QR Code Aiming Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          <div className="w-64 h-64 border border-cyan-500/20 relative flex items-center justify-center bg-black/10">
            {/* Scanning line laser */}
            <div className="w-full h-0.5 bg-cyan-400 scanner-laser absolute shadow-[0_0_8px_#22d3ee]"></div>
            
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-cyan-500 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-cyan-500 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-cyan-500 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-cyan-500 rounded-br-lg"></div>
          </div>
        </div>

        {/* HTML5 QRCODE CONTAINER ELEMENT */}
        <div 
          id={scannerId} 
          className="w-full h-full object-cover"
          style={{ display: scannerActive ? 'block' : 'none' }}
        ></div>

        {/* Idle display overlay */}
        {!scannerActive && (
          <div className="text-center p-6 space-y-4 z-10">
            <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400 shadow-lg">
              <Camera size={24} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Câmera Desativada</div>
              <p className="text-[10px] text-slate-500 max-w-xs mt-1 leading-normal">Ative a câmera para coletar dados escaneando os códigos diretamente.</p>
            </div>
            <button
              id="activate-camera-btn"
              type="button"
              onClick={toggleCamera}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold py-2.5 px-5 rounded-xl shadow-md shadow-cyan-500/10 transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Scan size={14} />
              Ativar Câmera
            </button>
          </div>
        )}

        {scannerActive && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-850 flex items-center gap-2 z-25 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-[9px] font-mono font-bold text-slate-300 uppercase tracking-widest">Leitor Ativo</span>
            <button 
              onClick={stopCamera} 
              type="button"
              className="text-red-400 hover:text-red-300 text-[9px] uppercase font-bold ml-2 cursor-pointer font-mono"
            >
              Parar
            </button>
          </div>
        )}
      </div>

      {scannerError && (
        <div id="scanner-error-log" className="bg-amber-955/40 border border-amber-900/50 p-4.5 rounded-2xl flex items-start gap-2.5 text-xs text-amber-400 leading-normal shadow-lg">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>{scannerError}</span>
        </div>
      )}

      {/* DYNAMIC FORM MODALS BASED ON READ BARCODES */}

      {/* 1. Manual scan verification dialogue (when isContinuous is false) */}
      {!isContinuous && scannedBarcode && !matchedProduct && !isCreatingProduct && (
        <div id="unknown-item-panel" className="bg-slate-900 border border-amber-550/30 rounded-2xl p-5 space-y-4 animate-fade-in shadow-xl border-l-4 border-l-amber-500">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-sm font-bold text-white">Item Não Cadastrado</h4>
              <p className="text-xs text-slate-455 mt-1">O código <strong className="text-amber-400 font-mono">{scannedBarcode}</strong> não foi localizado.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              id="start-create-product-btn"
              type="button"
              onClick={() => {
                setIsCreatingProduct(true);
                setNewDescription('');
                setNewApplication('');
                setNewCategory('Vidros Dianteiros');
              }}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-amber-600/15"
            >
              <UserPlus size={14} />
              Criar Cadastro
            </button>
            <button
              id="cancel-scan-btn"
              type="button"
              onClick={() => setScannedBarcode(null)}
              className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs py-2.5 px-4 rounded-xl transition cursor-pointer border border-slate-750"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* 2. Manual Scanned Confirmation Form (for existing items, isContinuous = false) */}
      {!isContinuous && scannedBarcode && matchedProduct && (
        <div id="manual-commit-panel" className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 animate-fade-in shadow-xl border-l-4 border-l-cyan-500">
          <div className="border-b border-slate-800 pb-3">
            <span className="bg-cyan-950/50 text-cyan-400 font-bold font-mono text-[9px] px-2 py-0.5 rounded-md border border-cyan-900/35 uppercase tracking-wider">Leitura Manual</span>
            <h4 className="text-sm font-bold text-white mt-2">{matchedProduct.description}</h4>
            <div className="flex justify-between text-[10px] text-slate-550 font-mono mt-1">
              <span>Cód: {scannedBarcode}</span>
              <span>Estoque: <strong className="text-slate-300 font-bold font-mono">{matchedProduct.stock} un</strong></span>
            </div>
          </div>

          {/* TRANSFER OPTIONS */}
          {scanMode === 'Transferência' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 font-mono">Origem</label>
                <div className="relative">
                  <MapPin size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                  <select
                    value={originLocation}
                    onChange={(e) => setOriginLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 pl-8 pr-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Geral">Geral</option>
                    <option value="Prateleira A">Prateleira A</option>
                    <option value="Prateleira B">Prateleira B</option>
                    <option value="Vitrine">Vitrine</option>
                    <option value="Depósito 1">Depósito 1</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 font-mono">Destino</label>
                <div className="relative">
                  <MapPin size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                  <select
                    value={destinationLocation}
                    onChange={(e) => setDestinationLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 pl-8 pr-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Prateleira A">Prateleira A</option>
                    <option value="Prateleira B">Prateleira B</option>
                    <option value="Vitrine">Vitrine</option>
                    <option value="Depósito 1">Depósito 1</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* QUANTITY CONTROL */}
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-850">
            <span className="text-xs font-bold text-slate-400 font-mono uppercase">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-300 hover:text-white cursor-pointer active:scale-90 transition"
              >
                <Minus size={14} />
              </button>
              <input
                id="quantity-picker"
                type="number"
                className="w-14 h-10 bg-slate-950 border border-slate-850 text-white rounded-xl text-center text-sm font-mono font-bold focus:outline-none focus:border-cyan-500"
                value={quantity}
                min={1}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-300 hover:text-white cursor-pointer active:scale-90 transition"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => commitScan(scannedBarcode, matchedProduct, quantity)}
              type="button"
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/10 active:scale-[0.99]"
            >
              <Check size={14} />
              CONFIRMAR COLETA
            </button>
            <button
              onClick={() => setScannedBarcode(null)}
              type="button"
              className="bg-slate-800 hover:bg-slate-755 text-slate-300 text-xs py-3 px-5 rounded-xl transition cursor-pointer border border-slate-750"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* 3. New Product Creator Drawer / Dialog */}
      {isCreatingProduct && scannedBarcode && (
        <form onSubmit={handleSaveAndCommitProduct} id="new-product-form" className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 animate-fade-in shadow-xl">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
            <div>
              <span className="bg-cyan-950/50 text-cyan-400 font-bold font-mono text-[9px] px-2 py-0.5 rounded-md border border-cyan-900/35 uppercase tracking-wider font-mono">Cadastro Rápido</span>
              <h4 className="text-sm font-bold text-white mt-2 font-sans">Novo Vidro Caninana</h4>
              <p className="text-[10px] text-slate-555 font-mono mt-0.5">EAN: {scannedBarcode}</p>
            </div>
            <button
              type="button"
              id="ai-suggest-fields-btn"
              onClick={handleAiSuggest}
              disabled={aiLoading}
              className="bg-gradient-to-r from-violet-650 to-indigo-650 hover:from-violet-700 hover:to-indigo-700 text-white text-[9px] font-bold py-1.5 px-3 rounded-lg transition shadow-md disabled:opacity-60 cursor-pointer"
            >
              <Sparkles size={12} className={aiLoading ? 'animate-spin' : ''} />
              {aiLoading ? 'Processando...' : 'Sugerir com IA'}
            </button>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-slate-555 text-[10px] font-bold uppercase tracking-wider mb-1 font-mono">Descrição Técnica (Modelo/Ano)</label>
              <input
                id="new-product-desc"
                type="text"
                required
                className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500 transition"
                placeholder="Ex: Para-brisa Onix 2015 Verde Térmico"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-555 text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono">Categoria</label>
                <select
                  id="new-product-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500 transition"
                >
                  <option value="Vidros Dianteiros">Vidros Dianteiros</option>
                  <option value="Vidros Traseiros">Vidros Traseiros</option>
                  <option value="Vidros Laterais">Vidros Laterais</option>
                  <option value="Retrovisores">Retrovisores</option>
                  <option value="Palhetas">Palhetas</option>
                  <option value="Acessórios e Colas">Acessórios e Colas</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-555 text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono">Compatibilidade</label>
                <input
                  id="new-product-app"
                  type="text"
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500 transition"
                  placeholder="Ex: Corolla, Civic"
                  value={newApplication}
                  onChange={(e) => setNewApplication(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-555 text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono">Estoque Mínimo</label>
                <input
                  id="new-product-min-stock"
                  type="number"
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500 transition"
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-slate-555 text-[10px] font-bold uppercase tracking-wider mb-1.5 font-mono">Qtd Coletada</label>
                <div className="flex items-center justify-center bg-slate-950 rounded-xl border border-slate-850 h-[38px]">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-mono font-bold text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold py-3 rounded-xl transition cursor-pointer"
            >
              Salvar e Coletar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingProduct(false);
                setScannedBarcode(null);
              }}
              className="bg-slate-800 hover:bg-slate-750 text-slate-355 text-xs py-3 px-4 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* SIMULATED BARCODE READER SECTION FOR TESTING */}
      <div id="barcode-simulator" className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
          <Scan className="text-cyan-400" size={16} />
          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Simulador de Código</h3>
        </div>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { code: '7891020304050', label: 'Vidro Corolla' },
              { code: '7891122334455', label: 'Para-brisa Civic' },
              { code: '7892233445566', label: 'Retrovisor Hilux' },
              { code: '7893344556677', label: 'Vidro Lateral HB20' }
            ].map((sim) => (
              <button
                key={sim.code}
                type="button"
                onClick={() => handleBarcodeScanned(sim.code)}
                className="bg-slate-950 hover:bg-slate-850 border border-slate-850 p-2.5 rounded-xl text-left transition active:scale-97 cursor-pointer"
              >
                <div className="text-[10px] font-bold text-white truncate">{sim.label}</div>
                <div className="text-[8px] text-slate-500 font-mono mt-0.5">{sim.code}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              id="simulator-custom-barcode"
              type="text"
              className="flex-1 bg-slate-950 border border-slate-850 text-white rounded-xl py-2.5 px-4 text-xs font-mono focus:outline-none focus:border-cyan-500 placeholder-slate-650"
              placeholder="Digite outro código..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  handleBarcodeScanned(input.value);
                  input.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('simulator-custom-barcode') as HTMLInputElement;
                if (el && el.value.trim()) {
                  handleBarcodeScanned(el.value.trim());
                  el.value = '';
                }
              }}
              className="bg-slate-800 hover:bg-slate-750 border border-slate-750 text-slate-350 text-xs px-4 rounded-xl transition cursor-pointer"
            >
              Ler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
