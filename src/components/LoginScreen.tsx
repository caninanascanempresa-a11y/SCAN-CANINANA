/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, UserCheck, AlertTriangle, UserPlus, ArrowLeft, Mail } from 'lucide-react';
import { User } from '../types';
import { playBeep } from '../utils/audio';
import { supabase } from '../utils/supabaseClient';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  users?: (User & { passwordHash: string })[];
  onAddUserLocal?: (newUser: User & { passwordHash: string }) => void;
}

export default function LoginScreen({ onLogin, users = [], onAddUserLocal }: LoginScreenProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  const [showSplash, setShowSplash] = useState(true);

  // Splash Screen timeout
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // Login form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Register form states (Simplified as requested: Name, Professional Email/User, Password)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'Operador' | 'Administrador'>('Operador');
  const [regAdminCode, setRegAdminCode] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const typedUser = username.trim().toLowerCase();
    const typedPass = password;

    try {
      // 1. Try to query directly from Supabase for real-time validation if online
      const isEmail = typedUser.includes('@');
      
      let query = supabase.from('users').select('*');
      if (isEmail) {
        query = query.eq('email', typedUser);
      } else {
        query = query.eq('username', typedUser);
      }
      
      const { data: remoteUser, error: queryErr } = await query.maybeSingle();

      if (!queryErr && remoteUser) {
        if (remoteUser.password_hash === typedPass) {
          playBeep('success');
          onLogin({
            username: remoteUser.username,
            name: remoteUser.name,
            role: remoteUser.role,
            email: remoteUser.email || '',
            avatar: remoteUser.avatar || ''
          });
          setLoading(false);
          return;
        } else {
          setError('Senha incorreta.');
          playBeep('error');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Supabase connection or query failed, using offline fallback.');
    }

    // 2. Offline Contingency: Fallback to the local memory/cached users database or initial default login
    const found = users.find(
      (u) => (u.username.toLowerCase() === typedUser || (u.email && u.email.toLowerCase() === typedUser)) && u.passwordHash === typedPass
    );

    if (found) {
      playBeep('success');
      onLogin({
        username: found.username,
        name: found.name,
        role: found.role,
        email: found.email,
        avatar: found.avatar,
      });
    } else if (typedUser === 'admin' && typedPass === 'admin2412') {
      // Guarantee entry for first-time use if Supabase tables aren't created yet
      playBeep('success');
      onLogin({
        username: 'admin',
        name: 'Administrador Caninana',
        role: 'Administrador',
        email: 'carlos@caninana.com.br',
        avatar: ''
      });
    } else {
      setError('E-mail profissional ou senha inválidos.');
      playBeep('error');
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validations
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      playBeep('error');
      setLoading(false);
      return;
    }

    const cleanUsername = regEmail.trim().split('@')[0].toLowerCase(); // Usar a primeira parte do email profissional como username
    
    // Validar código de administrador se o cargo selecionado for Administrador
    if (regRole === 'Administrador' && regAdminCode.trim() !== 'admin2026') {
      setError('Código de Segurança do Administrador inválido.');
      playBeep('error');
      setLoading(false);
      return;
    }

    try {
      // Try pushing to Supabase first
      const { error: insertErr } = await supabase
        .from('users')
        .insert({
          username: cleanUsername,
          name: regName.trim(),
          role: regRole,
          email: regEmail.trim(),
          password_hash: regPassword
        });

      if (insertErr) {
        if (
          insertErr.message?.includes('public.users') || 
          insertErr.code === 'PGRST116' || 
          insertErr.message?.includes('schema cache') ||
          insertErr.message?.includes('relation')
        ) {
          if (onAddUserLocal) {
            onAddUserLocal({
              username: cleanUsername,
              name: regName.trim(),
              role: regRole,
              email: regEmail.trim(),
              passwordHash: regPassword
            });
          }
          playBeep('success');
          setSuccess('Cadastro local efetuado com sucesso!');
          
          setRegName('');
          setRegEmail('');
          setRegPassword('');
          
          setTimeout(() => {
            setIsRegisterMode(false);
            setSuccess('');
          }, 1500);
          return;
        }

        if (insertErr.code === '23505') {
          throw new Error('Este e-mail ou usuário já está cadastrado.');
        }
        throw insertErr;
      }

      // If Supabase insert succeeded
      if (onAddUserLocal) {
        onAddUserLocal({
          username: cleanUsername,
          name: regName.trim(),
          role: regRole,
          email: regEmail.trim(),
          passwordHash: regPassword
        });
      }

      playBeep('success');
      setSuccess('Usuário cadastrado com sucesso! Faça seu login.');
      
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      
      setTimeout(() => {
        setIsRegisterMode(false);
        setSuccess('');
      }, 1500);

    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Erro ao registrar usuário.');
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };

  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 transition-all duration-700">
        <div className="flex flex-col items-center space-y-6 animate-pulse">
          <div className="relative w-36 h-36 rounded-3xl overflow-hidden border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            <img 
              src="./logo-caninana.jpeg" 
              alt="Logo Caninana Scan" 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback image just in case
                e.currentTarget.src = "https://ai.google.dev/static/site-assets/images/share-ais-513315318.png";
              }}
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white tracking-widest uppercase font-sans">
              Caninana <span className="text-cyan-500">Scan</span>
            </h1>
            <p className="text-slate-400 text-xs tracking-widest font-mono uppercase mt-2">
              Coletor Premium
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Subtle glowing header bar */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-500 to-blue-600"></div>
        
        {/* Brand Header */}
        <div className="text-center mb-8 mt-2 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-md mb-4">
            <img 
              src="./logo-caninana.jpeg" 
              alt="Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">CANINANA SCAN</h2>
          <p className="text-cyan-400 text-xs font-mono tracking-wider uppercase mt-1">Painel de Acesso</p>
        </div>

        {/* Dynamic Forms */}
        {!isRegisterMode ? (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-2 font-mono uppercase tracking-wider">E-mail Profissional</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                  <UserCheck size={16} />
                </span>
                <input
                  id="username-input"
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:border-cyan-500 focus:outline-none placeholder-slate-600 transition"
                  placeholder="Ex: breno@caninana.com.br"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-2 font-mono uppercase tracking-wider">Senha</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                  <Key size={16} />
                </span>
                <input
                  id="password-input"
                  type="password"
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:border-cyan-500 focus:outline-none placeholder-slate-600 transition"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div id="login-error" className="flex items-start gap-2 bg-red-950/40 border border-red-900/50 text-red-400 p-4 rounded-2xl text-xs leading-relaxed">
                <AlertTriangle className="shrink-0 mt-0.5 text-red-500" size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              id="submit-login"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition shadow-lg shadow-cyan-500/10 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Shield size={14} />
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsRegisterMode(true);
                }}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 font-sans flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <UserPlus size={14} />
                Criar Nova Conta
              </button>
            </div>
          </form>
        ) : (
          /* REGISTRATION FORM (Minimal: Name, Professional Email, Password) */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsRegisterMode(false);
                }}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">Novo Cadastro</span>
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] font-bold mb-1.5 uppercase tracking-wider font-mono">Nome Completo</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl py-3 px-4 text-xs focus:border-cyan-500 focus:outline-none placeholder-slate-600 transition"
                placeholder="Ex: Carlos Silva"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] font-bold mb-1.5 uppercase tracking-wider font-mono">E-mail Profissional</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Mail size={14} />
                </span>
                <input
                  type="email"
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl py-3 pl-10 pr-4 text-xs focus:border-cyan-500 focus:outline-none placeholder-slate-600 transition"
                  placeholder="Ex: carlos@caninana.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] font-bold mb-1.5 uppercase tracking-wider font-mono">Senha</label>
              <input
                type="password"
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl py-3 px-4 text-xs focus:border-cyan-500 focus:outline-none placeholder-slate-600 transition"
                placeholder="Crie sua senha"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] font-bold mb-1.5 uppercase tracking-wider font-mono">Cargo Principal</label>
              <select
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl py-3 px-4 text-xs focus:border-cyan-500 focus:outline-none transition cursor-pointer"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as any)}
              >
                <option value="Operador">Estoquista (Com Scanner)</option>
                <option value="Administrador">Administrador (Sem Scanner + Relatórios)</option>
              </select>
            </div>

            {regRole === 'Administrador' && (
              <div>
                <label className="block text-cyan-400 text-[10px] font-bold mb-1.5 uppercase tracking-wider font-mono animate-pulse">Código Único Adm</label>
                <input
                  type="password"
                  className="w-full bg-slate-955 border border-cyan-900/60 text-white rounded-2xl py-3 px-4 text-xs focus:border-cyan-500 focus:outline-none placeholder-slate-650 transition font-mono"
                  placeholder="Digite o código master"
                  value={regAdminCode}
                  onChange={(e) => setRegAdminCode(e.target.value)}
                  required
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/50 text-red-400 p-3 rounded-2xl text-[11px] leading-relaxed">
                <AlertTriangle className="shrink-0 mt-0.5 text-red-500" size={14} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-950/40 border border-green-900/50 text-green-400 p-3 rounded-2xl text-[11px] font-semibold text-center animate-pulse">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition shadow-lg shadow-cyan-500/10 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <UserPlus size={14} />
              {loading ? 'Cadastrando...' : 'Finalizar Cadastro'}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="text-center mt-8 text-slate-600 text-[9px] font-mono leading-relaxed uppercase">
          Caninana Auto Vidros Ltda © 2026<br />
          Sistema Premium SCAN-CANINANA
        </div>
      </div>
    </div>
  );
}
