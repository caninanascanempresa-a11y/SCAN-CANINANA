import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Camera, 
  Upload, 
  Trash2, 
  Users, 
  Check, 
  Plus, 
  Edit2, 
  X,
  Lock,
  UserCheck
} from 'lucide-react';
import { User } from '../types';
import { playBeep } from '../utils/audio';

interface ProfileTabProps {
  currentUser: User;
  users: (User & { passwordHash: string })[];
  onUpdateProfile: (updatedFields: Partial<User>) => void;
  onUpdateAnyUser: (username: string, updatedFields: Partial<User & { passwordHash?: string }>) => void;
  onAddUser?: (newUser: User & { passwordHash: string }) => void;
}

export default function ProfileTab({
  currentUser,
  users,
  onUpdateProfile,
  onUpdateAnyUser,
  onAddUser
}: ProfileTabProps) {
  // Mode: 'me' (My profile) or 'team' (Team members roster)
  const [activeSubTab, setActiveSubTab] = useState<'me' | 'team'>('me');
  
  // My Profile Form States
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileEmail, setProfileEmail] = useState(currentUser.email || '');
  const [profileAvatar, setProfileAvatar] = useState(currentUser.avatar || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Selected User to Edit (Admin only)
  const [editingUser, setEditingUser] = useState<(User & { passwordHash: string }) | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editRole, setEditRole] = useState<'Administrador' | 'Operador' | 'Consulta'>('Operador');
  const [editPassword, setEditPassword] = useState('');
  const [editDragActive, setEditDragActive] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  // Add User Form States (Admin only)
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAvatar, setNewAvatar] = useState('');
  const [newRole, setNewRole] = useState<'Administrador' | 'Operador' | 'Consulta'>('Operador');
  const [newPassword, setNewPassword] = useState('123');

  // Keep state in sync when current user changes
  useEffect(() => {
    setProfileName(currentUser.name);
    setProfileEmail(currentUser.email || '');
    setProfileAvatar(currentUser.avatar || '');
    setProfilePassword('');
    setSaveSuccess(false);
  }, [currentUser]);

  const avatarPresets = [
    'linear-gradient(135deg, #2497DE 0%, #1d7ebc 100%)', // Brand blue
    'linear-gradient(135deg, #10B981 0%, #059669 100%)', // Emerald
    'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', // Amber
    'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', // Violet
    'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)', // Pink
  ];

  const handleDrag = (e: React.DragEvent, type: 'me' | 'edit' | 'new') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      if (type === 'me') setDragActive(true);
      if (type === 'edit') setEditDragActive(true);
    } else if (e.type === "dragleave") {
      if (type === 'me') setDragActive(false);
      if (type === 'edit') setEditDragActive(false);
    }
  };

  const processFile = (file: File, targetSetter: (dataUrl: string) => void) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, envie apenas arquivos de imagem.');
      return;
    }
    // Permite até 8MB para fotos de alta resolução do celular
    if (file.size > 8 * 1024 * 1024) {
      alert('A imagem é muito grande. Escolha uma imagem de até 8 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const img = new Image();
        img.onload = () => {
          // Redimensionar e comprimir para ~400px de largura
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // Compressão de 70% jpeg
            targetSetter(compressedDataUrl);
            playBeep('success');
          }
        };
        img.src = e.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent, type: 'me' | 'edit' | 'new') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'me') {
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0], setProfileAvatar);
      }
    } else if (type === 'edit') {
      setEditDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0], setEditAvatar);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, targetSetter: (dataUrl: string) => void) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0], targetSetter);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      alert('O nome do operador não pode estar vazio.');
      return;
    }
    
    const fields: Partial<User & { passwordHash?: string }> = {
      name: profileName.trim(),
      email: profileEmail.trim(),
      avatar: profileAvatar,
    };

    if (profilePassword.trim()) {
      fields.passwordHash = profilePassword;
    }

    onUpdateProfile(fields);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleStartEditUser = (u: User & { passwordHash: string }) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email || '');
    setEditAvatar(u.avatar || '');
    setEditRole(u.role);
    setEditPassword(u.passwordHash);
    setEditSuccess(false);
  };

  const handleSaveEditedUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim()) {
      alert('O nome do operador não pode estar vazio.');
      return;
    }

    const fields: Partial<User & { passwordHash?: string }> = {
      name: editName.trim(),
      email: editEmail.trim(),
      avatar: editAvatar,
      role: editRole,
      passwordHash: editPassword,
    };

    onUpdateAnyUser(editingUser.username, fields);
    setEditSuccess(true);
    setTimeout(() => {
      setEditSuccess(false);
      setEditingUser(null);
    }, 1500);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim()) {
      alert('Preencha o nome e o nome de usuário.');
      return;
    }

    const usernameClean = newUsername.trim().toLowerCase().replace(/\s+/g, '');
    const exists = users.some((u) => u.username === usernameClean);
    if (exists) {
      alert('Este nome de usuário já está cadastrado.');
      return;
    }

    if (onAddUser) {
      onAddUser({
        username: usernameClean,
        name: newName.trim(),
        role: newRole,
        email: newEmail.trim(),
        avatar: newAvatar,
        passwordHash: newPassword || '123'
      });
      
      // Reset
      setIsAddingUser(false);
      setNewName('');
      setNewUsername('');
      setNewEmail('');
      setNewAvatar('');
      setNewRole('Operador');
      setNewPassword('123');
      playBeep('success');
    }
  };

  const renderAvatar = (avatar: string, name: string, sizeClass: string = "w-16 h-16", textClass: string = "text-xl") => {
    if (!avatar) {
      return (
        <div className={`${sizeClass} rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center font-black uppercase font-mono`}>
          {name ? name.substring(0, 2) : 'OP'}
        </div>
      );
    }
    if (avatar.startsWith('linear-gradient')) {
      return (
        <div 
          className={`${sizeClass} rounded-full border border-slate-200 text-white flex items-center justify-center font-black uppercase shadow-inner`}
          style={{ background: avatar }}
        >
          {name ? name.substring(0, 2) : 'OP'}
        </div>
      );
    }
    return (
      <img src={avatar} alt="Foto de perfil" className={`${sizeClass} rounded-full border border-slate-200 object-cover shadow-sm`} />
    );
  };

  return (
    <div id="profile-tab-container" className="p-4 max-w-lg mx-auto pb-24 space-y-5 animate-fade-in text-slate-100">
      
      {/* HEADER HERO CARD */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
          <UserIcon size={140} />
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          {renderAvatar(currentUser.avatar || '', currentUser.name, "w-16 h-16 ring-4 ring-white/20")}
          <div>
            <h2 className="text-lg font-bold tracking-tight">{currentUser.name}</h2>
            <p className="text-[10px] font-mono uppercase bg-white/15 px-2 py-0.5 rounded-full inline-block mt-1 font-semibold">
              @{currentUser.username} • {currentUser.role}
            </p>
            {currentUser.email && (
              <p className="text-xs text-cyan-100 mt-1.5 flex items-center gap-1">
                <Mail size={12} />
                {currentUser.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SUB TAB SELECTOR */}
      <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl grid grid-cols-2 gap-1.5">
        <button
          onClick={() => {
            setActiveSubTab('me');
            setEditingUser(null);
            setIsAddingUser(false);
          }}
          className={`py-2 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'me' 
              ? 'bg-slate-850 text-cyan-400 shadow-inner border border-slate-800' 
              : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          Meu Perfil
        </button>
        <button
          onClick={() => {
            setActiveSubTab('team');
            setEditingUser(null);
            setIsAddingUser(false);
          }}
          className={`py-2 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'team' 
              ? 'bg-slate-850 text-cyan-400 shadow-inner border border-slate-800' 
              : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          <Users size={14} />
          Equipe ({users.length})
        </button>
      </div>

      {/* TAB SUB-PAGES */}
      {activeSubTab === 'me' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Camera className="text-cyan-400" size={16} />
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Alterar Meus Dados</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Gallery Avatar Selector */}
            <div>
              <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2.5 font-mono">
                Foto de Perfil
              </label>
              
              <div className="flex flex-col items-center justify-center py-2">
                {/* Clickable Circle Avatar preview */}
                <div 
                  onClick={() => document.getElementById('my-gallery-input')?.click()}
                  className="shrink-0 relative group cursor-pointer active:scale-95 transition"
                >
                  <input
                    id="my-gallery-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, setProfileAvatar)}
                  />
                  {renderAvatar(profileAvatar, profileName, "w-24 h-24 ring-4 ring-cyan-500/25 shadow-lg")}
                  <div className="absolute bottom-0 right-0 bg-cyan-500 hover:bg-cyan-600 text-slate-950 p-2 rounded-full shadow-lg border-2 border-slate-900 flex items-center justify-center">
                    <Camera size={14} />
                  </div>
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-2 uppercase tracking-wide">Toque na foto para abrir a Galeria</span>
              </div>

            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1.5 font-mono">
                  Nome do Operador
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <UserIcon size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Ex: Alan Moreira"
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:border-cyan-500 transition"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1.5 font-mono">
                  E-mail de Trabalho
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Mail size={14} />
                  </span>
                  <input
                    type="email"
                    placeholder="Ex: alan@autovidros.com.br"
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:border-cyan-500 transition"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1.5 font-mono">
                  Alterar Senha
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    placeholder="Deixe em branco para manter a atual"
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:border-cyan-500 transition"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span>Nível de Acesso:</span>
                <span className="font-bold uppercase text-cyan-400">{currentUser.role}</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end">
              <button
                type="submit"
                className={`py-2.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-md flex items-center gap-1.5 cursor-pointer ${
                  saveSuccess 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/10'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check size={14} />
                    Perfil Atualizado!
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </form>

          {/* TEAM SCANS ACTIVITY STREAM - HIDE IF ADMIN */}
          {currentUser.role !== 'Administrador' && (
            <div className="mt-6 space-y-4 border-t border-slate-800 pt-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Atividades de Escaneamento</h3>
              </div>
              
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {(() => {
                  const rawLogs = localStorage.getItem('caninana_logs') 
                    ? JSON.parse(localStorage.getItem('caninana_logs') || '[]')
                    : [];
                  
                  // Filtrar apenas logs de escaneamento
                  const scanLogs = rawLogs.filter((log: any) => 
                    log.message.includes('escaneou')
                  );

                  if (scanLogs.length === 0) {
                    return (
                      <div className="text-center p-6 bg-slate-950 rounded-2xl border border-slate-850">
                        <p className="text-[10px] text-slate-550 font-mono uppercase">Nenhuma atividade de escaneamento registrada</p>
                      </div>
                    );
                  }

                  // Ordenar decrescente por data/timestamp
                  const sortedLogs = [...scanLogs].sort((a: any, b: any) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  );

                  return sortedLogs.map((log: any) => {
                    // Encontrar detalhes do usuário correspondente para puxar o avatar
                    const logUser = users.find(u => u.username === log.user);
                    const userName = logUser ? logUser.name : log.user;

                    return (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-850 hover:bg-slate-950/60 transition">
                        {renderAvatar(logUser?.avatar || '', userName, "w-8 h-8 text-xs")}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-205 font-medium truncate">
                            {log.message}
                          </p>
                          <span className="text-[8px] text-slate-555 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • @{log.user}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TEAM ROSTER VIEW */
        <div className="space-y-4">
          
          {/* Admin panel to edit selected user */}
          {editingUser && (
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Edit2 size={15} />
                  <h4 className="text-xs font-bold uppercase font-mono tracking-wider">Editar Operador: @{editingUser.username}</h4>
                </div>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    playBeep('warning');
                  }}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEditedUser} className="space-y-3.5">
                {/* Avatar Selection for Edit */}
                <div>
                  <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1.5 font-mono">
                    Foto do Operador
                  </label>
                  <div className="flex items-center gap-3">
                    {renderAvatar(editAvatar, editName, "w-12 h-12")}
                    <div className="flex-1">
                      <div
                        onClick={() => document.getElementById('edit-gallery-input')?.click()}
                        className="border border-dashed border-slate-850 hover:border-slate-750 rounded-xl p-2 text-center cursor-pointer text-[9px] font-medium text-slate-450 bg-slate-950"
                      >
                        <input
                          id="edit-gallery-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, setEditAvatar)}
                        />
                        <span className="text-cyan-400 font-semibold">Alterar Foto</span> (Galeria)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Nome</label>
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">E-mail</label>
                    <input
                      type="email"
                      className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Senha</label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Nível</label>
                      <select
                        className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as any)}
                      >
                        <option value="Administrador">Administrador</option>
                        <option value="Operador">Operador</option>
                        <option value="Consulta">Consulta</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="py-1.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <Check size={12} />
                    Salvar Operador
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Add User panel */}
          {isAddingUser && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Plus size={16} />
                  <h4 className="text-xs font-bold uppercase font-mono tracking-wider">Novo Operador</h4>
                </div>
                <button
                  onClick={() => setIsAddingUser(false)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Nome de Usuário</label>
                    <input
                      type="text"
                      placeholder="Ex: alan"
                      className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Senha Inicial</label>
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Nome Completo</label>
                    <input
                      type="text"
                      placeholder="Ex: Alan Moreira"
                      className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">E-mail</label>
                    <input
                      type="email"
                      placeholder="Ex: alan@autovidros.com.br"
                      className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Nível de Acesso</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                    >
                      <option value="Administrador">Administrador</option>
                      <option value="Operador">Operador</option>
                      <option value="Consulta">Consulta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1.5">Avatar</label>
                    <div className="flex items-center gap-1 h-9">
                      {avatarPresets.map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setNewAvatar(preset)}
                          className={`w-5 h-5 rounded-full border-2 ${newAvatar === preset ? 'border-cyan-450 scale-105' : 'border-slate-950'} shadow-sm cursor-pointer`}
                          style={{ background: preset }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddingUser(false)}
                    className="py-1.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-md shadow-cyan-550/10"
                  >
                    <Plus size={12} />
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="text-cyan-400" size={16} />
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Membros da Equipe</h3>
              </div>

              {/* Add User button available only for Admins */}
              {currentUser.role === 'Administrador' && onAddUser && !isAddingUser && (
                <button
                  onClick={() => {
                    setIsAddingUser(true);
                    setEditingUser(null);
                    playBeep('success');
                  }}
                  className="py-1 px-3 bg-slate-950 hover:bg-cyan-500/10 border border-slate-800 hover:border-cyan-500/40 rounded-xl font-bold text-[9px] uppercase tracking-wider font-mono text-cyan-400 transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={10} />
                  Adicionar
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-850">
              {users.map((u) => {
                const isMe = u.username === currentUser.username;
                const isAdmin = currentUser.role === 'Administrador';
                
                // Obter total de scans reais deste usuário baseados em logs contendo seu username
                // do localStorage ou logs em tempo de execução
                const userScansCount = localStorage.getItem('caninana_logs') 
                  ? JSON.parse(localStorage.getItem('caninana_logs') || '[]')
                      .filter((log: any) => log.user === u.username && (log.message.toLowerCase().includes('leitura') || log.message.toLowerCase().includes('inventariado') || log.message.toLowerCase().includes('registrado'))).length 
                  : 0;

                return (
                  <div key={u.username} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {renderAvatar(u.avatar || '', u.name, "w-11 h-11 ring-1 ring-slate-800")}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{u.name}</span>
                          {isMe && (
                            <span className="bg-cyan-950/50 text-cyan-400 border border-cyan-900/50 text-[8px] font-bold uppercase tracking-wider font-mono px-1 rounded-sm">
                              Você
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-450 font-mono truncate mt-0.5">
                          @{u.username} • <span className={`font-semibold ${
                            u.role === 'Administrador' ? 'text-amber-500' : u.role === 'Operador' ? 'text-cyan-400' : 'text-emerald-500'
                          }`}>{u.role}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Mostrar número total de scans realizados pelo usuário */}
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-white font-mono">{userScansCount}</span>
                        <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono">scans</span>
                      </div>

                      {/* Admin Action: Edit User */}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            handleStartEditUser(u);
                            playBeep('success');
                          }}
                          className="p-2 text-slate-400 hover:text-amber-500 hover:bg-slate-950 border border-slate-850 rounded-xl hover:border-amber-500/30 transition cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
