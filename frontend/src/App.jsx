import React, { useState, useEffect, useContext, createContext, useMemo, useRef, useCallback } from 'react';
import { 
  Lock, Unlock, Shield, Key, CreditCard, LayoutDashboard, Settings, Plus, 
  Search, Eye, EyeOff, Copy, Trash, Edit, Check, Star, AlertTriangle, 
  LogOut, Clock, Globe, Menu, X, ChevronRight, Hash, RefreshCw, Palette, Sparkles, Loader2
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÃO DA API (Backend Unraid)
// ==========================================
// Alterar 'localhost' para o IP do seu Unraid quando compilar (ex: 192.168.1.100)
const API_URL = `http://192.168.1.152:3071/api`;

// ==========================================
// 1. CONSTANTS, THEMES & TRANSLATIONS
// ==========================================

const THEMES = {
  dark: { name: 'Dark Minimal', vars: { '--bg': '#121212', '--surface': '#1e1e1e', '--surface-hover': '#2a2a2a', '--primary': '#3b82f6', '--primary-hover': '#2563eb', '--text': '#f8fafc', '--text-muted': '#94a3b8', '--border': '#334155', '--danger': '#ef4444' } },
  light: { name: 'Light Clean', vars: { '--bg': '#f8fafc', '--surface': '#ffffff', '--surface-hover': '#f1f5f9', '--primary': '#2563eb', '--primary-hover': '#1d4ed8', '--text': '#0f172a', '--text-muted': '#64748b', '--border': '#e2e8f0', '--danger': '#ef4444' } },
  midnight: { name: 'Midnight Blue', vars: { '--bg': '#020617', '--surface': '#0f172a', '--surface-hover': '#1e293b', '--primary': '#0ea5e9', '--primary-hover': '#0284c7', '--text': '#f0f9ff', '--text-muted': '#94a3b8', '--border': '#1e293b', '--danger': '#f43f5e' } },
  emerald: { name: 'Emerald Secure', vars: { '--bg': '#022c22', '--surface': '#064e3b', '--surface-hover': '#065f46', '--primary': '#10b981', '--primary-hover': '#059669', '--text': '#ecfdf5', '--text-muted': '#a7f3d0', '--border': '#065f46', '--danger': '#ef4444' } },
  sunset: { name: 'Sunset Orange', vars: { '--bg': '#2a1a14', '--surface': '#3d251d', '--surface-hover': '#4f3025', '--primary': '#f97316', '--primary-hover': '#ea580c', '--text': '#fff7ed', '--text-muted': '#fdba74', '--border': '#4f3025', '--danger': '#ef4444' } },
  royal: { name: 'Royal Purple', vars: { '--bg': '#170a2c', '--surface': '#2e1065', '--surface-hover': '#3b0764', '--primary': '#a855f7', '--primary-hover': '#9333ea', '--text': '#faf5ff', '--text-muted': '#d8b4fe', '--border': '#4c1d95', '--danger': '#ef4444' } },
  rose: { name: 'Rose Modern', vars: { '--bg': '#2e1021', '--surface': '#4c0519', '--surface-hover': '#881337', '--primary': '#f43f5e', '--primary-hover': '#e11d48', '--text': '#fff1f2', '--text-muted': '#fecdd3', '--border': '#881337', '--danger': '#ef4444' } },
  cyber: { name: 'Cyber Neon', vars: { '--bg': '#000000', '--surface': '#09090b', '--surface-hover': '#18181b', '--primary': '#22c55e', '--primary-hover': '#16a34a', '--text': '#ffffff', '--text-muted': '#a1a1aa', '--border': '#27272a', '--danger': '#e11d48' } },
  forest: { name: 'Forest Calm', vars: { '--bg': '#1c241c', '--surface': '#283628', '--surface-hover': '#334733', '--primary': '#4ade80', '--primary-hover': '#22c55e', '--text': '#f0fdf4', '--text-muted': '#bbf7d0', '--border': '#334733', '--danger': '#ef4444' } },
  steel: { name: 'Steel Gray', vars: { '--bg': '#0f172a', '--surface': '#1e293b', '--surface-hover': '#334155', '--primary': '#cbd5e1', '--primary-hover': '#94a3b8', '--text': '#f8fafc', '--text-muted': '#94a3b8', '--border': '#334155', '--danger': '#ef4444' } },
};

const TRANSLATIONS = {
  pt: {
    welcome: 'Bem-vindo ao PassVault',
    createMasterDesc: 'Crie uma palavra-passe mestra forte para proteger o seu cofre. Não a perca, não poderá ser recuperada.',
    unlockDesc: 'Insira a sua palavra-passe mestra para aceder ao cofre remoto.',
    masterPassword: 'Palavra-passe Mestra',
    confirmMasterPassword: 'Confirmar Palavra-passe Mestra',
    createVault: 'Criar Cofre na Base de Dados',
    unlockVault: 'Desbloquear Cofre',
    passwordsMismatch: 'As palavras-passe não coincidem.',
    invalidPassword: 'Palavra-passe incorreta ou cofre não encontrado.',
    dashboard: 'Painel',
    passwords: 'Palavras-passe',
    cards: 'Cartões',
    generator: 'Gerador',
    settings: 'Definições',
    search: 'Pesquisar...',
    totalPasswords: 'Total de Passwords',
    totalCards: 'Total de Cartões',
    recent: 'Adicionados Recentemente',
    favorites: 'Favoritos',
    quickActions: 'Ações Rápidas',
    addPassword: 'Nova Password',
    addCard: 'Novo Cartão',
    serviceName: 'Nome do Serviço / App',
    url: 'Website / URL',
    username: 'Nome de Utilizador / Email',
    password: 'Palavra-passe',
    notes: 'Notas (Opcional)',
    category: 'Categoria',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Apagar',
    edit: 'Editar',
    copy: 'Copiar',
    copied: 'Copiado!',
    generate: 'Gerar',
    length: 'Comprimento',
    uppercase: 'Letras Maiúsculas (A-Z)',
    lowercase: 'Letras Minúsculas (a-z)',
    numbers: 'Números (0-9)',
    symbols: 'Símbolos (!@#$)',
    cardNumber: 'Número do Cartão',
    cardHolder: 'Nome do Titular',
    expiry: 'Validade (MM/AA)',
    cvv: 'CVV',
    pin: 'PIN / Código Secreto',
    theme: 'Tema Visual',
    language: 'Idioma',
    timeout: 'Bloqueio Automático (Minutos)',
    never: 'Nunca',
    logout: 'Bloquear Agora',
    weak: 'Fraca',
    medium: 'Média',
    strong: 'Forte',
    noData: 'Nenhum registo encontrado.',
    confirmDelete: 'Tem a certeza que deseja apagar este registo?',
    newCategory: 'Nova Categoria',
    categoryName: 'Nome da Categoria',
    all: 'Todos',
    items: 'itens',
    smartFill: 'Autopreencher (IA)',
    smartPassphrase: '✨ Passphrase Temática',
    themePrompt: 'Tema (ex: Espaço, Cinema)',
    generating: 'A gerar...',
  },
  en: {
    welcome: 'Welcome to PassVault',
    createMasterDesc: 'Create a strong master password to secure your vault. Do not lose it, it cannot be recovered.',
    unlockDesc: 'Enter your master password to access your remote vault.',
    masterPassword: 'Master Password',
    confirmMasterPassword: 'Confirm Master Password',
    createVault: 'Create Secure Vault',
    unlockVault: 'Unlock Vault',
    passwordsMismatch: 'Passwords do not match.',
    invalidPassword: 'Invalid password or server error.',
    dashboard: 'Dashboard',
    passwords: 'Passwords',
    cards: 'Cards',
    generator: 'Generator',
    settings: 'Settings',
    search: 'Search...',
    totalPasswords: 'Total Passwords',
    totalCards: 'Total Cards',
    recent: 'Recently Added',
    favorites: 'Favorites',
    quickActions: 'Quick Actions',
    addPassword: 'New Password',
    addCard: 'New Card',
    serviceName: 'Service / App Name',
    url: 'Website / URL',
    username: 'Username / Email',
    password: 'Password',
    notes: 'Notes (Optional)',
    category: 'Category',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    copy: 'Copy',
    copied: 'Copied!',
    generate: 'Generate',
    length: 'Length',
    uppercase: 'Uppercase (A-Z)',
    lowercase: 'Lowercase (a-z)',
    numbers: 'Numbers (0-9)',
    symbols: 'Symbols (!@#$)',
    cardNumber: 'Card Number',
    cardHolder: 'Cardholder Name',
    expiry: 'Expiry (MM/YY)',
    cvv: 'CVV',
    pin: 'PIN / Secret Code',
    theme: 'Visual Theme',
    language: 'Language',
    timeout: 'Auto-lock Timeout (Minutes)',
    never: 'Never',
    logout: 'Lock Now',
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
    noData: 'No records found.',
    confirmDelete: 'Are you sure you want to delete this record?',
    newCategory: 'New Category',
    categoryName: 'Category Name',
    all: 'All',
    items: 'items',
    smartFill: 'Smart Fill (AI)',
    smartPassphrase: '✨ Thematic Passphrase',
    themePrompt: 'Theme (e.g., Space, Movies)',
    generating: 'Generating...',
  },
  es: {
    welcome: 'Bienvenido a PassVault',
    createMasterDesc: 'Cree una contraseña maestra segura para su bóveda. No la pierda, no se puede recuperar.',
    unlockDesc: 'Introduzca su contraseña maestra para acceder a su bóveda remota.',
    masterPassword: 'Contraseña Maestra',
    confirmMasterPassword: 'Confirmar Contraseña',
    createVault: 'Crear Bóveda Segura',
    unlockVault: 'Desbloquear Bóveda',
    passwordsMismatch: 'Las contraseñas no coinciden.',
    invalidPassword: 'Contraseña inválida o error de servidor.',
    dashboard: 'Panel',
    passwords: 'Contraseñas',
    cards: 'Tarjetas',
    generator: 'Generador',
    settings: 'Ajustes',
    search: 'Buscar...',
    totalPasswords: 'Total Contraseñas',
    totalCards: 'Total Tarjetas',
    recent: 'Añadidos Recientemente',
    favorites: 'Favoritos',
    quickActions: 'Acciones Rápidas',
    addPassword: 'Nueva Contraseña',
    addCard: 'Nueva Tarjeta',
    serviceName: 'Nombre del Servicio / App',
    url: 'Sitio Web / URL',
    username: 'Usuario / Email',
    password: 'Contraseña',
    notes: 'Notas (Opcional)',
    category: 'Categoría',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Borrar',
    edit: 'Editar',
    copy: 'Copiar',
    copied: '¡Copiado!',
    generate: 'Generar',
    length: 'Longitud',
    uppercase: 'Mayúsculas (A-Z)',
    lowercase: 'Minúsculas (a-z)',
    numbers: 'Números (0-9)',
    symbols: 'Símbolos (!@#$)',
    cardNumber: 'Número de Tarjeta',
    cardHolder: 'Titular de la Tarjeta',
    expiry: 'Caducidad (MM/AA)',
    cvv: 'CVV',
    pin: 'PIN / Código Secreto',
    theme: 'Tema Visual',
    language: 'Idioma',
    timeout: 'Bloqueo Automático (Minutos)',
    never: 'Nunca',
    logout: 'Bloquear Ahora',
    weak: 'Débil',
    medium: 'Media',
    strong: 'Fuerte',
    noData: 'No se encontraron registros.',
    confirmDelete: '¿Está seguro de que desea borrar este registro?',
    newCategory: 'Nueva Categoría',
    categoryName: 'Nombre de la Categoría',
    all: 'Todos',
    items: 'elementos',
    smartFill: 'Autocompletar (IA)',
    smartPassphrase: '✨ Frase de Contraseña Temática',
    themePrompt: 'Tema (ej: Espacio, Cine)',
    generating: 'Generando...',
  }
};

const DEFAULT_CATEGORIES = ['Streaming', 'Social', 'Work', 'Finance', 'Shopping', 'Other'];

// ==========================================
// 2. CONTEXT & STATE MANAGEMENT
// ==========================================
const AppContext = createContext();

const AppProvider = ({ children }) => {
  // Settings visuais (mantemos no localStorage para persistência do browser)
  const [theme, setTheme] = useState(localStorage.getItem('pv_theme') || 'dark');
  const [lang, setLang] = useState(localStorage.getItem('pv_lang') || 'pt');
  const [timeoutMinutes, setTimeoutMinutes] = useState(Number(localStorage.getItem('pv_timeout')) || 5);
  
  // Estado de Autenticação
  const [isLocked, setIsLocked] = useState(true);
  const [masterHash, setMasterHash] = useState(sessionStorage.getItem('pv_master_hash') || null);
  
  // Estado do Cofre (Agora inicializado vazio, preenchido via Postgres)
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [passwords, setPasswords] = useState([]);
  const [cards, setCards] = useState([]);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);

  // Guardar apenas configs no localstorage
  useEffect(() => { localStorage.setItem('pv_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('pv_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('pv_timeout', timeoutMinutes); }, [timeoutMinutes]);

  // Aplicação da Base de Dados PostgreSQL (Auto-Sync)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { 
      isInitialMount.current = false; 
      return; 
    }
    if (isLocked || !masterHash) return;

    // Sincroniza ativamente com o servidor sempre que houver mudanças
    fetch(`${API_URL}/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: masterHash, categories, passwords, cards })
    }).catch(err => console.error("Falha ao sincronizar com Postgres:", err));
  }, [categories, passwords, cards, isLocked, masterHash]);

  // Apply Theme CSS Variables
  useEffect(() => {
    const root = document.documentElement;
    const vars = THEMES[theme].vars;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme]);

  // Auto-Lock Timeout Logic
  useEffect(() => {
    if (isLocked || timeoutMinutes === 0) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLocked(true);
        sessionStorage.removeItem('pv_master_hash');
        setMasterHash(null);
      }, timeoutMinutes * 60000);
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    resetTimer();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [isLocked, timeoutMinutes]);

  const t = (key) => TRANSLATIONS[lang][key] || key;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast(t('copied'));
  };

  const contextValue = {
    theme, setTheme, lang, setLang, timeoutMinutes, setTimeoutMinutes,
    isLocked, setIsLocked, masterHash, setMasterHash,
    categories, setCategories,
    passwords, setPasswords, cards, setCards,
    activeTab, setActiveTab, t, showToast, copyToClipboard
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      {toast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-[var(--primary)] text-white px-4 py-2 rounded-full shadow-lg flex items-center z-50 animate-bounce">
          <Check size={16} className="mr-2" />
          <span className="font-medium">{toast}</span>
        </div>
      )}
    </AppContext.Provider>
  );
};

// ==========================================
// 3. UTILITY COMPONENTS & FUNCTIONS
// ==========================================

const callGemini = async (prompt, schema) => {
  const apiKey = "AIzaSyDvuU7yOxgU8MzTw_kXcnQ31VmZsit63DY"; // Canvas environment API key, mas pode colocar a sua aqui no seu código local
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  };

  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (err) {
      if (i === 4) throw err;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
};

const getFavicon = (url) => {
  if (!url) return null;
  try {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch { return null; }
};

const getCardType = (number) => {
  const clean = number.replace(/\D/g, '');
  if (clean.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(clean)) return 'Mastercard';
  if (/^3[47]/.test(clean)) return 'Amex';
  return 'Card';
};

const formatCardNumber = (number) => {
  return number.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
};

const checkPasswordStrength = (pwd) => {
  let score = 0;
  if (!pwd) return { score: 0, label: 'weak', color: 'bg-[var(--danger)]' };
  if (pwd.length > 8) score += 1;
  if (pwd.length > 12) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score < 3) return { score, label: 'weak', color: 'bg-[var(--danger)]' };
  if (score < 5) return { score, label: 'medium', color: 'bg-yellow-500' };
  return { score, label: 'strong', color: 'bg-[var(--primary)]' };
};

// Input Component
const Input = ({ label, type = 'text', icon: Icon, rightIcon, onRightIconClick, className = '', ...props }) => (
  <div className={`flex flex-col mb-4 ${className}`}>
    {label && <label className="text-sm font-medium text-[var(--text-muted)] mb-1">{label}</label>}
    <div className="relative flex items-center">
      {Icon && <Icon size={18} className="absolute left-3 text-[var(--text-muted)]" />}
      <input
        type={type}
        className={`w-full bg-[var(--surface-hover)] text-[var(--text)] border border-[var(--border)] rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all ${Icon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''}`}
        {...props}
      />
      {rightIcon && (
        <button type="button" onClick={onRightIconClick} className="absolute right-3 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          {rightIcon}
        </button>
      )}
    </div>
  </div>
);

// Button Component
const Button = ({ children, variant = 'primary', icon: Icon, className = '', disabled, ...props }) => {
  const baseStyle = "flex items-center justify-center font-medium rounded-xl py-2.5 px-4 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-md shadow-[var(--primary)]/20",
    secondary: "bg-[var(--surface-hover)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)]",
    danger: "bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white",
    ghost: "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
  };
  return (
    <button disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon size={18} className={children ? 'mr-2' : ''} />}
      {children}
    </button>
  );
};

// Temporary Reveal Wrapper
const SecretText = ({ text, mask = '••••••••' }) => {
  const [revealed, setRevealed] = useState(false);
  const { copyToClipboard } = useContext(AppContext);

  const handleReveal = () => {
    setRevealed(true);
    setTimeout(() => setRevealed(false), 5000);
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="font-mono text-[var(--text)] tracking-wider">
        {revealed ? text : mask}
      </span>
      <button onClick={handleReveal} className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
        {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <button onClick={() => copyToClipboard(text)} className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
        <Copy size={16} />
      </button>
    </div>
  );
};

// Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
          <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]"><X size={20} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// ==========================================
// 4. SCREENS
// ==========================================

const AuthScreen = () => {
  const { masterHash, setMasterHash, setIsLocked, t, setPasswords, setCards, setCategories } = useContext(AppContext);
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [isSetupState, setIsSetupState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Consulta à API Docker/Postgres em vez de localstorage
  useEffect(() => {
    fetch(`${API_URL}/status`)
      .then(res => res.json())
      .then(data => {
        setIsSetupState(!data.isSetup);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("API Error:", err);
        setError("Não foi possível conectar à API Postgres. Verifique o servidor.");
        setIsLoading(false);
      });
  }, []);

  const hash = (str) => btoa(str); 

  const handleSetup = async (e) => {
    e.preventDefault();
    if (pwd !== confirmPwd) { setError(t('passwordsMismatch')); return; }
    if (pwd.length < 6) { setError('Password too short (min 6)'); return; }
    
    setIsLoading(true);
    const h = hash(pwd);
    try {
      const res = await fetch(`${API_URL}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: h })
      });
      if (res.ok) {
        setMasterHash(h);
        sessionStorage.setItem('pv_master_hash', h);
        setIsLocked(false);
      } else {
        const err = await res.json();
        setError(err.error || "Erro de servidor");
      }
    } catch(err) {
      setError("Falha de rede. Servidor Docker em execução?");
    }
    setIsLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const h = hash(pwd);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: h })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || DEFAULT_CATEGORIES);
        setPasswords(data.passwords || []);
        setCards(data.cards || []);
        
        setMasterHash(h);
        sessionStorage.setItem('pv_master_hash', h);
        setError('');
        setIsLocked(false);
      } else {
        setError(t('invalidPassword'));
      }
    } catch(err) {
      setError("Falha de rede. Servidor Docker em execução?");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-md w-full bg-[var(--surface)] p-8 rounded-3xl shadow-2xl border border-[var(--border)] text-center">
        <div className="mx-auto w-16 h-16 bg-[var(--primary)]/20 rounded-2xl flex items-center justify-center mb-6 text-[var(--primary)]">
          <Shield size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('welcome')}</h1>
        <p className="text-[var(--text-muted)] mb-8 text-sm">
          {isLoading ? "A ligar à Base de Dados..." : (isSetupState ? t('createMasterDesc') : t('unlockDesc'))}
        </p>

        <form onSubmit={isSetupState ? handleSetup : handleLogin} className="space-y-4 text-left">
          <Input 
            label={t('masterPassword')} 
            type="password" 
            icon={Lock} 
            value={pwd} 
            onChange={e => setPwd(e.target.value)} 
            required autoFocus
            disabled={isLoading}
          />
          {isSetupState && !isLoading && (
            <Input 
              label={t('confirmMasterPassword')} 
              type="password" 
              icon={Lock} 
              value={confirmPwd} 
              onChange={e => setConfirmPwd(e.target.value)} 
              required 
            />
          )}
          {error && <p className="text-[var(--danger)] text-sm flex items-center"><AlertTriangle size={14} className="mr-1"/> {error}</p>}
          <Button type="submit" disabled={isLoading} className="w-full mt-4 py-3 text-lg" icon={isLoading ? Loader2 : (isSetupState ? Shield : Unlock)}>
            {isLoading ? "A carregar..." : (isSetupState ? t('createVault') : t('unlockVault'))}
          </Button>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { passwords, cards, setActiveTab, t } = useContext(AppContext);
  
  const recentPasswords = [...passwords].sort((a,b) => b.date - a.date).slice(0,3);
  const favorites = passwords.filter(p => p.favorite);

  return (
    <div className="space-y-6 animate-in fade-in">
      <h1 className="text-2xl font-bold text-[var(--text)]">{t('dashboard')}</h1>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[var(--text-muted)] text-sm font-medium">{t('totalPasswords')}</p>
            <p className="text-3xl font-bold text-[var(--text)] mt-1">{passwords.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
            <Key size={24} />
          </div>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[var(--text-muted)] text-sm font-medium">{t('totalCards')}</p>
            <p className="text-3xl font-bold text-[var(--text)] mt-1">{cards.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
            <CreditCard size={24} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">{t('quickActions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button variant="secondary" onClick={() => setActiveTab('passwords')} icon={Plus} className="text-sm">{t('addPassword')}</Button>
          <Button variant="secondary" onClick={() => setActiveTab('cards')} icon={Plus} className="text-sm">{t('addCard')}</Button>
          <Button variant="secondary" onClick={() => setActiveTab('generator')} icon={RefreshCw} className="text-sm">{t('generator')}</Button>
          <Button variant="secondary" onClick={() => setActiveTab('settings')} icon={Settings} className="text-sm">{t('settings')}</Button>
        </div>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center"><Star size={16} className="mr-2 text-yellow-500"/> {t('favorites')}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {favorites.map(fav => (
              <div key={fav.id} className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)] flex items-center space-x-3 cursor-pointer hover:border-[var(--primary)] transition-colors" onClick={() => setActiveTab('passwords')}>
                <img src={getFavicon(fav.url)} alt="" className="w-8 h-8 rounded-full bg-[var(--bg)] p-1 object-contain" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                <div className="w-8 h-8 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] hidden items-center justify-center font-bold text-sm">{fav.title.charAt(0)}</div>
                <div>
                  <p className="font-medium text-[var(--text)]">{fav.title}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate max-w-[150px]">{fav.username}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center"><Clock size={16} className="mr-2"/> {t('recent')}</h2>
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
          {recentPasswords.map((item, i) => (
            <div key={item.id} className={`p-4 flex items-center justify-between ${i !== recentPasswords.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
               <div className="flex items-center space-x-3">
                 <img src={getFavicon(item.url)} alt="" className="w-8 h-8 rounded bg-[var(--bg)] p-0.5" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                 <div className="w-8 h-8 rounded bg-[var(--primary)]/20 text-[var(--primary)] hidden items-center justify-center font-bold text-sm">{item.title.charAt(0)}</div>
                 <div>
                   <p className="font-medium text-[var(--text)]">{item.title}</p>
                   <p className="text-xs text-[var(--text-muted)]">{new Date(item.date).toLocaleDateString()}</p>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PasswordManager = () => {
  const { passwords, setPasswords, categories, setCategories, t, copyToClipboard, showToast } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [form, setForm] = useState({ title: '', url: '', username: '', password: '', notes: '', category: 'Other', favorite: false });
  const [showPwdInForm, setShowPwdInForm] = useState(false);
  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false);

  const filtered = useMemo(() => {
    return passwords.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.username.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCat === 'All' || (filterCat === 'Favorites' ? p.favorite : p.category === filterCat);
      return matchSearch && matchCat;
    });
  }, [passwords, search, filterCat]);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setForm(item);
    } else {
      setEditingItem(null);
      setForm({ title: '', url: '', username: '', password: '', notes: '', category: 'Other', favorite: false });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editingItem) {
      setPasswords(prev => prev.map(p => p.id === editingItem.id ? { ...form, id: p.id, date: Date.now() } : p));
    } else {
      setPasswords(prev => [{ ...form, id: Date.now().toString(), date: Date.now() }, ...prev]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if(window.confirm(t('confirmDelete'))) {
      setPasswords(prev => prev.filter(p => p.id !== id));
      setIsModalOpen(false);
    }
  };

  const handleSmartFill = async () => {
    if (!form.title && !form.url) {
      showToast("Insira o Nome ou URL primeiro.");
      return;
    }
    setIsGeneratingInfo(true);
    try {
      const prompt = `Analise o serviço com o nome "${form.title}" e URL "${form.url}". Escolha a melhor categoria para este serviço a partir desta exata lista: [${categories.join(', ')}]. Se não houver uma correspondência clara, use a categoria "Other". Além disso, crie uma breve nota de 1 frase descrevendo o propósito deste serviço em poucas palavras.`;
      const schema = {
        type: "OBJECT",
        properties: {
          category: { type: "STRING" },
          notes: { type: "STRING" }
        }
      };
      const result = await callGemini(prompt, schema);
      if (result) {
        setForm(prev => ({ 
          ...prev, 
          category: categories.includes(result.category) ? result.category : prev.category,
          notes: result.notes || prev.notes
        }));
        showToast("Informação preenchida com ✨ IA!");
      }
    } catch (error) {
      showToast("Erro ao contactar a IA.");
    } finally {
      setIsGeneratingInfo(false);
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (newCatName && !categories.includes(newCatName)) {
      setCategories(prev => [...prev, newCatName]);
      setFilterCat(newCatName);
    }
    setIsCatModalOpen(false);
    setNewCatName('');
  };

  const getCatCount = (cat) => {
    if (cat === 'All') return passwords.length;
    if (cat === 'Favorites') return passwords.filter(p => p.favorite).length;
    return passwords.filter(p => p.category === cat).length;
  };

  return (
    <div className="space-y-4 animate-in fade-in h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-[var(--text)]">{t('passwords')}</h1>
        <Button onClick={() => handleOpenModal()} icon={Plus}>{t('addPassword')}</Button>
      </div>

      <div className="flex space-x-3 overflow-x-auto pb-4 pt-1 scrollbar-hide snap-x">
        {['All', 'Favorites', ...categories].map(cat => (
          <div 
            key={cat} 
            onClick={() => setFilterCat(cat)} 
            className={`snap-start flex flex-col items-start justify-center min-w-[130px] p-4 rounded-2xl border cursor-pointer transition-all ${filterCat === cat ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-md' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)]'}`}
          >
            <div className="flex items-center space-x-2 mb-1">
              {cat === 'Favorites' && <Star size={16} className={filterCat === cat ? 'text-white fill-current' : 'text-yellow-500'} />}
              <span className="font-semibold text-sm truncate max-w-[100px]">{cat === 'All' ? t('all') : cat}</span>
            </div>
            <span className={`text-xs ${filterCat === cat ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{getCatCount(cat)} {t('items')}</span>
          </div>
        ))}
        
        <div 
          onClick={() => setIsCatModalOpen(true)}
          className="snap-start flex flex-col items-center justify-center min-w-[130px] p-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 cursor-pointer transition-all hover:border-[var(--primary)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--primary)]"
        >
          <Plus size={20} className="mb-1" />
          <span className="font-semibold text-sm">{t('newCategory')}</span>
        </div>
      </div>

      <Input placeholder={t('search')} icon={Search} value={search} onChange={e => setSearch(e.target.value)} className="mb-0"/>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        {filtered.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-10">{t('noData')}</div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] flex items-center justify-between group hover:border-[var(--primary)] transition-all">
              <div className="flex items-center space-x-4 flex-1 overflow-hidden">
                <img src={getFavicon(item.url)} alt="" className="w-10 h-10 rounded-xl bg-[var(--bg)] p-1 object-contain" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/20 text-[var(--primary)] hidden items-center justify-center font-bold text-lg">{item.title.charAt(0)}</div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-[var(--text)] truncate cursor-pointer hover:text-[var(--primary)]" onClick={() => handleOpenModal(item)}>{item.title}</h3>
                    {item.favorite && <Star size={14} className="text-yellow-500 fill-current" />}
                  </div>
                  <p className="text-sm text-[var(--text-muted)] truncate">{item.username}</p>
                </div>
              </div>

              <div className="flex items-center space-x-1 sm:space-x-2 ml-4">
                <div className="hidden sm:block mr-4">
                   <SecretText text={item.password} />
                </div>
                <button onClick={() => copyToClipboard(item.username)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg tooltip-trigger"><Copy size={18} /></button>
                <button onClick={() => handleOpenModal(item)} className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg"><Edit size={18} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t('edit') : t('addPassword')}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-center mb-4">
            <img src={getFavicon(form.url)} alt="" className="w-16 h-16 rounded-2xl bg-[var(--bg)] p-2 border border-[var(--border)]" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/20 text-[var(--primary)] hidden items-center justify-center font-bold text-2xl border border-[var(--border)]">{form.title ? form.title.charAt(0) : <Globe/>}</div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setForm({...form, favorite: !form.favorite})} className={`text-sm flex items-center ${form.favorite ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`}>
              <Star size={16} className={`mr-1 ${form.favorite ? 'fill-current' : ''}`} /> {t('favorites')}
            </button>
            <div className="flex items-center space-x-2">
              <button 
                type="button" 
                onClick={handleSmartFill} 
                disabled={isGeneratingInfo || (!form.title && !form.url)}
                className="flex items-center text-xs font-medium px-2 py-1 rounded bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-500 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/30 transition-all disabled:opacity-50"
              >
                {isGeneratingInfo ? <Loader2 size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="mr-1"/>}
                {t('smartFill')}
              </button>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="bg-transparent text-sm text-[var(--text)] border border-[var(--border)] rounded-lg p-1 outline-none">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <Input label={t('serviceName')} value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          <Input label={t('url')} value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://" />
          <Input label={t('username')} value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
          
          <div className="relative">
            <Input label={t('password')} type={showPwdInForm ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} rightIcon={showPwdInForm ? <EyeOff size={18}/> : <Eye size={18}/>} onRightIconClick={() => setShowPwdInForm(!showPwdInForm)} required />
            {form.password && (
               <div className="absolute top-1 right-1 flex items-center space-x-1">
                 <div className={`h-1.5 w-10 rounded-full ${checkPasswordStrength(form.password).color}`}></div>
               </div>
            )}
          </div>

          <Input label={t('notes')} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />

          <div className="flex space-x-3 pt-4">
            {editingItem && <Button type="button" variant="danger" icon={Trash} onClick={() => handleDelete(editingItem.id)} className="px-3" />}
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">{t('cancel')}</Button>
            <Button type="submit" className="flex-1">{t('save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title={t('newCategory')}>
        <form onSubmit={handleAddCategory} className="space-y-4">
          <Input label={t('categoryName')} value={newCatName} onChange={e => setNewCatName(e.target.value)} required autoFocus />
          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsCatModalOpen(false)} className="flex-1">{t('cancel')}</Button>
            <Button type="submit" className="flex-1">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const CardManager = () => {
  const { cards, setCards, t, copyToClipboard } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [form, setForm] = useState({ name: '', number: '', holder: '', expiry: '', cvv: '', pin: '', color: 'from-blue-600 to-blue-900' });

  const CARD_COLORS = [
    'from-blue-600 to-blue-900', 'from-gray-700 to-black', 'from-emerald-500 to-emerald-900',
    'from-rose-500 to-rose-900', 'from-purple-600 to-purple-900', 'from-orange-500 to-red-600'
  ];

  const handleOpenModal = (item = null) => {
    if (item) { setEditingItem(item); setForm(item); }
    else { setEditingItem(null); setForm({ name: '', number: '', holder: '', expiry: '', cvv: '', pin: '', color: CARD_COLORS[0] }); }
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editingItem) { setCards(prev => prev.map(c => c.id === editingItem.id ? { ...form, id: c.id, date: Date.now() } : c)); }
    else { setCards(prev => [{ ...form, id: Date.now().toString(), date: Date.now() }, ...prev]); }
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if(window.confirm(t('confirmDelete'))) { setCards(prev => prev.filter(c => c.id !== id)); setIsModalOpen(false); }
  };

  // Visual Card Component
  const VisualCard = ({ card, onClick }) => {
    const type = getCardType(card.number);
    return (
      <div onClick={onClick} className={`relative h-48 rounded-2xl p-6 text-white shadow-xl cursor-pointer transform transition-transform hover:scale-[1.02] bg-gradient-to-br ${card.color} overflow-hidden group border border-white/10`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/20 rounded-full blur-xl -ml-5 -mb-5"></div>
        
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold tracking-wider text-white/90">{card.name || 'My Card'}</h3>
            <span className="font-bold italic text-lg opacity-80">{type}</span>
          </div>
          <div>
            <div className="font-mono text-xl tracking-widest mb-2 flex items-center group-hover:text-white text-white/80 transition-colors">
              {card.number ? formatCardNumber(card.number).replace(/\d(?=\d{4})/g, "•") : '•••• •••• •••• ••••'}
            </div>
            <div className="flex justify-between text-sm text-white/70">
              <span className="uppercase tracking-widest">{card.holder || 'NAME'}</span>
              <span className="font-mono">{card.expiry || 'MM/YY'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-[var(--text)]">{t('cards')}</h1>
        <Button onClick={() => handleOpenModal()} icon={Plus}>{t('addCard')}</Button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {cards.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-10">{t('noData')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map(card => <VisualCard key={card.id} card={card} onClick={() => handleOpenModal(card)} />)}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t('edit') : t('addCard')}>
        <div className="mb-6"><VisualCard card={form} /></div>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t('serviceName')} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Personal Visa" required />
          <Input label={t('cardNumber')} value={formatCardNumber(form.number)} onChange={e => setForm({...form, number: e.target.value.replace(/\D/g, '')})} maxLength={19} required />
          <Input label={t('cardHolder')} value={form.holder} onChange={e => setForm({...form, holder: e.target.value.toUpperCase()})} />
          
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('expiry')} value={form.expiry} onChange={e => setForm({...form, expiry: e.target.value})} placeholder="MM/YY" />
            <Input label={t('cvv')} type="password" value={form.cvv} onChange={e => setForm({...form, cvv: e.target.value.replace(/\D/g, '')})} maxLength={4} />
            <Input label={t('pin')} type="password" value={form.pin} onChange={e => setForm({...form, pin: e.target.value.replace(/\D/g, '')})} maxLength={6} />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Card Style</label>
            <div className="flex space-x-2">
              {CARD_COLORS.map(color => (
                <button key={color} type="button" onClick={() => setForm({...form, color})} className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} ${form.color === color ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--primary)]' : ''}`} />
              ))}
            </div>
          </div>

          {editingItem && (
             <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)] mt-4 space-y-2">
               <div className="flex justify-between items-center"><span className="text-sm text-[var(--text-muted)]">{t('cardNumber')}</span> <SecretText text={editingItem.number} mask="•••• •••• •••• ••••" /></div>
               <div className="flex justify-between items-center"><span className="text-sm text-[var(--text-muted)]">{t('cvv')}</span> <SecretText text={editingItem.cvv} mask="•••" /></div>
               <div className="flex justify-between items-center"><span className="text-sm text-[var(--text-muted)]">{t('pin')}</span> <SecretText text={editingItem.pin} mask="••••" /></div>
             </div>
          )}

          <div className="flex space-x-3 pt-4">
            {editingItem && <Button type="button" variant="danger" icon={Trash} onClick={() => handleDelete(editingItem.id)} className="px-3" />}
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">{t('cancel')}</Button>
            <Button type="submit" className="flex-1">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const PasswordGenerator = () => {
  const { t, copyToClipboard } = useContext(AppContext);
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, numbers: true, symbols: true });
  const [generated, setGenerated] = useState('');
  
  const [themePrompt, setThemePrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const generate = useCallback(() => {
    let chars = '';
    if (opts.upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.lower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.numbers) chars += '0123456789';
    if (opts.symbols) chars += '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    
    if (chars === '') { setGenerated(''); return; }
    
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGenerated(pwd);
  }, [length, opts]);

  useEffect(() => { generate(); }, [generate]);

  const handleSmartPassphrase = async () => {
    if (!themePrompt) return;
    setIsGeneratingAI(true);
    try {
      const prompt = `Gere uma passphrase altamente segura mas fácil de memorizar baseada exclusivamente no tema: "${themePrompt}". A passphrase deve consistir em 3 a 4 palavras (separadas por hífen). DEVE conter pelo menos uma letra maiúscula, um número e um símbolo especial (ex: !@#$%). A língua deve ser adequada ao tema sugerido. Exemplo de formato: Foguete-Espacial-99!.`;
      const schema = {
        type: "OBJECT",
        properties: {
          passphrase: { type: "STRING" }
        }
      };
      const result = await callGemini(prompt, schema);
      if (result && result.passphrase) {
        setGenerated(result.passphrase);
      }
    } catch (error) {
      // Fail silently
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const strength = checkPasswordStrength(generated);

  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl mx-auto pb-20">
      <h1 className="text-2xl font-bold text-[var(--text)]">{t('generator')}</h1>

      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="relative mb-6">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 font-mono text-center text-2xl text-[var(--text)] break-all tracking-wider min-h-[4rem] flex items-center justify-center">
            {generated || '---'}
          </div>
          <div className="absolute -bottom-1 left-0 w-full h-1 bg-[var(--surface-hover)] rounded-full overflow-hidden">
             <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: `${(strength.score / 5) * 100}%` }}></div>
          </div>
        </div>

        <div className="flex space-x-3 mb-8">
          <Button onClick={generate} icon={RefreshCw} className="flex-1 py-3">{t('generate')}</Button>
          <Button onClick={() => copyToClipboard(generated)} variant="secondary" icon={Copy} className="flex-1 py-3">{t('copy')}</Button>
        </div>

        {/* AI Generator Section */}
        <div className="mb-8 p-4 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
          <h3 className="text-sm font-semibold flex items-center mb-3 text-purple-500">
             <Sparkles size={16} className="mr-2" /> {t('smartPassphrase')}
          </h3>
          <div className="flex space-x-2">
            <input 
              type="text" 
              placeholder={t('themePrompt')}
              value={themePrompt}
              onChange={e => setThemePrompt(e.target.value)}
              className="flex-1 bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSmartPassphrase()}
            />
            <Button 
              onClick={handleSmartPassphrase} 
              disabled={isGeneratingAI || !themePrompt}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border-none px-4 text-white shadow-lg shadow-purple-500/20"
            >
              {isGeneratingAI ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-sm font-medium text-[var(--text)] mb-2">
              <span>{t('length')}</span>
              <span className="text-[var(--primary)]">{length}</span>
            </div>
            <input type="range" min="8" max="64" value={length} onChange={e => setLength(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </div>

          <div className="space-y-3">
            {[
              { id: 'upper', label: t('uppercase') },
              { id: 'lower', label: t('lowercase') },
              { id: 'numbers', label: t('numbers') },
              { id: 'symbols', label: t('symbols') }
            ].map(opt => (
              <label key={opt.id} className="flex items-center space-x-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${opts[opt.id] ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-[var(--text-muted)] text-transparent group-hover:border-[var(--primary)]'}`}>
                  <Check size={14} />
                </div>
                <input type="checkbox" className="hidden" checked={opts[opt.id]} onChange={() => {
                  const newOpts = { ...opts, [opt.id]: !opts[opt.id] };
                  if (!Object.values(newOpts).some(Boolean)) return; // Prevent unchecking all
                  setOpts(newOpts);
                }} />
                <span className="text-[var(--text)]">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsScreen = () => {
  const { theme, setTheme, lang, setLang, timeoutMinutes, setTimeoutMinutes, t, setIsLocked, setMasterHash } = useContext(AppContext);

  return (
    <div className="space-y-8 animate-in fade-in max-w-2xl mx-auto pb-20">
      <h1 className="text-2xl font-bold text-[var(--text)]">{t('settings')}</h1>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)] flex items-center"><Palette size={20} className="mr-2 text-[var(--primary)]"/> {t('theme')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(THEMES).map(([key, data]) => (
            <button key={key} onClick={() => setTheme(key)} className={`p-3 rounded-xl border-2 flex flex-col items-center space-y-2 transition-all ${theme === key ? 'border-[var(--primary)] bg-[var(--surface-hover)]' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]'}`}>
               <div className="w-8 h-8 rounded-full border border-black/20 shadow-inner" style={{ backgroundColor: data.vars['--bg'], border: `2px solid ${data.vars['--primary']}` }}></div>
               <span className="text-xs font-medium text-[var(--text)] text-center">{data.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)] flex items-center"><Globe size={20} className="mr-2 text-[var(--primary)]"/> {t('language')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {['pt', 'en', 'es'].map(l => (
            <button key={l} onClick={() => setLang(l)} className={`py-2 px-4 rounded-xl border text-sm font-medium uppercase transition-all ${lang === l ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'}`}>
               {l === 'pt' ? 'Português' : l === 'en' ? 'English' : 'Español'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)] flex items-center"><Clock size={20} className="mr-2 text-[var(--primary)]"/> {t('timeout')}</h2>
        <select value={timeoutMinutes} onChange={e => setTimeoutMinutes(Number(e.target.value))} className="w-full bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
          <option value={1}>1 min</option>
          <option value={5}>5 min</option>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={0}>{t('never')}</option>
        </select>
      </div>

      <div className="pt-8 border-t border-[var(--border)]">
        <Button variant="danger" icon={LogOut} className="w-full py-3" onClick={() => {
          setIsLocked(true);
          setMasterHash(null);
          sessionStorage.removeItem('pv_master_hash');
        }}>{t('logout')}</Button>
      </div>
    </div>
  );
};

// ==========================================
// 5. MAIN LAYOUT
// ==========================================

const MainLayout = () => {
  const { activeTab, setActiveTab, t, setIsLocked, setMasterHash } = useContext(AppContext);

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'passwords', icon: Key, label: t('passwords') },
    { id: 'cards', icon: CreditCard, label: t('cards') },
    { id: 'generator', icon: Hash, label: t('generator') },
    { id: 'settings', icon: Settings, label: t('settings') },
  ];

  const handleLock = () => {
    setIsLocked(true);
    setMasterHash(null);
    sessionStorage.removeItem('pv_master_hash');
  };

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="p-6 flex items-center space-x-3 text-[var(--primary)]">
          <Shield size={28} />
          <span className="text-xl font-bold tracking-wide text-[var(--text)]">PassVault</span>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}>
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[var(--border)]">
           <button onClick={handleLock} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] transition-all">
              <LogOut size={20} />
              <span className="font-medium">{t('logout')}</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20">
          <div className="flex items-center space-x-2 text-[var(--primary)]">
            <Shield size={24} />
            <span className="text-lg font-bold text-[var(--text)]">PassVault</span>
          </div>
          <button onClick={handleLock} className="text-[var(--text-muted)] p-2"><LogOut size={20}/></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'passwords' && <PasswordManager />}
          {activeTab === 'cards' && <CardManager />}
          {activeTab === 'generator' && <PasswordGenerator />}
          {activeTab === 'settings' && <SettingsScreen />}
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)]/90 backdrop-blur-lg border-t border-[var(--border)] flex justify-around p-2 pb-safe z-30">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center justify-center p-2 min-w-[4rem] rounded-xl transition-colors ${activeTab === item.id ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
              <div className={`p-1.5 rounded-full mb-1 ${activeTab === item.id ? 'bg-[var(--primary)]/10' : ''}`}>
                <item.icon size={20} />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
};

const AppContent = () => {
  const { isLocked } = useContext(AppContext);
  return isLocked ? <AuthScreen /> : <MainLayout />;
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}