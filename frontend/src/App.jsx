import React, { useState, useEffect, useContext, createContext, useMemo, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { startRegistration, startAuthentication, base64URLStringToBuffer } from '@simplewebauthn/browser';
import { BiometricAuth, AndroidBiometryStrength } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { 
  Lock, Unlock, Shield, Key, CreditCard, LayoutDashboard, Settings, Plus, 
  Search, Eye, EyeOff, Copy, Trash, Edit, Check, Star, AlertTriangle, 
  LogOut, Clock, Globe, Menu, X, ChevronRight, ChevronDown, Hash, RefreshCw, Palette, Sparkles, Loader2,
  Folder, FolderPlus, ArrowLeft, Upload, FileText, ArrowLeftRight
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÃO DA API (Backend Unraid)
// ==========================================
// Alterar 'localhost' para o IP do seu Unraid quando compilar (ex: 192.168.1.100)
const isNativeApp = Capacitor.getPlatform() !== 'web';
const API_URL = import.meta.env.VITE_API_URL || (isNativeApp ? 'https://passvault.barrosoportal.com/api' : 'http://localhost:3001/api');
const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === 'true';
const IS_ANDROID_NATIVE = Capacitor.getPlatform() === 'android';
const VAULT_KDF_ITERATIONS = 250000;
const PASSKEY_STORAGE_KEYS = {
  hasPasskeys: 'pv_has_passkeys',
  credentials: 'pv_passkey_credentials',
};
const ANDROID_BIOMETRIC_STORAGE_KEY = 'pv_android_biometric_vault';
const ANDROID_BIOMETRIC_ENABLED_KEY = 'pv_android_biometric_enabled';
const LAST_AUTH_IDENTIFIER_KEY = 'pv_last_auth_identifier';
const PASSWORDS_PENDING_CATEGORY_KEY = 'pv_passwords_pending_category';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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
    signIn: 'Entrar',
    signUp: 'Criar Conta',
    accountIdentifier: 'Email / Username',
    accountIdentifierPlaceholder: 'Insira o seu e-mail',
    createMasterDesc: 'Crie uma palavra-passe mestra forte para proteger o seu cofre. Não a perca, não poderá ser recuperada.',
    unlockDesc: 'Insira a sua palavra-passe mestra para aceder ao cofre remoto.',
    masterPassword: 'Palavra-passe Mestra',
    masterPasswordPlaceholder: 'Insira a sua palavra-passe',
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
    favorites: 'Favoritos',
    quickActions: 'Ações Rápidas',
    addPassword: 'Nova Password',
    addCard: 'Novo Cartão',
    vaultOverview: 'Visão do Cofre',
    passwordsSubtitle: 'Uma biblioteca de credenciais com leitura rápida, filtros claros e acesso imediato.',
    protectedEntries: 'Entradas protegidas',
    categoriesLabel: 'Categorias',
    folders: 'Pastas',
    foldersSubtitle: 'Escolhe uma pasta para veres as credenciais guardadas lá dentro.',
    backToFolders: 'Voltar às pastas',
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
    changeMasterPassword: 'Alterar Palavra-passe Mestra',
    currentMasterPassword: 'Palavra-passe Mestra Actual',
    newMasterPassword: 'Nova Palavra-passe Mestra',
    confirmNewMasterPassword: 'Confirmar Nova Palavra-passe',
    updateMasterPassword: 'Actualizar Palavra-passe',
    masterPasswordUpdated: 'Palavra-passe mestra actualizada.',
    weak: 'Fraca',
    medium: 'Média',
    strong: 'Forte',
    noData: 'Nenhum registo encontrado.',
    confirmDelete: 'Tem a certeza que deseja apagar este registo?',
    newCategory: 'Nova Categoria',
    editCategory: 'Editar Categoria',
    categoryName: 'Nome da Categoria',
    all: 'Todos',
    items: 'itens',
    smartFill: 'Autopreencher (IA)',
    smartPassphrase: '✨ Passphrase Temática',
    themePrompt: 'Tema (ex: Espaço, Cinema)',
    generating: 'A gerar...',
    loginWithBiometrics: 'Entrar com Biometria',
    registerBiometrics: 'Registar Biometria',
    disableBiometrics: 'Desligar Biometria',
    biometricsSection: 'Biometria / Passkeys',
    biometricAlreadyRegistered: 'Já existe uma passkey neste dispositivo.',
    biometricAlreadyRegisteredHint: 'Desliga a biometria existente antes de criar outra.',
    backupSection: 'Backup e Restauro',
    backupDescription: 'Exporta um backup encriptado no browser e restaura-o sem expor dados ao servidor.',
    backupPassword: 'Password do backup',
    backupPasswordPlaceholder: 'Usa uma password forte',
    exportBackup: 'Exportar backup encriptado',
    restoreBackup: 'Restaurar backup',
    bitwardenImportSection: 'Importar do Bitwarden',
    bitwardenImportDescription: 'Importa ficheiros CSV do Bitwarden para a categoria Other. Podes rever duplicados antes de gravar.',
    bitwardenImportSelect: 'Selecionar CSV do Bitwarden',
    bitwardenImportSelected: 'CSV selecionado',
    bitwardenImportHint: 'Os itens importados entram em Other. Os duplicados podem ser ignorados ou substituídos antes de gravar.',
    bitwardenImportReview: 'Revisão da importação',
    bitwardenImportSummary: 'Resumo da importação',
    bitwardenImportFile: 'Ficheiro',
    bitwardenImportTotal: 'Total',
    bitwardenImportNew: 'Novos',
    bitwardenImportDuplicates: 'Duplicados',
    bitwardenImportIgnored: 'Ignorados',
    bitwardenImportReplace: 'Substituir',
    bitwardenImportIgnore: 'Ignorar',
    bitwardenImportToOther: 'Importar para Other',
    bitwardenImportClear: 'Limpar importação',
    bitwardenImportNoFile: 'Seleciona um CSV exportado do Bitwarden para continuar.',
    removeOtherDuplicates: 'Eliminar duplicados em Other',
    removeOtherDuplicatesHint: 'Remove itens repetidos dentro da pasta Other.',
    removeOtherDuplicatesDone: 'Duplicados em Other removidos.',
    removeOtherDuplicatesNone: 'Não encontrei duplicados em Other.',
    removeOtherDuplicatesConfirm: 'Eliminar entradas duplicadas dentro de Other?',
  },
  en: {
    welcome: 'Welcome to PassVault',
    signIn: 'Sign In',
    signUp: 'Create Account',
    accountIdentifier: 'Email / Username',
    accountIdentifierPlaceholder: 'Enter your email',
    createMasterDesc: 'Create a strong master password to secure your vault. Do not lose it, it cannot be recovered.',
    unlockDesc: 'Enter your master password to access your remote vault.',
    masterPassword: 'Master Password',
    masterPasswordPlaceholder: 'Enter your password',
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
    favorites: 'Favorites',
    quickActions: 'Quick Actions',
    addPassword: 'New Password',
    addCard: 'New Card',
    vaultOverview: 'Vault Overview',
    passwordsSubtitle: 'A credential library with quick scanning, clean filters, and immediate access.',
    protectedEntries: 'Protected entries',
    categoriesLabel: 'Categories',
    folders: 'Folders',
    foldersSubtitle: 'Choose a folder to view the credentials stored inside it.',
    backToFolders: 'Back to folders',
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
    changeMasterPassword: 'Change Master Password',
    currentMasterPassword: 'Current Master Password',
    newMasterPassword: 'New Master Password',
    confirmNewMasterPassword: 'Confirm New Password',
    updateMasterPassword: 'Update Password',
    masterPasswordUpdated: 'Master password updated.',
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
    noData: 'No records found.',
    confirmDelete: 'Are you sure you want to delete this record?',
    newCategory: 'New Category',
    editCategory: 'Edit Category',
    categoryName: 'Category Name',
    all: 'All',
    items: 'items',
    smartFill: 'Smart Fill (AI)',
    smartPassphrase: '✨ Thematic Passphrase',
    themePrompt: 'Theme (e.g., Space, Movies)',
    generating: 'Generating...',
    loginWithBiometrics: 'Sign in with Biometrics',
    registerBiometrics: 'Register Biometrics',
    disableBiometrics: 'Disable Biometrics',
    biometricsSection: 'Biometrics / Passkeys',
    biometricAlreadyRegistered: 'A passkey is already registered on this device.',
    biometricAlreadyRegisteredHint: 'Disable the existing biometrics before creating another one.',
    backupSection: 'Backup & Restore',
    backupDescription: 'Export an encrypted backup in the browser and restore it without exposing data to the server.',
    backupPassword: 'Backup password',
    backupPasswordPlaceholder: 'Use a strong password',
    exportBackup: 'Export encrypted backup',
    restoreBackup: 'Restore backup',
    bitwardenImportSection: 'Import from Bitwarden',
    bitwardenImportDescription: 'Import Bitwarden CSV files into the Other category. You can review duplicates before saving.',
    bitwardenImportSelect: 'Select Bitwarden CSV',
    bitwardenImportSelected: 'CSV selected',
    bitwardenImportHint: 'Imported items go into Other. Duplicates can be ignored or replaced before saving.',
    bitwardenImportReview: 'Import review',
    bitwardenImportSummary: 'Import summary',
    bitwardenImportFile: 'File',
    bitwardenImportTotal: 'Total',
    bitwardenImportNew: 'New',
    bitwardenImportDuplicates: 'Duplicates',
    bitwardenImportIgnored: 'Ignored',
    bitwardenImportReplace: 'Replace',
    bitwardenImportIgnore: 'Ignore',
    bitwardenImportToOther: 'Import to Other',
    bitwardenImportClear: 'Clear import',
    bitwardenImportNoFile: 'Select a Bitwarden CSV export to continue.',
    removeOtherDuplicates: 'Remove duplicates in Other',
    removeOtherDuplicatesHint: 'Removes repeated items inside the Other folder.',
    removeOtherDuplicatesDone: 'Duplicates in Other removed.',
    removeOtherDuplicatesNone: 'No duplicates found in Other.',
    removeOtherDuplicatesConfirm: 'Remove duplicate entries inside Other?',
  },
  es: {
    welcome: 'Bienvenido a PassVault',
    signIn: 'Entrar',
    signUp: 'Crear Cuenta',
    accountIdentifier: 'Email / Usuario',
    accountIdentifierPlaceholder: 'Introduce tu e-mail',
    createMasterDesc: 'Cree una contraseña maestra segura para su bóveda. No la pierda, no se puede recuperar.',
    unlockDesc: 'Introduzca su contraseña maestra para acceder a su bóveda remota.',
    masterPassword: 'Contraseña Maestra',
    masterPasswordPlaceholder: 'Introduce tu contraseña',
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
    favorites: 'Favoritos',
    quickActions: 'Acciones Rápidas',
    addPassword: 'Nueva Contraseña',
    addCard: 'Nueva Tarjeta',
    vaultOverview: 'Vista de la Bóveda',
    passwordsSubtitle: 'Una biblioteca de credenciales con lectura rápida, filtros claros y acceso inmediato.',
    protectedEntries: 'Entradas protegidas',
    categoriesLabel: 'Categorías',
    folders: 'Carpetas',
    foldersSubtitle: 'Elige una carpeta para ver las credenciales guardadas dentro.',
    backToFolders: 'Volver a carpetas',
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
    changeMasterPassword: 'Cambiar Contraseña Maestra',
    currentMasterPassword: 'Contraseña Maestra Actual',
    newMasterPassword: 'Nueva Contraseña Maestra',
    confirmNewMasterPassword: 'Confirmar Nueva Contraseña',
    updateMasterPassword: 'Actualizar Contraseña',
    masterPasswordUpdated: 'Contraseña maestra actualizada.',
    weak: 'Débil',
    medium: 'Media',
    strong: 'Fuerte',
    noData: 'No se encontraron registros.',
    confirmDelete: '¿Está seguro de que desea borrar este registro?',
    newCategory: 'Nueva Categoría',
    editCategory: 'Editar Categoría',
    categoryName: 'Nombre de la Categoría',
    all: 'Todos',
    items: 'elementos',
    smartFill: 'Autocompletar (IA)',
    smartPassphrase: '✨ Frase de Contraseña Temática',
    themePrompt: 'Tema (ej: Espacio, Cine)',
    generating: 'Generando...',
    loginWithBiometrics: 'Entrar con Biometría',
    registerBiometrics: 'Registrar Biometría',
    disableBiometrics: 'Desactivar Biometría',
    biometricsSection: 'Biometría / Passkeys',
    biometricAlreadyRegistered: 'Ya existe una passkey en este dispositivo.',
    biometricAlreadyRegisteredHint: 'Desactiva la biometría existente antes de crear otra.',
    backupSection: 'Copia de seguridad y restauración',
    backupDescription: 'Exporta una copia encriptada en el navegador y restáurala sin exponer datos al servidor.',
    backupPassword: 'Contraseña de la copia',
    backupPasswordPlaceholder: 'Usa una contraseña fuerte',
    exportBackup: 'Exportar copia encriptada',
    restoreBackup: 'Restaurar copia',
    bitwardenImportSection: 'Importar desde Bitwarden',
    bitwardenImportDescription: 'Importa archivos CSV de Bitwarden a la categoría Other. Puedes revisar duplicados antes de guardar.',
    bitwardenImportSelect: 'Seleccionar CSV de Bitwarden',
    bitwardenImportSelected: 'CSV seleccionado',
    bitwardenImportHint: 'Los elementos importados entran en Other. Los duplicados pueden ignorarse o sustituirse antes de guardar.',
    bitwardenImportReview: 'Revisión de importación',
    bitwardenImportSummary: 'Resumen de importación',
    bitwardenImportFile: 'Archivo',
    bitwardenImportTotal: 'Total',
    bitwardenImportNew: 'Nuevos',
    bitwardenImportDuplicates: 'Duplicados',
    bitwardenImportIgnored: 'Ignorados',
    bitwardenImportReplace: 'Sustituir',
    bitwardenImportIgnore: 'Ignorar',
    bitwardenImportToOther: 'Importar a Other',
    bitwardenImportClear: 'Limpiar importación',
    bitwardenImportNoFile: 'Selecciona un CSV exportado de Bitwarden para continuar.',
    removeOtherDuplicates: 'Eliminar duplicados en Other',
    removeOtherDuplicatesHint: 'Elimina elementos repetidos dentro de la carpeta Other.',
    removeOtherDuplicatesDone: 'Duplicados en Other eliminados.',
    removeOtherDuplicatesNone: 'No encontré duplicados en Other.',
    removeOtherDuplicatesConfirm: '¿Eliminar entradas duplicadas dentro de Other?',
  }
};

const DEFAULT_CATEGORIES = [
  { name: 'Streaming', order: 0 },
  { name: 'Social', order: 1 },
  { name: 'Work', order: 2 },
  { name: 'Finance', order: 3 },
  { name: 'Shopping', order: 4 },
  { name: 'Other', order: 5 },
];

const CATEGORY_NEUTRAL = {
  base: 'hsl(215 16% 38%)',
  dark: 'hsl(215 18% 22%)',
  glow: 'hsla(215 16% 65% / 0.18)',
};

const createFolderColor = (order = 0) => {
  const seed = Number.isFinite(Number(order)) ? Number(order) : 0;
  const hue = (seed * 137.508) % 360;
  const saturation = 84 - ((seed % 4) * 6);
  const lightness = 55 - ((seed % 3) * 2);
  const darkLightness = Math.max(20, lightness - 24);
  return {
    base: `hsl(${hue} ${saturation}% ${lightness}%)`,
    dark: `hsl(${hue} ${saturation}% ${darkLightness}%)`,
    glow: `hsla(${hue} ${saturation}% 66% / 0.24)`,
  };
};

const normalizeCategories = (input = []) => {
  const items = Array.isArray(input) ? input : [];
  const normalized = items.map((cat, index) => {
    if (typeof cat === 'string') {
      return { name: cat, order: index };
    }
    if (cat && typeof cat === 'object') {
      return {
        name: cat.name || cat.title || `Category ${index + 1}`,
        order: Number.isFinite(Number(cat.order)) ? Number(cat.order) : index,
      };
    }
    return null;
  }).filter(Boolean);

  if (!normalized.some(cat => cat.name === 'Other')) {
    normalized.push({ name: 'Other', order: normalized.length + 1000 });
  }

  const otherOrder = normalized.find((cat) => cat.name === 'Other')?.order ?? (normalized.length + 1000);
  return normalized
    .sort((a, b) => a.order - b.order)
    .map((cat, index) => ({
      name: cat.name,
      order: cat.name === 'Other'
        ? otherOrder
        : (Number.isFinite(cat.order) ? Math.min(cat.order, otherOrder - 1) : index),
    }));
};

const getCategoryStyle = (category) => {
  const tone = category.name === 'Other' ? CATEGORY_NEUTRAL : createFolderColor(category.order);
  return {
    backgroundImage: `linear-gradient(145deg, ${tone.base}, ${tone.dark})`,
    boxShadow: `0 16px 30px -20px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.03), 0 0 24px ${tone.glow}`,
  };
};

const getCategoryName = (category) => (typeof category === 'string' ? category : category?.name || '');
const isSystemCategory = (name) => name === 'Other';
const sortCategoriesForDisplay = (input = []) => normalizeCategories(input).slice().sort((a, b) => {
  const aSystem = isSystemCategory(a.name);
  const bSystem = isSystemCategory(b.name);
  if (aSystem && bSystem) return 0;
  if (aSystem) return 1;
  if (bSystem) return -1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
});
const PREVIEW_PASSWORDS = [
  {
    id: 'demo-1',
    title: 'Netflix',
    url: 'https://netflix.com',
    username: 'andre@example.com',
    password: 'DemoPass!2026',
    notes: 'Subscription account',
    category: 'Streaming',
    favorite: true,
    date: Date.now() - 86400000,
  },
  {
    id: 'demo-2',
    title: 'GitHub',
    url: 'https://github.com',
    username: 'andrebarroso',
    password: 'Vault#Preview88',
    notes: 'Main dev account',
    category: 'Work',
    favorite: false,
    date: Date.now() - 172800000,
  },
  {
    id: 'demo-3',
    title: 'Revolut',
    url: 'https://revolut.com',
    username: 'andre@finance.pt',
    password: 'Secure-Card-11!',
    notes: 'Banking',
    category: 'Finance',
    favorite: true,
    date: Date.now() - 259200000,
  },
];
const PREVIEW_CARDS = [
  {
    id: 'card-demo-1',
    name: 'Main Visa',
    number: '4532123412341234',
    holder: 'ANDRE BARROSO',
    expiry: '09/29',
    cvv: '321',
    pin: '4821',
    color: 'from-blue-600 to-blue-900',
    date: Date.now() - 86400000,
  },
];

const readPreviewState = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const readStoredState = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const normalizeStorageScope = (value = '') => {
  const scope = String(value || '').trim().toLowerCase();
  return scope || 'global';
};

const getVaultStorageScope = (userId = '', identifier = '') => normalizeStorageScope(userId || identifier || 'global');
const getVaultStorageScopes = (userId = '', identifier = '') => {
  const scopes = [userId, identifier]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => normalizeStorageScope(value));
  return scopes.length ? [...new Set(scopes)] : ['global'];
};
const getPersistedAuthIdentifier = () => {
  const stored = sessionStorage.getItem('pv_auth_identifier') || localStorage.getItem(LAST_AUTH_IDENTIFIER_KEY) || '';
  const normalized = String(stored || '').trim();
  if (normalized.toLowerCase() === 'admin') {
    sessionStorage.removeItem('pv_auth_identifier');
    localStorage.removeItem(LAST_AUTH_IDENTIFIER_KEY);
    return '';
  }
  return normalized;
};
const setPersistedAuthIdentifier = (value = '') => {
  const normalized = String(value || '').trim();
  if (normalized) {
    localStorage.setItem(LAST_AUTH_IDENTIFIER_KEY, normalized);
  } else {
    localStorage.removeItem(LAST_AUTH_IDENTIFIER_KEY);
  }
};

const getScopedStorageKey = (baseKey, scope = 'global') => `${baseKey}:${normalizeStorageScope(scope)}`;

const readScopedStoredState = (baseKey, scope = 'global', fallback) => {
  const scopedKey = getScopedStorageKey(baseKey, scope);
  const scopedValue = readStoredState(scopedKey, undefined);
  if (typeof scopedValue !== 'undefined') return scopedValue;
  const legacyValue = readStoredState(baseKey, undefined);
  if (typeof legacyValue !== 'undefined') return legacyValue;
  return fallback;
};

const writeScopedStoredState = (baseKey, scope = 'global', value) => {
  localStorage.setItem(getScopedStorageKey(baseKey, scope), JSON.stringify(value));
};

const readFromStorageScopes = (baseKey, scopes = [], fallback) => {
  for (const scope of scopes) {
    const value = readScopedStoredState(baseKey, scope, undefined);
    if (typeof value !== 'undefined') return value;
  }
  return fallback;
};

const writeToStorageScopes = (baseKey, scopes = [], value) => {
  const uniqueScopes = scopes.length ? [...new Set(scopes.map((scope) => normalizeStorageScope(scope)))] : ['global'];
  uniqueScopes.forEach((scope) => {
    writeScopedStoredState(baseKey, scope, value);
  });
};

const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (value = '') => {
  if (!value) return new Uint8Array();
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const generateVaultSalt = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(bytes);
};

const deriveVaultMaterial = async (password, saltBase64) => {
  const salt = base64ToBytes(saltBase64);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: VAULT_KDF_ITERATIONS,
    },
    passwordKey,
    256
  );

  const derivedBytes = new Uint8Array(derivedBits);
  const verifier = bytesToBase64(derivedBytes);
  const key = await crypto.subtle.importKey(
    'raw',
    derivedBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, verifier, salt: saltBase64 };
};

const generateVaultKeyMaterial = async () => {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const rawBase64 = bytesToBase64(raw);
  const key = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, rawBase64 };
};

const importVaultKeyMaterial = async (rawBase64) => {
  const raw = base64ToBytes(rawBase64);
  const key = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, rawBase64 };
};

const encryptVaultObject = async (value, key) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    v: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };
};

const decryptVaultObject = async (value, key) => {
  if (!value || typeof value !== 'object' || value.v !== 1 || !value.iv || !value.data) {
    return value;
  }

  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(value.iv) },
    key,
    base64ToBytes(value.data)
  );
  return JSON.parse(textDecoder.decode(plain));
};

const encryptVaultArray = async (records = [], key) => {
  if (!key) return records;
  return Promise.all((Array.isArray(records) ? records : []).map(record => encryptVaultObject(record, key)));
};

const decryptVaultArray = async (records = [], key) => {
  if (!key) return Array.isArray(records) ? records : [];
  return Promise.all((Array.isArray(records) ? records : []).map(record => decryptVaultObject(record, key)));
};

const normalizeBufferSource = (value) => {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
};

const normalizePrfSeed = (value) => {
  const bufferSource = normalizeBufferSource(value);
  if (bufferSource) return bufferSource;
  if (typeof value === 'string') return base64URLStringToBuffer(value);
  return null;
};

const normalizeSearchValue = (value = '') => value.toLowerCase().trim();
const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const splitSearchTerms = (value = '') => normalizeSearchValue(value).split(/\s+/).filter(Boolean);

const matchesSearchTerms = (fields = [], terms = []) => {
  if (!terms.length) return true;
  return terms.every((term) => fields.some((field) => String(field || '').toLowerCase().includes(term)));
};

const findBestPasswordMatch = (passwords = [], terms = [], rawSearch = '') => {
  if (!terms.length) return null;

  const normalizedRawSearch = normalizeSearchValue(rawSearch);
  const normalizedTerms = terms.filter(Boolean);
  const matchAnyField = (item) => matchesSearchTerms(passwordSearchFields(item), normalizedTerms);
  const titleValue = (item) => normalizeSearchValue(item?.title || '');

  return (
    passwords.find((item) => titleValue(item) === normalizedRawSearch)
    || passwords.find((item) => normalizedRawSearch && titleValue(item).startsWith(normalizedRawSearch))
    || passwords.find((item) => matchAnyField(item))
    || null
  );
};

const passwordSearchFields = (password) => [
  password?.title,
  password?.username,
  password?.notes,
  password?.category,
  password?.url,
];

const cardSearchFields = (card) => [
  card?.name,
  card?.holder,
  card?.number,
  card?.expiry,
];

const resolveGlobalSearchTab = ({ terms = [], passwords = [], cards = [], categories = [], activeTab = 'dashboard' }) => {
  if (!terms.length) return null;

  const cardMatch = cards.some((card) => matchesSearchTerms(cardSearchFields(card), terms));
  const passwordMatch = passwords.some((item) => matchesSearchTerms(passwordSearchFields(item), terms));
  const categoryMatch = categories.some((category) => matchesSearchTerms([getCategoryName(category)], terms));

  if (passwordMatch || categoryMatch) {
    if (!cardMatch) return 'passwords';
    if (activeTab === 'passwords') return 'passwords';
  }

  if (cardMatch) {
    return 'cards';
  }

  if (passwordMatch || categoryMatch) {
    return 'passwords';
  }

  return null;
};

const buildPrfExtensionsForCredentials = (credentials = []) => {
  const evalByCredential = {};
  (Array.isArray(credentials) ? credentials : []).forEach((credential) => {
    if (!credential?.id || !credential?.prfSalt) return;
    const prfSeed = normalizePrfSeed(credential.prfSalt);
    if (!prfSeed) return;
    evalByCredential[credential.id] = {
      first: prfSeed,
    };
  });

  if (Object.keys(evalByCredential).length === 0) return undefined;

  return {
    prf: {
      evalByCredential,
    },
  };
};

const buildPrfExtensionsForSalt = (prfSalt) => {
  const prfSeed = normalizePrfSeed(prfSalt);
  if (!prfSeed) return undefined;
  return {
    prf: {
      eval: {
        first: prfSeed,
      },
    },
  };
};

const mergePasskeyCredential = (base = {}, extra = {}) => {
  const merged = { ...base };
  const fallback = extra || {};
  if (!merged.publicKey && fallback.publicKey) merged.publicKey = fallback.publicKey;
  if (typeof merged.counter !== 'number' && typeof fallback.counter === 'number') merged.counter = fallback.counter;
  if (!merged.credentialDeviceType && fallback.credentialDeviceType) merged.credentialDeviceType = fallback.credentialDeviceType;
  if (typeof merged.credentialBackedUp === 'undefined' && typeof fallback.credentialBackedUp !== 'undefined') {
    merged.credentialBackedUp = fallback.credentialBackedUp;
  }
  return merged;
};

const mergePasskeyCredentialLists = (primary = [], secondary = []) => {
  const secondaryMap = new Map((Array.isArray(secondary) ? secondary : []).map((cred) => [cred?.id, cred]));
  const result = [];
  const seen = new Set();

  (Array.isArray(primary) ? primary : []).forEach((cred) => {
    if (!cred?.id) return;
    const merged = mergePasskeyCredential(cred, secondaryMap.get(cred.id));
    result.push(merged);
    seen.add(cred.id);
  });

  (Array.isArray(secondary) ? secondary : []).forEach((cred) => {
    if (!cred?.id || seen.has(cred.id)) return;
    result.push({ ...cred });
  });

  return result;
};

const importPasskeyDerivedKey = async (prfBytes) => {
  const bytes = normalizeBufferSource(prfBytes);
  if (!bytes) {
    throw new Error('Esta credencial não devolveu um PRF válido.');
  }

  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};

const deriveBackupMaterial = async (password, saltBase64) => {
  const salt = base64ToBytes(saltBase64);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: VAULT_KDF_ITERATIONS,
    },
    passwordKey,
    256
  );

  const derivedBytes = new Uint8Array(derivedBits);
  const key = await crypto.subtle.importKey(
    'raw',
    derivedBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, salt: saltBase64 };
};

const encryptBackupPayload = async (payload, password) => {
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const { key } = await deriveBackupMaterial(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    v: 1,
    kind: 'passvault-backup',
    salt,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };
};

const decryptBackupPayload = async (backup, password) => {
  if (!backup || typeof backup !== 'object' || backup.v !== 1 || backup.kind !== 'passvault-backup' || !backup.salt || !backup.iv || !backup.data) {
    throw new Error('O ficheiro de backup é inválido.');
  }

  const { key } = await deriveBackupMaterial(password, backup.salt);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(backup.iv) },
    key,
    base64ToBytes(backup.data)
  );
  return JSON.parse(textDecoder.decode(plain));
};

const parseLegacyBackupPayload = (backup) => {
  if (!backup || typeof backup !== 'object') return null;
  const hasLegacyShape = Array.isArray(backup.categories) || Array.isArray(backup.passwords) || Array.isArray(backup.cards);
  if (!hasLegacyShape) return null;
  return {
    exportedAt: backup.exportedAt || backup.exported_at || new Date().toISOString(),
    vaultVersion: Number.isFinite(Number(backup.vaultVersion)) ? Number(backup.vaultVersion) : 1,
    categories: Array.isArray(backup.categories) ? backup.categories : DEFAULT_CATEGORIES,
    passwords: Array.isArray(backup.passwords) ? backup.passwords : [],
    cards: Array.isArray(backup.cards) ? backup.cards : [],
  };
};

const parseCsvText = (text = '') => {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (char === '\n') {
      currentRow.push(currentCell);
      if (currentRow.some((entry) => String(entry || '').trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((entry) => String(entry || '').trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
};

const parseBitwardenCsv = (text = '') => {
  const rows = parseCsvText(text);
  if (!rows.length) return [];

  const headers = rows.shift().map((header) => normalizeText(header).replace(/\s+/g, '_'));
  return rows
    .map((cells) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? '';
      });
      return record;
    })
    .filter((record) => Object.values(record).some((value) => String(value || '').trim() !== ''));
};

const normalizePasswordImportKey = (item = {}) => {
  const title = normalizeText(item.title || '');
  const username = normalizeText(item.username || '');
  const host = normalizeText(getHostname(item.url || ''));
  const rawUrl = normalizeText(item.url || '');
  return [
    [title, username, host].join('|'),
    [title, username, rawUrl].join('|'),
    [title, '', host].join('|'),
    ['', username, host].join('|'),
  ].filter((value, index, array) => value && array.indexOf(value) === index);
};

const buildPasswordDedupeKey = (item = {}) => {
  const title = normalizeText(item.title || '');
  const username = normalizeText(item.username || '');
  const host = normalizeText(getHostname(item.url || ''));
  const rawUrl = normalizeText(item.url || '');
  return [title, username, host || rawUrl].join('|');
};

const dedupePasswordsByCategory = (records = [], categoryName = 'Other') => {
  const seen = new Set();
  const removed = [];
  const kept = [];

  (Array.isArray(records) ? records : []).forEach((record) => {
    if ((record?.category || '') !== categoryName) {
      kept.push(record);
      return;
    }

    const key = buildPasswordDedupeKey(record);
    if (!key || seen.has(key)) {
      removed.push(record);
      return;
    }

    seen.add(key);
    kept.push(record);
  });

  return { kept, removed };
};

const findPasswordImportMatch = (item = {}, existing = []) => {
  const lookup = new Map();
  (Array.isArray(existing) ? existing : []).forEach((password) => {
    normalizePasswordImportKey(password).forEach((key) => {
      if (!lookup.has(key)) {
        lookup.set(key, password);
      }
    });
  });

  for (const key of normalizePasswordImportKey(item)) {
    if (lookup.has(key)) {
      return lookup.get(key);
    }
  }

  return null;
};

const mapBitwardenRecordToPassword = (record = {}) => {
  const type = normalizeText(record.type || '');
  const url = String(record.login_uri || record.url || '').trim();
  const username = String(record.login_username || record.username || '').trim();
  const password = String(record.login_password || record.password || '').trim();
  const notes = String(record.notes || record.note || '').trim();
  const title = String(record.name || record.title || '').trim() || getHostname(url) || username || 'Bitwarden';
  const favorite = ['1', 'true', 'yes', 'sim'].includes(normalizeText(record.favorite || ''));
  const hasLoginData = title || url || username || password || notes;

  if (type && type !== 'login' && type !== '1') {
    return null;
  }

  if (!hasLoginData) {
    return null;
  }

  return {
    title,
    url,
    username,
    password,
    notes,
    category: 'Other',
    favorite,
  };
};

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
  const [isLocked, setIsLocked] = useState(PREVIEW_MODE ? false : true);
  const [userId, setUserId] = useState(PREVIEW_MODE ? 'preview-user' : (sessionStorage.getItem('pv_user_id') || null));
  const [masterHash, setMasterHash] = useState(PREVIEW_MODE ? 'preview-master' : (sessionStorage.getItem('pv_master_hash') || null));
  const [vaultSalt, setVaultSalt] = useState(PREVIEW_MODE ? null : (sessionStorage.getItem('pv_vault_salt') || null));
  const [vaultVersion, setVaultVersion] = useState(1);
  const [vaultKey, setVaultKey] = useState(null);
  const [vaultKeyRaw, setVaultKeyRaw] = useState(null);
  const [vaultKeyWrapMaster, setVaultKeyWrapMaster] = useState(null);
  const persistedAuthIdentifier = PREVIEW_MODE ? '' : getPersistedAuthIdentifier();
  const initialStorageScope = PREVIEW_MODE
    ? 'preview-user'
    : getVaultStorageScope(sessionStorage.getItem('pv_user_id'), persistedAuthIdentifier);
  const [hasPasskeys, setHasPasskeys] = useState(PREVIEW_MODE ? false : !!readFromStorageScopes(PASSKEY_STORAGE_KEYS.hasPasskeys, getVaultStorageScopes(sessionStorage.getItem('pv_user_id'), persistedAuthIdentifier), false));
  const [passkeyCredentials, setPasskeyCredentials] = useState(
    PREVIEW_MODE ? [] : readFromStorageScopes(PASSKEY_STORAGE_KEYS.credentials, getVaultStorageScopes(sessionStorage.getItem('pv_user_id'), persistedAuthIdentifier), [])
  );
  const [nativeBiometricsEnabled, setNativeBiometricsEnabled] = useState(
    PREVIEW_MODE ? false : readFromStorageScopes(ANDROID_BIOMETRIC_ENABLED_KEY, getVaultStorageScopes(sessionStorage.getItem('pv_user_id'), persistedAuthIdentifier), false)
  );
  
  // Estado do Cofre (Agora inicializado vazio, preenchido via Postgres)
  const [categories, setCategories] = useState(
    PREVIEW_MODE ? normalizeCategories(readPreviewState('pv_preview_categories', DEFAULT_CATEGORIES)) : normalizeCategories(DEFAULT_CATEGORIES)
  );
  const [passwords, setPasswords] = useState(
    PREVIEW_MODE ? readPreviewState('pv_preview_passwords', PREVIEW_PASSWORDS) : []
  );
  const [cards, setCards] = useState(
    PREVIEW_MODE ? readPreviewState('pv_preview_cards', PREVIEW_CARDS) : []
  );
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [quickCreate, setQuickCreate] = useState(null);
  const [quickEdit, setQuickEdit] = useState(null);
  const [toast, setToast] = useState(null);
  const screenBackHandlerRef = useRef(null);

  // Guardar apenas configs no localstorage
  useEffect(() => { localStorage.setItem('pv_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('pv_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('pv_timeout', timeoutMinutes); }, [timeoutMinutes]);
  useEffect(() => {
    if (!PREVIEW_MODE) return;
    localStorage.setItem('pv_preview_categories', JSON.stringify(categories));
  }, [categories]);
  useEffect(() => {
    if (!PREVIEW_MODE) return;
    localStorage.setItem('pv_preview_passwords', JSON.stringify(passwords));
  }, [passwords]);
  useEffect(() => {
    if (!PREVIEW_MODE) return;
    localStorage.setItem('pv_preview_cards', JSON.stringify(cards));
  }, [cards]);
  useEffect(() => {
    if (PREVIEW_MODE) return;
    writeToStorageScopes(PASSKEY_STORAGE_KEYS.hasPasskeys, getVaultStorageScopes(userId, getPersistedAuthIdentifier()), !!hasPasskeys);
  }, [hasPasskeys, userId]);
  useEffect(() => {
    if (PREVIEW_MODE) return;
    writeToStorageScopes(PASSKEY_STORAGE_KEYS.credentials, getVaultStorageScopes(userId, getPersistedAuthIdentifier()), passkeyCredentials);
  }, [passkeyCredentials, userId]);
  useEffect(() => {
    if (PREVIEW_MODE) return;
    writeToStorageScopes(ANDROID_BIOMETRIC_ENABLED_KEY, getVaultStorageScopes(userId, getPersistedAuthIdentifier()), !!nativeBiometricsEnabled);
  }, [nativeBiometricsEnabled, userId]);
  useEffect(() => {
    if (PREVIEW_MODE) return;
    if (userId) {
      sessionStorage.setItem('pv_user_id', userId);
    } else {
      sessionStorage.removeItem('pv_user_id');
    }
  }, [userId]);

  useEffect(() => {
    if (PREVIEW_MODE) return;
    const scopes = getVaultStorageScopes(userId, getPersistedAuthIdentifier());
    const storedPasskeys = readFromStorageScopes(PASSKEY_STORAGE_KEYS.credentials, scopes, []);
    const storedHasPasskeys = readFromStorageScopes(PASSKEY_STORAGE_KEYS.hasPasskeys, scopes, null);
    const storedNativeBiometrics = readFromStorageScopes(ANDROID_BIOMETRIC_ENABLED_KEY, scopes, null);
    if (Array.isArray(storedPasskeys)) {
      setPasskeyCredentials(storedPasskeys);
      if (typeof storedHasPasskeys === 'boolean') {
        setHasPasskeys(storedHasPasskeys);
      } else {
        setHasPasskeys(storedPasskeys.some((credential) => credential.wrappedVaultKey && credential.wrappedMasterHash));
      }
    }
    if (typeof storedNativeBiometrics === 'boolean') {
      setNativeBiometricsEnabled(storedNativeBiometrics);
      if (storedNativeBiometrics) {
        setHasPasskeys(true);
      }
    }
  }, [userId]);

  const syncVault = useCallback(async ({
    nextCategories = categories,
    nextPasswords = passwords,
    nextCards = cards,
    nextPasskeys = passkeyCredentials,
    currentUserId = userId,
    hash = masterHash,
    key = vaultKey,
    salt = vaultSalt,
    nextVaultKeyWrapMaster = vaultKeyWrapMaster,
    nextVaultVersion = vaultVersion,
  } = {}) => {
    if (PREVIEW_MODE || isLocked || !hash || !key) return { ok: false, skipped: true };

    const encryptedPasswords = await encryptVaultArray(nextPasswords, key);
    const encryptedCards = await encryptVaultArray(nextCards, key);
    const res = await fetch(`${API_URL}/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash,
        categories: nextCategories,
        passwords: encryptedPasswords,
        cards: encryptedCards,
        userId: currentUserId,
        vaultSalt: salt,
        vaultVersion: nextVaultVersion,
        vaultKeyWrapMaster: nextVaultKeyWrapMaster,
        webauthnCredentials: nextPasskeys,
      })
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.error || 'Falha ao gravar alterações.');
    }

    return { ok: true };
  }, [categories, passwords, cards, passkeyCredentials, isLocked, masterHash, vaultKey, vaultSalt, vaultVersion, vaultKeyWrapMaster, userId]);

  // Aplicação da Base de Dados PostgreSQL (Auto-Sync)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (PREVIEW_MODE) return;
    if (isInitialMount.current) { 
      isInitialMount.current = false; 
      return; 
    }
    syncVault().catch(err => console.error("Falha ao sincronizar com Postgres:", err));
  }, [categories, passwords, cards, isLocked, masterHash, vaultKey, vaultSalt, syncVault, userId]);

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
      sessionStorage.removeItem('pv_vault_salt');
      setMasterHash(null);
      setVaultKey(null);
      setVaultKeyRaw(null);
      setVaultKeyWrapMaster(null);
      setVaultSalt(null);
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

  const registerScreenBackHandler = useCallback((handler) => {
    screenBackHandlerRef.current = handler;
    return () => {
      if (screenBackHandlerRef.current === handler) {
        screenBackHandlerRef.current = null;
      }
    };
  }, []);

  const triggerScreenBackHandler = useCallback(() => {
    if (typeof screenBackHandlerRef.current !== 'function') return false;
    try {
      return !!screenBackHandlerRef.current();
    } catch (error) {
      console.error('Falha no handler de back screen:', error);
      return false;
    }
  }, []);

  const contextValue = {
    theme, setTheme, lang, setLang, timeoutMinutes, setTimeoutMinutes,
    isLocked, setIsLocked, userId, setUserId, masterHash, setMasterHash, vaultSalt, setVaultSalt, vaultVersion, setVaultVersion, vaultKey, setVaultKey, vaultKeyRaw, setVaultKeyRaw, vaultKeyWrapMaster, setVaultKeyWrapMaster, hasPasskeys, setHasPasskeys, passkeyCredentials, setPasskeyCredentials,
    categories, setCategories,
    passwords, setPasswords, cards, setCards,
    activeTab, setActiveTab,
    globalSearch, setGlobalSearch,
    quickCreate, setQuickCreate,
    quickEdit, setQuickEdit,
    nativeBiometricsEnabled, setNativeBiometricsEnabled,
    registerScreenBackHandler,
    triggerScreenBackHandler,
    syncVault,
    t, showToast, copyToClipboard
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
  const res = await fetch(`${API_URL}/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, schema })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Falha ao contactar a IA.');
  }

  if (!data?.result) {
    throw new Error('IA devolveu uma resposta vazia.');
  }

  return data.result;
};

const normalizeText = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getHostname = (url = '') => {
  if (!url) return '';
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    return '';
  }
};

const buildFallbackPassphrase = (themePrompt = '') => {
  const rawWords = normalizeText(themePrompt)
    .split(/[^a-z0-9]+/i)
    .map(word => word.trim())
    .filter(word => word.length > 3 && !['para', 'com', 'uma', 'tema', 'tema', 'the', 'and', 'for', 'with'].includes(word));

  const seeds = rawWords.slice(0, 4);
  const defaults = ['Chave', 'Segura', 'Nuvem', 'Lisboa'];
  const chosen = (seeds.length ? seeds : defaults).map(word => word.charAt(0).toUpperCase() + word.slice(1));
  const number = Math.floor(10 + Math.random() * 90);
  const symbols = ['!', '@', '#', '$', '%', '&'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  return `${chosen.join('-')}-${number}${symbol}`;
};

const inferUrlFallback = (title = '', url = '') => {
  const trimmedUrl = url?.trim();
  if (trimmedUrl) {
    try {
      return new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`).toString();
    } catch {
      return trimmedUrl;
    }
  }

  const normalizedTitle = normalizeText(title);
  const urlMap = [
    { keywords: ['netflix'], url: 'https://www.netflix.com' },
    { keywords: ['spotify'], url: 'https://www.spotify.com' },
    { keywords: ['youtube'], url: 'https://www.youtube.com' },
    { keywords: ['google', 'gmail', 'drive', 'meet', 'calendar'], url: 'https://www.google.com' },
    { keywords: ['github'], url: 'https://github.com' },
    { keywords: ['gitlab'], url: 'https://gitlab.com' },
    { keywords: ['discord'], url: 'https://discord.com' },
    { keywords: ['facebook', 'meta'], url: 'https://www.facebook.com' },
    { keywords: ['instagram'], url: 'https://www.instagram.com' },
    { keywords: ['linkedin'], url: 'https://www.linkedin.com' },
    { keywords: ['reddit'], url: 'https://www.reddit.com' },
    { keywords: ['twitch'], url: 'https://www.twitch.tv' },
    { keywords: ['amazon'], url: 'https://www.amazon.com' },
    { keywords: ['paypal'], url: 'https://www.paypal.com' },
    { keywords: ['revolut'], url: 'https://www.revolut.com' },
    { keywords: ['wise'], url: 'https://wise.com' },
    { keywords: ['outlook', 'hotmail'], url: 'https://outlook.live.com' },
    { keywords: ['proton'], url: 'https://proton.me' },
    { keywords: ['dropbox'], url: 'https://www.dropbox.com' },
    { keywords: ['steam'], url: 'https://store.steampowered.com' },
    { keywords: ['epic'], url: 'https://store.epicgames.com' },
    { keywords: ['apple'], url: 'https://www.apple.com' },
    { keywords: ['microsoft', 'office', 'teams'], url: 'https://www.microsoft.com' },
  ];

  for (const entry of urlMap) {
    if (entry.keywords.some(keyword => normalizedTitle.includes(normalizeText(keyword)))) {
      return entry.url;
    }
  }

  return '';
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

const isNativeBiometricStorageAvailable = () => IS_ANDROID_NATIVE;

const normalizeAndroidBiometricVaultStore = (raw) => {
  if (!raw) return { v: 2, vaults: {} };
  if (typeof raw === 'object' && raw !== null) {
    if (raw.v === 2 && raw.vaults && typeof raw.vaults === 'object') {
      return { v: 2, vaults: raw.vaults };
    }
    if (raw.masterHash || raw.vaultKeyRaw || raw.vaultKeyWrapMaster) {
      return { v: 2, vaults: { global: raw } };
    }
  }
  return { v: 2, vaults: {} };
};

const readAndroidBiometricVault = async (scope = 'global') => {
  if (!isNativeBiometricStorageAvailable()) return null;
  const raw = await SecureStorage.getItem(ANDROID_BIOMETRIC_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const store = normalizeAndroidBiometricVaultStore(parsed);
    return store.vaults?.[normalizeStorageScope(scope)] || store.vaults?.global || null;
  } catch {
    return null;
  }
};

const writeAndroidBiometricVault = async (payload, scope = 'global') => {
  if (!isNativeBiometricStorageAvailable()) return;
  const raw = await SecureStorage.getItem(ANDROID_BIOMETRIC_STORAGE_KEY);
  let store = { v: 2, vaults: {} };
  try {
    store = normalizeAndroidBiometricVaultStore(raw ? JSON.parse(raw) : null);
  } catch {
    store = { v: 2, vaults: {} };
  }
  store.vaults[normalizeStorageScope(scope)] = payload;
  await SecureStorage.setItem(ANDROID_BIOMETRIC_STORAGE_KEY, JSON.stringify(store));
};

const clearAndroidBiometricVault = async (scope = 'global') => {
  if (!isNativeBiometricStorageAvailable()) return;
  const raw = await SecureStorage.getItem(ANDROID_BIOMETRIC_STORAGE_KEY);
  if (!raw) return;
  try {
    const store = normalizeAndroidBiometricVaultStore(JSON.parse(raw));
    const scopedKey = normalizeStorageScope(scope);
    if (store.vaults?.[scopedKey]) {
      delete store.vaults[scopedKey];
    }
    if (!store.vaults || Object.keys(store.vaults).length === 0) {
      await SecureStorage.removeItem(ANDROID_BIOMETRIC_STORAGE_KEY);
      return;
    }
    await SecureStorage.setItem(ANDROID_BIOMETRIC_STORAGE_KEY, JSON.stringify(store));
  } catch {
    await SecureStorage.removeItem(ANDROID_BIOMETRIC_STORAGE_KEY);
  }
};

const authenticateAndroidBiometrics = async (reason) => {
  if (!isNativeBiometricStorageAvailable()) {
    throw new Error('Biometria nativa não disponível.');
  }
  const info = await BiometricAuth.checkBiometry();
  if (!info.isAvailable && !info.deviceIsSecure) {
    throw new Error('A biometria não está disponível neste dispositivo.');
  }
  await BiometricAuth.authenticate({
    reason,
    androidTitle: 'PassVault',
    androidSubtitle: 'Desbloqueio biométrico',
    androidConfirmationRequired: false,
    androidBiometryStrength: AndroidBiometryStrength.weak,
    allowDeviceCredential: true,
  });
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
const SecretText = ({
  text,
  mask = '••••••••',
  showCopy = true,
  containerClassName = '',
  textClassName = '',
  toggleClassName = '',
  copyClassName = '',
}) => {
  const [revealed, setRevealed] = useState(false);
  const { copyToClipboard } = useContext(AppContext);

  const handleReveal = () => {
    setRevealed(true);
    setTimeout(() => setRevealed(false), 5000);
  };

  return (
    <div className={`flex items-center space-x-2 ${containerClassName}`}>
      <span className={`font-mono text-[var(--text)] tracking-wider ${textClassName}`}>
        {revealed ? text : mask}
      </span>
      <button onClick={handleReveal} className={`p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors ${toggleClassName}`}>
        {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      {showCopy && (
        <button onClick={() => copyToClipboard(text)} className={`p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors ${copyClassName}`}>
          <Copy size={16} />
        </button>
      )}
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
  const {
    userId,
    setUserId,
    setMasterHash,
    setIsLocked,
    t,
    setPasswords,
    setCards,
    setCategories,
    vaultSalt,
    setVaultSalt,
    setVaultKey,
    setVaultKeyRaw,
    setVaultKeyWrapMaster,
    setVaultVersion,
    setPasskeyCredentials,
    setHasPasskeys,
    setNativeBiometricsEnabled,
    hasPasskeys,
    passkeyCredentials,
    nativeBiometricsEnabled,
  } = useContext(AppContext);
  const [identifier, setIdentifier] = useState(() => {
    const storedIdentifier = getPersistedAuthIdentifier();
    return storedIdentifier && storedIdentifier !== 'admin' ? storedIdentifier : '';
  });
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [isSetupState, setIsSetupState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const pendingRegistrationRef = useRef(null);

  useEffect(() => {
    const storedIdentifier = getPersistedAuthIdentifier() || '';
    const storedUserId = sessionStorage.getItem('pv_user_id') || '';
    const statusUrl = storedIdentifier
      ? `${API_URL}/status?identifier=${encodeURIComponent(storedIdentifier)}`
      : `${API_URL}/status`;
    const passkeyUrl = storedIdentifier
      ? `${API_URL}/passkeys/status?identifier=${encodeURIComponent(storedIdentifier)}`
      : (storedUserId ? `${API_URL}/passkeys/status?userId=${encodeURIComponent(storedUserId)}` : `${API_URL}/passkeys/status`);

    Promise.all([
      fetch(statusUrl).then((res) => res.json()),
      fetch(passkeyUrl).then((res) => res.json()).catch(() => ({})),
    ])
      .then(([vaultStatus, passkeyStatus]) => {
        setIsSetupState(!vaultStatus.isSetup);
        setVaultSalt(vaultStatus.vaultSalt || null);
        setVaultVersion(vaultStatus.vaultVersion || 1);
        if (vaultStatus.user) {
          const resolvedIdentifier = vaultStatus.user.email || vaultStatus.user.username || '';
          if (resolvedIdentifier && resolvedIdentifier.toLowerCase() !== 'admin') {
            setIdentifier(resolvedIdentifier);
            sessionStorage.setItem('pv_auth_identifier', resolvedIdentifier);
            setPersistedAuthIdentifier(resolvedIdentifier);
          } else {
            setIdentifier('');
            sessionStorage.removeItem('pv_auth_identifier');
            localStorage.removeItem(LAST_AUTH_IDENTIFIER_KEY);
          }
          setUserId(vaultStatus.user.id || null);
        }
        const nextHasPasskeys = IS_ANDROID_NATIVE
          ? nativeBiometricsEnabled
          : (typeof passkeyStatus.hasPasskeys === 'boolean'
            ? passkeyStatus.hasPasskeys
            : !!vaultStatus.hasPasskeys);
        const storedScope = getVaultStorageScope(storedUserId || storedIdentifier);
        const storedPasskeys = readScopedStoredState(PASSKEY_STORAGE_KEYS.credentials, storedScope, []);
        const nextPasskeys = mergePasskeyCredentialLists(
          Array.isArray(passkeyStatus.credentials) ? passkeyStatus.credentials : [],
          storedPasskeys,
        );
        setHasPasskeys(IS_ANDROID_NATIVE ? nativeBiometricsEnabled : (nextHasPasskeys || nextPasskeys.length > 0));
        setPasskeyCredentials(nextPasskeys);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("API Error:", err);
        setError("Não foi possível conectar à API Postgres. Verifique o servidor.");
        setIsLoading(false);
      });
  }, [setHasPasskeys, setVaultSalt, setVaultVersion, nativeBiometricsEnabled, setUserId]);

  const legacyHash = (str) => btoa(str);

  const loadVaultData = async (masterHashValue, vaultKeyInstance, vaultKeyRawValue = null, nextUser = null) => {
    const activeUserId = nextUser?.id || userId || null;
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: identifier.trim(),
        userId: activeUserId,
        hash: masterHashValue
      })
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.error || t('invalidPassword'));
    }

    const data = await res.json();
    const nextCategories = normalizeCategories((Array.isArray(data.categories) && data.categories.length > 0) ? data.categories : DEFAULT_CATEGORIES);
    const nextPasswords = await decryptVaultArray(data.passwords || [], vaultKeyInstance);
    const nextCards = await decryptVaultArray(data.cards || [], vaultKeyInstance);
    const nextPasskeys = data.webauthnCredentials || [];

    setCategories(nextCategories);
    setPasswords(nextPasswords);
    setCards(nextCards);
    setMasterHash(masterHashValue);
    setVaultSalt(data.vaultSalt || null);
    setVaultVersion(data.vaultVersion || 1);
    setVaultKey(vaultKeyInstance);
    setVaultKeyRaw(vaultKeyRawValue);
    setVaultKeyWrapMaster(data.vaultKeyWrapMaster || null);
    const nextActiveUserId = nextUser?.id || data.user?.id || userId || null;
    if (nextActiveUserId) {
      setUserId(nextActiveUserId);
      sessionStorage.setItem('pv_user_id', nextActiveUserId);
    }
    setPasskeyCredentials(nextPasskeys);
    setHasPasskeys(nextPasskeys.some((credential) => credential.wrappedVaultKey && credential.wrappedMasterHash) || nativeBiometricsEnabled);
    sessionStorage.setItem('pv_master_hash', masterHashValue);
    if (data.vaultSalt) {
      sessionStorage.setItem('pv_vault_salt', data.vaultSalt);
    }
    setError('');
    setIsLocked(false);
  };

  const resetPendingRegistration = () => {
    pendingRegistrationRef.current = null;
    setVerificationCode('');
    setVerificationMessage('');
    setIsVerificationPending(false);
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (pwd !== confirmPwd) { setError(t('passwordsMismatch')); return; }
    if (pwd.length < 6) { setError('Password too short (min 6)'); return; }
    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!isValidEmail(normalizedIdentifier)) {
      setError('Usa um email válido para confirmar a conta.');
      return;
    }

    setIsLoading(true);
    try {
      const salt = generateVaultSalt();
      const material = await deriveVaultMaterial(pwd, salt);
      const vaultKeyMaterial = await generateVaultKeyMaterial();
      const vaultKeyWrapMaster = await encryptVaultObject(vaultKeyMaterial.rawBase64, material.key);

      const res = await fetch(`${API_URL}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: normalizedIdentifier,
          hash: material.verifier,
          salt,
          vaultKeyWrapMaster,
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro de servidor");
      }
      await res.json().catch(() => ({}));
      pendingRegistrationRef.current = {
        identifier: normalizedIdentifier,
        masterHash: material.verifier,
        vaultSalt: salt,
        vaultVersion: 2,
        vaultKeyRaw: vaultKeyMaterial.rawBase64,
        vaultKey: vaultKeyMaterial.key,
        vaultKeyWrapMaster,
      };
      setIdentifier(normalizedIdentifier);
      sessionStorage.setItem('pv_auth_identifier', normalizedIdentifier);
      setPersistedAuthIdentifier(normalizedIdentifier);
      setVerificationMessage(`Enviámos um código para ${normalizedIdentifier}.`);
      setIsVerificationPending(true);
      setError('');
    } catch(err) {
      setError(err.message || "Falha de rede. Servidor Docker em execução?");
    }
    setIsLoading(false);
  };

  const handleVerifyRegistration = async () => {
    const pending = pendingRegistrationRef.current;
    if (!pending?.identifier) {
      setError('Não existe nenhum registo pendente.');
      return;
    }
    if (!verificationCode.trim()) {
      setError('Introduz o código enviado para o email.');
      return;
    }

    setIsVerifyingCode(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: pending.identifier,
          code: verificationCode.trim(),
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Não foi possível confirmar o email.');
      }

      const data = await res.json();
      const verifiedUserId = data.userId || data.user?.id || null;
      const nextCategories = normalizeCategories((Array.isArray(data.categories) && data.categories.length > 0) ? data.categories : DEFAULT_CATEGORIES);
      const nextPasswords = Array.isArray(data.passwords) ? data.passwords : [];
      const nextCards = Array.isArray(data.cards) ? data.cards : [];

      setCategories(nextCategories);
      setPasswords(nextPasswords);
      setCards(nextCards);
      setMasterHash(pending.masterHash);
      setVaultSalt(pending.vaultSalt);
      setVaultVersion(2);
      setVaultKey(pending.vaultKey);
      setVaultKeyRaw(pending.vaultKeyRaw);
      setVaultKeyWrapMaster(pending.vaultKeyWrapMaster);
      setPasskeyCredentials(data.webauthnCredentials || []);
      setHasPasskeys(false);
      setNativeBiometricsEnabled(false);
      setUserId(verifiedUserId);
      setIdentifier(pending.identifier);
      sessionStorage.setItem('pv_auth_identifier', pending.identifier);
      setPersistedAuthIdentifier(pending.identifier);
      if (verifiedUserId) {
        sessionStorage.setItem('pv_user_id', verifiedUserId);
      }
      sessionStorage.setItem('pv_master_hash', pending.masterHash);
      sessionStorage.setItem('pv_vault_salt', pending.vaultSalt);
      setIsLocked(false);
      resetPendingRegistration();
      setPwd('');
      setConfirmPwd('');
    } catch (err) {
      setError(err.message || 'Não foi possível confirmar o email.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    const pending = pendingRegistrationRef.current;
    if (!pending?.identifier) return;
    setIsResendingCode(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/register/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: pending.identifier }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Não foi possível reenviar o código.');
      }
      setVerificationMessage(`Enviámos um novo código para ${pending.identifier}.`);
    } catch (err) {
      setError(err.message || 'Não foi possível reenviar o código.');
    } finally {
      setIsResendingCode(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const normalizedIdentifier = identifier.trim() || 'admin';
      let vaultStatus = null;
      if (normalizedIdentifier !== 'admin') {
        const statusRes = await fetch(`${API_URL}/status?identifier=${encodeURIComponent(normalizedIdentifier)}`);
        if (statusRes.ok) {
          vaultStatus = await statusRes.json();
          if (vaultStatus.user?.id) {
            setUserId(vaultStatus.user.id);
            sessionStorage.setItem('pv_user_id', vaultStatus.user.id);
          }
          if (vaultStatus.user?.email || vaultStatus.user?.username) {
            const resolvedIdentifier = vaultStatus.user.email || vaultStatus.user.username || normalizedIdentifier;
            setIdentifier(resolvedIdentifier);
            sessionStorage.setItem('pv_auth_identifier', resolvedIdentifier);
            setPersistedAuthIdentifier(resolvedIdentifier);
          }
          if (vaultStatus.vaultVersion) {
            setVaultVersion(vaultStatus.vaultVersion);
          }
          if (vaultStatus.vaultSalt) {
            setVaultSalt(vaultStatus.vaultSalt);
            sessionStorage.setItem('pv_vault_salt', vaultStatus.vaultSalt);
          }
        }
      }
      let activeSalt = vaultStatus?.vaultSalt || null;
      if (!activeSalt && normalizedIdentifier !== 'admin') {
        throw new Error('Não foi possível obter a salt do cofre. Atualiza a sessão e tenta novamente.');
      }
      if (!activeSalt && normalizedIdentifier === 'admin') {
        activeSalt = vaultSalt || sessionStorage.getItem('pv_vault_salt') || null;
      }
      const material = activeSalt ? await deriveVaultMaterial(pwd, activeSalt) : null;
      const h = activeSalt ? material.verifier : legacyHash(pwd);

      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalizedIdentifier, hash: h })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || t('invalidPassword'));
      }

      const data = await res.json();
      if (data?.user?.id) {
        setUserId(data.user.id);
        sessionStorage.setItem('pv_user_id', data.user.id);
      }
      setIdentifier(normalizedIdentifier);
      sessionStorage.setItem('pv_auth_identifier', normalizedIdentifier);
      setPersistedAuthIdentifier(normalizedIdentifier);
      const nextPasskeys = data.webauthnCredentials || [];
      const isModernVault = Number(data.vaultVersion || 1) >= 2 && !!data.vaultKeyWrapMaster;

      if (isModernVault && material) {
        const wrappedVaultKey = data.vaultKeyWrapMaster;
        const decryptedVaultKeyRaw = await decryptVaultObject(wrappedVaultKey, material.key);
        const vaultKeyMaterial = await importVaultKeyMaterial(decryptedVaultKeyRaw);
        await loadVaultData(h, vaultKeyMaterial.key, decryptedVaultKeyRaw, data.user || null);
        setVaultVersion(data.vaultVersion || 2);
        setPasskeyCredentials(nextPasskeys);
      setHasPasskeys(nextPasskeys.some((credential) => credential.wrappedVaultKey && credential.wrappedMasterHash) || nativeBiometricsEnabled);
      } else {
        const migrationSalt = generateVaultSalt();
        const migrationMaterial = await deriveVaultMaterial(pwd, migrationSalt);
        const vaultKeyMaterial = await generateVaultKeyMaterial();
        const vaultKeyWrapMaster = await encryptVaultObject(vaultKeyMaterial.rawBase64, migrationMaterial.key);
        const encryptedPasswords = await encryptVaultArray(data.passwords || [], vaultKeyMaterial.key);
        const encryptedCards = await encryptVaultArray(data.cards || [], vaultKeyMaterial.key);

        const migrateRes = await fetch(`${API_URL}/migrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldHash: h,
            newHash: migrationMaterial.verifier,
            salt: migrationSalt,
            categories: normalizeCategories((Array.isArray(data.categories) && data.categories.length > 0) ? data.categories : DEFAULT_CATEGORIES),
            passwords: encryptedPasswords,
            cards: encryptedCards,
            vaultKeyWrapMaster,
          })
        });

        if (!migrateRes.ok) {
          const payload = await migrateRes.json().catch(() => ({}));
          throw new Error(payload?.error || 'Falha ao migrar o cofre para o modo encriptado.');
        }

        setCategories(normalizeCategories((Array.isArray(data.categories) && data.categories.length > 0) ? data.categories : DEFAULT_CATEGORIES));
        setPasswords(data.passwords || []);
        setCards(data.cards || []);
        setMasterHash(migrationMaterial.verifier);
        setVaultSalt(migrationSalt);
        setVaultVersion(2);
        setVaultKey(vaultKeyMaterial.key);
        setVaultKeyRaw(vaultKeyMaterial.rawBase64);
        setVaultKeyWrapMaster(vaultKeyWrapMaster);
        if (data?.user?.id) {
          setUserId(data.user.id);
        }
        setPasskeyCredentials(nextPasskeys);
        setHasPasskeys(nextPasskeys.some((credential) => credential.wrappedVaultKey && credential.wrappedMasterHash) || nativeBiometricsEnabled);
        sessionStorage.setItem('pv_master_hash', migrationMaterial.verifier);
        sessionStorage.setItem('pv_vault_salt', migrationSalt);
        setError('');
        setIsLocked(false);
      }
    } catch(err) {
      setError(err.message || "Falha de rede. Servidor Docker em execução?");
    }
    setIsLoading(false);
  };

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);
    try {
      if (IS_ANDROID_NATIVE) {
        const stored = await readAndroidBiometricVault(getVaultStorageScope(userId, identifier));
        if (!stored?.masterHash || !stored?.vaultKeyRaw) {
          throw new Error('A biometria não está registada neste dispositivo.');
        }

        await authenticateAndroidBiometrics('Autentica-te para abrir o cofre.');
        const vaultKeyMaterial = await importVaultKeyMaterial(stored.vaultKeyRaw);
        if (stored.userId) {
          setUserId(stored.userId);
          sessionStorage.setItem('pv_user_id', stored.userId);
        }
        if (stored.identifier) {
          setIdentifier(stored.identifier);
          sessionStorage.setItem('pv_auth_identifier', stored.identifier);
          setPersistedAuthIdentifier(stored.identifier);
        }
        await loadVaultData(stored.masterHash, vaultKeyMaterial.key, stored.vaultKeyRaw, stored.userId ? { id: stored.userId } : null);
        setNativeBiometricsEnabled(true);
        setHasPasskeys(true);
        return;
      }

      const optionsRes = await fetch(`${API_URL}/passkeys/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'admin_vault', identifier }),
      });

      if (!optionsRes.ok) {
        const payload = await optionsRes.json().catch(() => ({}));
        throw new Error(payload?.error || 'Biometria não configurada.');
      }

      const payload = await optionsRes.json();
      const credentials = payload.credentials || [];
      const mergedCredentials = mergePasskeyCredentialLists(credentials, passkeyCredentials);
      const options = {
        ...payload.options,
        extensions: {
          ...(payload.options?.extensions || {}),
          ...(buildPrfExtensionsForCredentials(mergedCredentials) || {}),
        },
      };

      const authenticationResponse = await startAuthentication({ optionsJSON: options });
      const credential = mergedCredentials.find((item) => item.id === authenticationResponse.id);
      const prfSeed = authenticationResponse.clientExtensionResults?.prf?.results?.first;

      if (!credential) {
        throw new Error('A credencial biométrica não foi reconhecida.');
      }
      if (!prfSeed) {
        throw new Error('Este passkey não devolveu o PRF necessário para desbloquear o cofre.');
      }
      if (!credential.wrappedVaultKey || !credential.wrappedMasterHash) {
        throw new Error('Este passkey ainda não foi finalizado para desbloquear o cofre.');
      }

      const prfKey = await importPasskeyDerivedKey(prfSeed);
      const vaultKeyRaw = await decryptVaultObject(credential.wrappedVaultKey, prfKey);
      const vaultKeyMaterial = await importVaultKeyMaterial(vaultKeyRaw);
      const masterHashValue = await decryptVaultObject(credential.wrappedMasterHash, vaultKeyMaterial.key);

      const verifyRes = await fetch(`${API_URL}/passkeys/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'admin_vault',
          identifier,
          response: authenticationResponse,
          credentialPublicKey: credential.publicKey || null,
        })
      });

      if (!verifyRes.ok) {
        const payload = await verifyRes.json().catch(() => ({}));
        throw new Error(payload?.error || 'Falha ao validar a biometria.');
      }

      await loadVaultData(masterHashValue, vaultKeyMaterial.key, vaultKeyRaw);
      setPasskeyCredentials(mergedCredentials);
      setHasPasskeys(true);
    } catch (err) {
      setError(err.message || 'Não foi possível iniciar o login biométrico.');
    } finally {
      setIsBiometricLoading(false);
    }
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

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={!isSetupState ? 'primary' : 'secondary'}
            className="w-full py-2 text-sm"
            onClick={() => {
              setIsSetupState(false);
              resetPendingRegistration();
            }}
          >
            {t('signIn')}
          </Button>
          <Button
            type="button"
            variant={isSetupState ? 'primary' : 'secondary'}
            className="w-full py-2 text-sm"
            onClick={() => {
              setIsSetupState(true);
              resetPendingRegistration();
            }}
          >
            {t('signUp')}
          </Button>
        </div>

        <form onSubmit={isSetupState ? handleSetup : handleLogin} className="space-y-4 text-left">
          <Input
            label={t('accountIdentifier')}
            type="text"
          icon={Globe}
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          required={!isSetupState}
          name="passvault-login-identifier"
          placeholder={t('accountIdentifierPlaceholder')}
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          disabled={isLoading}
        />
          <Input
            label={t('masterPassword')}
            type="password"
            icon={Lock}
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            required
            autoFocus
            placeholder={t('masterPasswordPlaceholder')}
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
          {isSetupState && isVerificationPending && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)]/60 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Confirma o email</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {verificationMessage || 'Introduz o código que enviámos para o email indicado.'}
                </p>
              </div>
              <Input
                label="Código de confirmação"
                type="text"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                placeholder="000000"
                disabled={isVerifyingCode || isResendingCode}
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleResendCode}
                  disabled={isVerifyingCode || isResendingCode}
                >
                  {isResendingCode ? 'A reenviar...' : 'Reenviar código'}
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleVerifyRegistration}
                  disabled={isVerifyingCode || isResendingCode}
                >
                  {isVerifyingCode ? 'A confirmar...' : 'Confirmar email'}
                </Button>
              </div>
            </div>
          )}
          {error && <p className="text-[var(--danger)] text-sm flex items-center"><AlertTriangle size={14} className="mr-1"/> {error}</p>}
          <Button
            type="submit"
            disabled={isLoading || (isSetupState && isVerificationPending)}
            className="w-full mt-4 py-3 text-lg"
            icon={isLoading ? Loader2 : (isSetupState ? Shield : Unlock)}
          >
            {isLoading ? "A carregar..." : (isSetupState ? (isVerificationPending ? 'Aguardando confirmação' : t('createVault')) : t('unlockVault'))}
          </Button>
        </form>

        {!isSetupState && (hasPasskeys || (IS_ANDROID_NATIVE && nativeBiometricsEnabled)) && (
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full py-3"
              onClick={handleBiometricLogin}
              disabled={isBiometricLoading || isLoading}
              icon={isBiometricLoading ? Loader2 : Shield}
            >
              {isBiometricLoading ? t('generating') : t('loginWithBiometrics')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { passwords, cards, setQuickEdit, setQuickCreate, t, globalSearch } = useContext(AppContext);
  const globalTerms = useMemo(() => splitSearchTerms(globalSearch), [globalSearch]);
  
  const favorites = useMemo(() => (
    passwords.filter((item) => item.favorite && matchesSearchTerms(passwordSearchFields(item), globalTerms))
  ), [passwords, globalTerms]);

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

      {/* Favorites */}
      {favorites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center"><Star size={16} className="mr-2 text-yellow-500"/> {t('favorites')}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {favorites.map(fav => (
              <div key={fav.id} className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)] flex items-center space-x-3 cursor-pointer hover:border-[var(--primary)] transition-colors" onClick={() => setQuickEdit({ type: 'password', item: fav })}>
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

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">{t('quickActions')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setQuickCreate('password')} icon={Plus} className="text-sm">{t('addPassword')}</Button>
          <Button variant="secondary" onClick={() => setQuickCreate('card')} icon={Plus} className="text-sm">{t('addCard')}</Button>
        </div>
      </div>

    </div>
  );
};

const PasswordManager = () => {
  const { passwords, setPasswords, cards, categories, setCategories, syncVault, t, copyToClipboard, showToast, globalSearch, registerScreenBackHandler } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => sessionStorage.getItem(PASSWORDS_PENDING_CATEGORY_KEY) || null);
  const [detailItem, setDetailItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  const [form, setForm] = useState({ title: '', url: '', username: '', password: '', notes: '', category: 'Other', favorite: false });
  const [showPwdInForm, setShowPwdInForm] = useState(false);
  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false);
  const [aiFallbackNotice, setAiFallbackNotice] = useState('');
  const globalTerms = useMemo(() => splitSearchTerms(globalSearch), [globalSearch]);
  const localTerms = useMemo(() => splitSearchTerms(search), [search]);
  const bestGlobalMatch = useMemo(
    () => findBestPasswordMatch(passwords, globalTerms, globalSearch),
    [passwords, globalTerms, globalSearch]
  );

  const categoryOptions = useMemo(
    () => sortCategoriesForDisplay(categories).map(getCategoryName).filter(name => name),
    [categories]
  );

  useEffect(() => {
    const pendingCategory = sessionStorage.getItem(PASSWORDS_PENDING_CATEGORY_KEY);
    if (pendingCategory) {
      setSelectedCategory(pendingCategory);
      sessionStorage.removeItem(PASSWORDS_PENDING_CATEGORY_KEY);
    }
  }, []);

  const selectedCategoryCount = useMemo(() => {
    if (!selectedCategory) return 0;
    return passwords.filter((p) => p.category === selectedCategory && matchesSearchTerms(passwordSearchFields(p), globalTerms)).length;
  }, [passwords, selectedCategory, globalTerms]);

  const otherDuplicatesCount = useMemo(() => {
    if (selectedCategory !== 'Other') return 0;
    const { removed } = dedupePasswordsByCategory(passwords, 'Other');
    return removed.length;
  }, [passwords, selectedCategory]);

  const categoryMatchesSearch = useCallback((categoryName) => {
    if (!globalTerms.length) return true;
    if (matchesSearchTerms([categoryName], globalTerms)) return true;
    return passwords.some((item) => item.category === categoryName && matchesSearchTerms(passwordSearchFields(item), globalTerms));
  }, [globalTerms, passwords]);

  const filtered = useMemo(() => {
    if (!selectedCategory) return [];
    const activeTerms = globalTerms.length ? globalTerms : localTerms;
    return passwords.filter(p => {
      const searchMatch = matchesSearchTerms(passwordSearchFields(p), activeTerms);
      return searchMatch && p.category === selectedCategory;
    }).sort((a, b) => {
      const aLabel = (a.title || a.username || '').trim().toLocaleLowerCase();
      const bLabel = (b.title || b.username || '').trim().toLocaleLowerCase();
      return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
    });
  }, [passwords, localTerms, globalTerms, selectedCategory]);

  useEffect(() => {
    if (!globalTerms.length || !bestGlobalMatch) return;
    setSelectedCategory((current) => (current === bestGlobalMatch.category ? current : bestGlobalMatch.category));
    setDetailItem(null);
  }, [bestGlobalMatch, globalTerms.length]);

  useEffect(() => registerScreenBackHandler(() => {
    if (detailItem) {
      setDetailItem(null);
      return true;
    }
    if (isModalOpen) {
      setIsModalOpen(false);
      return true;
    }
    if (isCatModalOpen) {
      setIsCatModalOpen(false);
      return true;
    }
    if (selectedCategory) {
      setSelectedCategory(null);
      setSearch('');
      setDetailItem(null);
      sessionStorage.removeItem(PASSWORDS_PENDING_CATEGORY_KEY);
      return true;
    }
    return false;
  }), [registerScreenBackHandler, detailItem, isModalOpen, isCatModalOpen, selectedCategory]);


  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setForm(item);
    } else {
      setEditingItem(null);
      setForm({ title: '', url: '', username: '', password: '', notes: '', category: selectedCategory || 'Other', favorite: false });
    }
    setIsModalOpen(true);
  };

  const handleRemoveOtherDuplicates = async () => {
    const { kept, removed } = dedupePasswordsByCategory(passwords, 'Other');
    if (!removed.length) {
      showToast(t('removeOtherDuplicatesNone'));
      return;
    }

    if (!window.confirm(`${t('removeOtherDuplicatesConfirm')} ${removed.length} ${t('items')}.`)) return;

    const nextPasswords = kept;
    setPasswords(nextPasswords);
    if (selectedCategory === 'Other') {
      setDetailItem(null);
    }

    try {
      await persistVault(categories, nextPasswords);
      showToast(`${removed.length} ${t('items')} · ${t('removeOtherDuplicatesDone')}`);
    } catch (error) {
      setPasswords(passwords);
      showToast('Não foi possível gravar a limpeza de duplicados.');
      console.error(error);
    }
  };

  const persistVault = async (nextCategories, nextPasswords) => {
    return syncVault({ nextCategories, nextPasswords, nextCards: cards });
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setNewCatName('');
    setIsCatModalOpen(true);
  };

  const openEditCategory = (category) => {
    if (isSystemCategory(category.name)) return;
    setEditingCategory(category);
    setNewCatName(category.name);
    setIsCatModalOpen(true);
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
      const prompt = `Identifica o URL oficial mais provável para o serviço com o nome "${form.title}" e o URL atual "${form.url}". Responde apenas com um URL completo e válido, incluindo https://, sem texto adicional.`;
      const schema = {
        type: "OBJECT",
        properties: {
          url: { type: "STRING" }
        }
      };
      const result = await callGemini(prompt, schema);
      if (result) {
        const fallbackUrl = inferUrlFallback(form.title, form.url);
        setForm(prev => ({ 
          ...prev, 
          url: result.url || fallbackUrl || prev.url
        }));
        setAiFallbackNotice('');
        showToast("Informação preenchida com ✨ IA!");
      }
    } catch (error) {
      const fallbackUrl = inferUrlFallback(form.title, form.url);
      setForm(prev => ({
        ...prev,
        url: fallbackUrl || prev.url,
      }));
      setAiFallbackNotice('Modo sem IA ativo: usei sugestões locais.');
      showToast("IA indisponível, usei sugestões locais.");
    } finally {
      setIsGeneratingInfo(false);
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setIsCatModalOpen(false);
      return;
    }

    if (editingCategory) {
      if (editingCategory.name === trimmed) {
        setIsCatModalOpen(false);
        setEditingCategory(null);
        setNewCatName('');
        return;
      }
      if (categories.some(cat => cat.name.toLowerCase() === trimmed.toLowerCase())) {
        showToast('Já existe uma pasta com esse nome.');
        return;
      }
      const nextCategories = normalizeCategories(categories.map(cat => {
        if (cat.name !== editingCategory.name) return cat;
        return { ...cat, name: trimmed };
      }));
      setCategories(nextCategories);
      setPasswords(prev => prev.map(p => p.category === editingCategory.name ? { ...p, category: trimmed } : p));
      if (selectedCategory === editingCategory.name) {
        setSelectedCategory(trimmed);
        setDetailItem(null);
      }
      const nextPasswords = passwords.map(p => p.category === editingCategory.name ? { ...p, category: trimmed } : p);
      persistVault(nextCategories, nextPasswords).catch(error => {
        showToast('Não foi possível gravar a alteração da pasta.');
        console.error(error);
      });
    } else if (!categories.some(cat => cat.name.toLowerCase() === trimmed.toLowerCase())) {
      const otherOrder = categories.find((cat) => isSystemCategory(cat.name))?.order ?? (categories.length + 1000);
      const highestNonSystemOrder = Math.max(
        -1,
        ...categories
          .filter((cat) => !isSystemCategory(cat.name))
          .map((cat) => Number(cat.order) || 0)
      );
      const nextOrder = Math.min(highestNonSystemOrder + 1, otherOrder - 1);
      const nextCategories = normalizeCategories([...categories, { name: trimmed, order: nextOrder }]);
      setCategories(nextCategories);
      setSelectedCategory(trimmed);
      setDetailItem(null);
      persistVault(nextCategories, passwords).catch(error => {
        showToast('Não foi possível gravar a nova pasta.');
        console.error(error);
      });
    }
    setIsCatModalOpen(false);
    setNewCatName('');
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (categoryName) => {
    if (isSystemCategory(categoryName)) {
      showToast('A pasta Other é de sistema e não pode ser apagada.');
      return;
    }
    if (categories.length <= 1) {
      showToast('Precisas de manter pelo menos uma pasta.');
      return;
    }
    const fallbackCategory = categories.find(cat => cat.name !== categoryName && !isSystemCategory(cat.name))?.name || categories.find(cat => cat.name !== categoryName)?.name;
    if (!fallbackCategory) {
      showToast('Não foi possível escolher uma pasta destino.');
      return;
    }
    if (!window.confirm(`Apagar a pasta "${categoryName}"? As passwords serão movidas para "${fallbackCategory}".`)) return;

    const nextPasswords = passwords.map(p => p.category === categoryName ? { ...p, category: fallbackCategory } : p);
    const nextCategories = normalizeCategories(categories.filter(cat => cat.name !== categoryName));

    setPasswords(nextPasswords);
    setCategories(nextCategories);
    if (selectedCategory === categoryName) {
      setSelectedCategory(fallbackCategory);
      setSearch('');
      setDetailItem(null);
    }

    try {
      await persistVault(nextCategories, nextPasswords);
      showToast(`Pasta "${categoryName}" apagada.`);
    } catch (error) {
      setPasswords(passwords);
      setCategories(categories);
      if (selectedCategory === categoryName) {
        setSelectedCategory(categoryName);
        setDetailItem(null);
      }
      showToast('Não foi possível gravar a alteração da pasta.');
      console.error(error);
    }
  };

  const getCatCount = (cat) => {
    return passwords.filter((p) => p.category === cat && matchesSearchTerms(passwordSearchFields(p), globalTerms)).length;
  };

  const orderedCategories = useMemo(() => sortCategoriesForDisplay(categories), [categories]);
  const visibleCategories = useMemo(() => (
    orderedCategories.filter((cat) => categoryMatchesSearch(cat.name))
  ), [orderedCategories, categoryMatchesSearch]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-transparent">
      <div className="relative flex h-full min-h-0 flex-col p-2 sm:p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--text)] sm:mt-4 sm:text-4xl">
            {t('passwords')}
          </h1>
        </div>

        {!selectedCategory ? (
          <div className="mt-6 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24 sm:pb-10">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
              <Button onClick={() => handleOpenModal()} icon={Plus} className="w-full rounded-2xl px-5 sm:w-auto">
                {t('addPassword')}
              </Button>
              <Button onClick={openNewCategory} variant="secondary" icon={Plus} className="w-full rounded-2xl px-5 sm:w-auto">
                {t('newCategory')}
              </Button>
            </div>

            <div className="w-full">
              <div className="divide-y divide-white/8 border-y border-white/8 sm:rounded-none">
                {visibleCategories.map(cat => {
                  const tone = cat.name === 'Other' ? CATEGORY_NEUTRAL : createFolderColor(cat.order);
                  return (
                    <div
                      key={cat.name}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (e.target.closest('[data-folder-actions="true"]')) return;
                        setDetailItem(null);
                        setSelectedCategory(cat.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDetailItem(null);
                          setSelectedCategory(cat.name);
                        }
                      }}
                      className="group flex w-full cursor-pointer items-center gap-1.5 px-0 py-2 text-left transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:outline-none sm:gap-3 sm:py-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
                        <span
                          className="h-6 w-1 rounded-full shrink-0 sm:h-8 sm:w-1.5"
                          style={{ background: `linear-gradient(180deg, ${tone.base}, ${tone.dark})` }}
                        />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-[17px] font-semibold tracking-wide text-white sm:text-[15px]">{cat.name}</h3>
                            {isSystemCategory(cat.name) && (
                              <span className="rounded-full border border-white/10 bg-black/15 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/70">
                                Sistema
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="w-fit rounded-full border border-black/35 bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur sm:px-2.5 sm:py-1 sm:text-[10px]">
                          {getCatCount(cat.name)} {t('items')}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1" data-folder-actions="true">
                        {!isSystemCategory(cat.name) && (
                          <>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditCategory(cat);
                              }}
                              className="rounded-full border border-white/10 bg-white/5 p-[5px] text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:p-2"
                              aria-label={`Editar ${cat.name}`}
                            >
                              <Edit size={11} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(cat.name);
                              }}
                              className="rounded-full border border-white/10 bg-white/5 p-[5px] text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:p-2"
                              aria-label={`Apagar ${cat.name}`}
                            >
                              <Trash size={11} />
                            </button>
                          </>
                        )}
                        <ChevronRight size={14} className="ml-0.5 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5 sm:ml-0" />
                      </div>
                    </div>
                  );
                })}
                {visibleCategories.length === 0 && (
                  <div className="px-0 py-5 text-center text-sm text-[var(--text-muted)]">
                    {t('noData')}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24 sm:pb-10">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setDetailItem(null);
                    setSelectedCategory(null);
                    setSearch('');
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] lg:w-auto"
                >
                  <ArrowLeft size={12} />
                  {t('backToFolders')}
                </button>
                <h2 className="mt-4 text-2xl font-black text-[var(--text)] sm:text-3xl">{selectedCategory}</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {selectedCategoryCount} {t('items')}
                </p>
              </div>

              <Button onClick={() => handleOpenModal()} icon={Plus} className="w-full rounded-2xl px-5 sm:w-auto">
                {t('addPassword')}
              </Button>
              {selectedCategory === 'Other' && (
                <Button onClick={handleRemoveOtherDuplicates} variant="secondary" icon={Trash} className="w-full rounded-2xl px-5 sm:w-auto">
                  {t('removeOtherDuplicates')}
                </Button>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-4 py-3 shadow-inner shadow-black/5">
                <div className="flex items-center gap-3">
                  <Search size={18} className="text-[var(--text-muted)] shrink-0" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('search')}
                    className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                </div>
              </div>

              <div className="hidden lg:flex items-center rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 px-4 py-3 text-sm text-[var(--text-muted)]">
                {selectedCategory}
              </div>
            </div>

            <div className="mt-5 pb-8 sm:pb-0">
              {filtered.length === 0 ? (
                <div className="flex h-[180px] items-center justify-center border-y border-dashed border-[var(--border)] bg-transparent text-[var(--text-muted)]">
                  <span className="text-sm">{selectedCategory}</span>
                </div>
              ) : (
                <div className="divide-y divide-white/8 border-y border-white/8">
                  {filtered.map(item => (
                    <div
                      key={item.id}
                      className="group grid cursor-pointer grid-cols-1 items-start gap-3 px-0 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                    >
                      <button
                        type="button"
                        onClick={() => setDetailItem(item)}
                        className="flex min-w-0 items-center gap-3 text-left sm:pr-4"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden">
                          <img
                            src={getFavicon(item.url)}
                            alt=""
                            className="h-7 w-7 object-contain"
                            onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                          />
                          <div className="hidden h-9 w-9 items-center justify-center text-sm font-black text-white/90">
                            {item.title.charAt(0)}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-[var(--text)]">
                              {item.title}
                            </h3>
                            {item.favorite && <Star size={14} className="fill-current text-yellow-500" />}
                          </div>
                          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                            {item.username || '—'}
                          </p>
                        </div>

                        <ChevronRight
                          size={15}
                          className="shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title={detailItem?.title || t('passwords')}>
        {detailItem && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-black/15">
                <img
                  src={getFavicon(detailItem.url)}
                  alt=""
                  className="h-7 w-7 object-contain"
                  onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                />
                <div className="hidden h-12 w-12 items-center justify-center text-sm font-black text-white/90">
                  {detailItem.title.charAt(0)}
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-[var(--text)]">{detailItem.title}</h3>
                <p className="truncate text-sm text-[var(--text-muted)]">{selectedCategory}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">User</p>
                  <p className="mt-1 truncate text-sm text-[var(--text)]">{detailItem.username || '—'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(detailItem.username)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/5 text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  title="Copiar utilizador"
                >
                  <Copy size={13} />
                </button>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-[var(--primary)]/20 bg-[linear-gradient(135deg,rgba(124,92,255,0.14),rgba(255,255,255,0.03))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]/90">Password</p>
                  <div className="mt-1">
                    <SecretText
                      text={detailItem.password}
                      showCopy={false}
                      textClassName="truncate text-sm font-semibold tracking-[0.16em] text-[var(--text)]"
                      toggleClassName="rounded-full border border-[var(--primary)]/20 bg-black/10 p-1.5 text-[var(--primary)] hover:bg-[var(--primary)]/12"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(detailItem.password)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--primary)]/20 bg-black/10 text-[var(--primary)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/12"
                  title="Copiar password"
                >
                  <Key size={13} />
                </button>
              </div>

              {detailItem.notes && (
                <div className="rounded-2xl border border-white/8 bg-black/8 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Notas</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap">{detailItem.notes}</p>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setDetailItem(null);
                    handleOpenModal(detailItem);
                  }}
                  className="inline-flex w-full flex-1 items-center justify-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-4 py-2 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] sm:w-auto"
                >
                  <Edit size={14} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailItem(null);
                    handleDelete(detailItem.id);
                  }}
                  className="inline-flex w-full flex-1 items-center justify-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-4 py-2 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)] sm:w-auto"
                >
                  <Trash size={14} />
                  <span>Apagar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

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
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {aiFallbackNotice && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-200/90 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{aiFallbackNotice}</span>
            </div>
          )}

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

      <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title={editingCategory ? t('editCategory') : t('newCategory')}>
        <form onSubmit={handleAddCategory} className="space-y-4">
          <Input label={t('categoryName')} value={newCatName} onChange={e => setNewCatName(e.target.value)} required autoFocus />
          <p className="text-xs text-[var(--text-muted)]">
            A cor desta pasta é atribuída automaticamente e não se repete.
          </p>
          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsCatModalOpen(false)} className="flex-1">{t('cancel')}</Button>
            <Button type="submit" className="flex-1">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
    </div>
  );
};

const CardManager = () => {
  const { cards, setCards, t, copyToClipboard, globalSearch, registerScreenBackHandler } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const globalTerms = useMemo(() => splitSearchTerms(globalSearch), [globalSearch]);

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

  const filteredCards = useMemo(() => (
    cards.filter((card) => matchesSearchTerms(cardSearchFields(card), globalTerms))
  ), [cards, globalTerms]);

  useEffect(() => registerScreenBackHandler(() => {
    if (isModalOpen) {
      setIsModalOpen(false);
      return true;
    }
    return false;
  }), [registerScreenBackHandler, isModalOpen]);

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
        {filteredCards.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-10">{t('noData')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map(card => <VisualCard key={card.id} card={card} onClick={() => handleOpenModal(card)} />)}
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

const GlobalQuickCreateModals = () => {
  const { quickCreate, setQuickCreate, categories, setPasswords, setCards, t } = useContext(AppContext);
  const [passwordForm, setPasswordForm] = useState({ title: '', url: '', username: '', password: '', notes: '', category: 'Other', favorite: false });
  const [cardForm, setCardForm] = useState({ name: '', number: '', holder: '', expiry: '', cvv: '', pin: '', color: 'from-blue-600 to-blue-900' });
  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false);
  const [aiFallbackNotice, setAiFallbackNotice] = useState('');

  const CARD_COLORS = [
    'from-blue-600 to-blue-900', 'from-gray-700 to-black', 'from-emerald-500 to-emerald-900',
    'from-rose-500 to-rose-900', 'from-purple-600 to-purple-900', 'from-orange-500 to-red-600'
  ];

  useEffect(() => {
    if (quickCreate === 'password') {
      setPasswordForm({ title: '', url: '', username: '', password: '', notes: '', category: 'Other', favorite: false });
    }
    if (quickCreate === 'card') {
      setCardForm({ name: '', number: '', holder: '', expiry: '', cvv: '', pin: '', color: CARD_COLORS[0] });
    }
  }, [quickCreate]);

  if (!quickCreate) return null;

  const handleSavePassword = (e) => {
    e.preventDefault();
    setPasswords(prev => [{ ...passwordForm, id: Date.now().toString(), date: Date.now() }, ...prev]);
    setQuickCreate(null);
  };

  const handleSaveCard = (e) => {
    e.preventDefault();
    setCards(prev => [{ ...cardForm, id: Date.now().toString(), date: Date.now() }, ...prev]);
    setQuickCreate(null);
  };

  const handleSmartFillPassword = async () => {
    if (!passwordForm.title && !passwordForm.url) {
      return;
    }

    setIsGeneratingInfo(true);
    try {
      const prompt = `Identifica o URL oficial mais provável para o serviço com o nome "${passwordForm.title}" e o URL atual "${passwordForm.url}". Responde apenas com um URL completo e válido, incluindo https://, sem texto adicional.`;
      const schema = {
        type: "OBJECT",
        properties: {
          url: { type: "STRING" }
        }
      };
      const result = await callGemini(prompt, schema);
      const fallbackUrl = inferUrlFallback(passwordForm.title, passwordForm.url);
      setPasswordForm(prev => ({ ...prev, url: result?.url || fallbackUrl || prev.url }));
      setAiFallbackNotice('');
    } catch {
      const fallbackUrl = inferUrlFallback(passwordForm.title, passwordForm.url);
      setPasswordForm(prev => ({ ...prev, url: fallbackUrl || prev.url }));
      setAiFallbackNotice('Modo sem IA ativo: usei uma URL sugerida localmente.');
    } finally {
      setIsGeneratingInfo(false);
    }
  };

  const passwordPreview = passwordForm.url ? getFavicon(passwordForm.url) : null;
  const cardType = getCardType(cardForm.number || '');

  return (
    <>
      <Modal isOpen={quickCreate === 'password'} onClose={() => setQuickCreate(null)} title={t('addPassword')}>
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div className="flex items-center justify-center mb-4">
            <img src={passwordPreview} alt="" className="w-16 h-16 rounded-2xl bg-[var(--bg)] p-2 border border-[var(--border)]" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/20 text-[var(--primary)] hidden items-center justify-center font-bold text-2xl border border-[var(--border)]">{passwordForm.title ? passwordForm.title.charAt(0) : <Globe/>}</div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSmartFillPassword}
              disabled={isGeneratingInfo || (!passwordForm.title && !passwordForm.url)}
              className="flex items-center text-xs font-medium px-2 py-1 rounded bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-500 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/30 transition-all disabled:opacity-50"
            >
              {isGeneratingInfo ? <Loader2 size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="mr-1"/>}
              {t('smartFill')}
            </button>
          </div>

          {aiFallbackNotice && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-200/90 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{aiFallbackNotice}</span>
            </div>
          )}

          <Input label={t('serviceName')} value={passwordForm.title} onChange={e => setPasswordForm({...passwordForm, title: e.target.value})} required />
          <Input label={t('url')} value={passwordForm.url} onChange={e => setPasswordForm({...passwordForm, url: e.target.value})} placeholder="https://" />
          <Input label={t('username')} value={passwordForm.username} onChange={e => setPasswordForm({...passwordForm, username: e.target.value})} />
          <Input label={t('password')} type="password" value={passwordForm.password} onChange={e => setPasswordForm({...passwordForm, password: e.target.value})} required />
          <Input label={t('notes')} value={passwordForm.notes} onChange={e => setPasswordForm({...passwordForm, notes: e.target.value})} />
          <div>
            <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">{t('category')}</label>
            <select value={passwordForm.category} onChange={e => setPasswordForm({...passwordForm, category: e.target.value})} className="w-full bg-transparent text-sm text-[var(--text)] border border-[var(--border)] rounded-lg p-2 outline-none">
                {sortCategoriesForDisplay(categories).map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setQuickCreate(null)} className="flex-1">{t('cancel')}</Button>
            <Button type="submit" className="flex-1">{t('save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={quickCreate === 'card'} onClose={() => setQuickCreate(null)} title={t('addCard')}>
        <div className="mb-6">
          <div className={`relative h-48 rounded-2xl p-6 text-white shadow-xl bg-gradient-to-br ${cardForm.color} overflow-hidden border border-white/10`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold tracking-wider text-white/90">{cardForm.name || 'My Card'}</h3>
                <span className="font-bold italic text-lg opacity-80">{cardType}</span>
              </div>
              <div>
                <div className="font-mono text-xl tracking-widest mb-2 text-white/80">
                  {cardForm.number ? formatCardNumber(cardForm.number).replace(/\d(?=\d{4})/g, "•") : '•••• •••• •••• ••••'}
                </div>
                <div className="flex justify-between text-sm text-white/70">
                  <span className="uppercase tracking-widest">{cardForm.holder || 'NAME'}</span>
                  <span className="font-mono">{cardForm.expiry || 'MM/YY'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveCard} className="space-y-4">
          <Input label={t('serviceName')} value={cardForm.name} onChange={e => setCardForm({...cardForm, name: e.target.value})} placeholder="e.g. Personal Visa" required />
          <Input label={t('cardNumber')} value={formatCardNumber(cardForm.number)} onChange={e => setCardForm({...cardForm, number: e.target.value.replace(/\D/g, '')})} maxLength={19} required />
          <Input label={t('cardHolder')} value={cardForm.holder} onChange={e => setCardForm({...cardForm, holder: e.target.value.toUpperCase()})} />
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('expiry')} value={cardForm.expiry} onChange={e => setCardForm({...cardForm, expiry: e.target.value})} placeholder="MM/YY" />
            <Input label={t('cvv')} type="password" value={cardForm.cvv} onChange={e => setCardForm({...cardForm, cvv: e.target.value.replace(/\D/g, '')})} maxLength={4} />
            <Input label={t('pin')} type="password" value={cardForm.pin} onChange={e => setCardForm({...cardForm, pin: e.target.value.replace(/\D/g, '')})} maxLength={6} />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Card Style</label>
            <div className="flex space-x-2">
              {CARD_COLORS.map(color => (
                <button key={color} type="button" onClick={() => setCardForm({...cardForm, color})} className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} ${cardForm.color === color ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--primary)]' : ''}`} />
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setQuickCreate(null)} className="flex-1">{t('cancel')}</Button>
            <Button type="submit" className="flex-1">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

const GlobalQuickEditModals = () => {
  const { quickEdit, setQuickEdit, categories, setPasswords, setCards, t } = useContext(AppContext);
  const [passwordForm, setPasswordForm] = useState(null);
  const [cardForm, setCardForm] = useState(null);

  const CARD_COLORS = [
    'from-blue-600 to-blue-900', 'from-gray-700 to-black', 'from-emerald-500 to-emerald-900',
    'from-rose-500 to-rose-900', 'from-purple-600 to-purple-900', 'from-orange-500 to-red-600'
  ];

  useEffect(() => {
    if (!quickEdit) {
      setPasswordForm(null);
      setCardForm(null);
      return;
    }

    if (quickEdit.type === 'password') {
      setPasswordForm({ ...quickEdit.item });
      setCardForm(null);
    }

    if (quickEdit.type === 'card') {
      setCardForm({ ...quickEdit.item });
      setPasswordForm(null);
    }
  }, [quickEdit]);

  if (!quickEdit) return null;

  const handleSavePassword = (e) => {
    e.preventDefault();
    setPasswords(prev => prev.map(p => p.id === passwordForm.id ? { ...passwordForm, date: Date.now() } : p));
    setQuickEdit(null);
  };

  const handleSaveCard = (e) => {
    e.preventDefault();
    setCards(prev => prev.map(c => c.id === cardForm.id ? { ...cardForm, date: Date.now() } : c));
    setQuickEdit(null);
  };

  const passwordPreview = passwordForm?.url ? getFavicon(passwordForm.url) : null;
  const cardType = getCardType(cardForm?.number || '');

  return (
    <>
      <Modal isOpen={quickEdit?.type === 'password'} onClose={() => setQuickEdit(null)} title={t('edit')}>
        {passwordForm && (
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <img src={passwordPreview} alt="" className="w-16 h-16 rounded-2xl bg-[var(--bg)] p-2 border border-[var(--border)]" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
              <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/20 text-[var(--primary)] hidden items-center justify-center font-bold text-2xl border border-[var(--border)]">{passwordForm.title ? passwordForm.title.charAt(0) : <Globe/>}</div>
            </div>

            <Input label={t('serviceName')} value={passwordForm.title} onChange={e => setPasswordForm({...passwordForm, title: e.target.value})} required />
            <Input label={t('url')} value={passwordForm.url} onChange={e => setPasswordForm({...passwordForm, url: e.target.value})} placeholder="https://" />
            <Input label={t('username')} value={passwordForm.username} onChange={e => setPasswordForm({...passwordForm, username: e.target.value})} />
            <Input label={t('password')} type="password" value={passwordForm.password} onChange={e => setPasswordForm({...passwordForm, password: e.target.value})} required />
            <Input label={t('notes')} value={passwordForm.notes} onChange={e => setPasswordForm({...passwordForm, notes: e.target.value})} />
            <div>
            <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">{t('category')}</label>
            <select value={passwordForm.category} onChange={e => setPasswordForm({...passwordForm, category: e.target.value})} className="w-full bg-transparent text-sm text-[var(--text)] border border-[var(--border)] rounded-lg p-2 outline-none">
                {sortCategoriesForDisplay(categories).map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setPasswordForm({...passwordForm, favorite: !passwordForm.favorite})} className={`text-sm flex items-center ${passwordForm.favorite ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`}>
                <Star size={16} className={`mr-1 ${passwordForm.favorite ? 'fill-current' : ''}`} /> {t('favorites')}
              </button>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setQuickEdit(null)} className="flex-1">{t('cancel')}</Button>
              <Button type="submit" className="flex-1">{t('save')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={quickEdit?.type === 'card'} onClose={() => setQuickEdit(null)} title={t('edit')}>
        {cardForm && (
          <>
            <div className="mb-6">
              <div className={`relative h-48 rounded-2xl p-6 text-white shadow-xl bg-gradient-to-br ${cardForm.color} overflow-hidden border border-white/10`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold tracking-wider text-white/90">{cardForm.name || 'My Card'}</h3>
                    <span className="font-bold italic text-lg opacity-80">{cardType}</span>
                  </div>
                  <div>
                    <div className="font-mono text-xl tracking-widest mb-2 text-white/80">
                      {cardForm.number ? formatCardNumber(cardForm.number).replace(/\d(?=\d{4})/g, "•") : '•••• •••• •••• ••••'}
                    </div>
                    <div className="flex justify-between text-sm text-white/70">
                      <span className="uppercase tracking-widest">{cardForm.holder || 'NAME'}</span>
                      <span className="font-mono">{cardForm.expiry || 'MM/YY'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              <Input label={t('serviceName')} value={cardForm.name} onChange={e => setCardForm({...cardForm, name: e.target.value})} placeholder="e.g. Personal Visa" required />
              <Input label={t('cardNumber')} value={formatCardNumber(cardForm.number)} onChange={e => setCardForm({...cardForm, number: e.target.value.replace(/\D/g, '')})} maxLength={19} required />
              <Input label={t('cardHolder')} value={cardForm.holder} onChange={e => setCardForm({...cardForm, holder: e.target.value.toUpperCase()})} />
              <div className="grid grid-cols-3 gap-4">
                <Input label={t('expiry')} value={cardForm.expiry} onChange={e => setCardForm({...cardForm, expiry: e.target.value})} placeholder="MM/YY" />
                <Input label={t('cvv')} type="password" value={cardForm.cvv} onChange={e => setCardForm({...cardForm, cvv: e.target.value.replace(/\D/g, '')})} maxLength={4} />
                <Input label={t('pin')} type="password" value={cardForm.pin} onChange={e => setCardForm({...cardForm, pin: e.target.value.replace(/\D/g, '')})} maxLength={6} />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Card Style</label>
                <div className="flex space-x-2">
                  {CARD_COLORS.map(color => (
                    <button key={color} type="button" onClick={() => setCardForm({...cardForm, color})} className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} ${cardForm.color === color ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--primary)]' : ''}`} />
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setQuickEdit(null)} className="flex-1">{t('cancel')}</Button>
                <Button type="submit" className="flex-1">{t('save')}</Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </>
  );
};

const PasswordGenerator = () => {
  const { t, copyToClipboard } = useContext(AppContext);
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, numbers: true, symbols: true });
  const [generated, setGenerated] = useState('');
  
  const [themePrompt, setThemePrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiFallbackNotice, setAiFallbackNotice] = useState('');

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
        setAiFallbackNotice('');
      } else {
        setGenerated(buildFallbackPassphrase(themePrompt));
        setAiFallbackNotice('Modo sem IA ativo: passphrase gerada localmente.');
      }
    } catch (error) {
      setGenerated(buildFallbackPassphrase(themePrompt));
      setAiFallbackNotice('Modo sem IA ativo: passphrase gerada localmente.');
      showToast("IA indisponível, foi gerada uma alternativa local.");
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
          {aiFallbackNotice && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-200/90 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{aiFallbackNotice}</span>
            </div>
          )}
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
  const {
    theme, setTheme,
    lang, setLang,
    timeoutMinutes, setTimeoutMinutes,
    t, showToast,
    setIsLocked, setMasterHash, setVaultKey, setVaultKeyRaw, setVaultKeyWrapMaster, setVaultSalt, setVaultVersion, setActiveTab,
    userId, masterHash, vaultSalt, vaultVersion, vaultKey, vaultKeyRaw, vaultKeyWrapMaster, passwords, setPasswords, cards, setCards, categories, setCategories,
    passkeyCredentials, setPasskeyCredentials, hasPasskeys, setHasPasskeys, nativeBiometricsEnabled, setNativeBiometricsEnabled, syncVault, registerScreenBackHandler,
  } = useContext(AppContext);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [currentMasterPwd, setCurrentMasterPwd] = useState('');
  const [newMasterPwd, setNewMasterPwd] = useState('');
  const [confirmNewMasterPwd, setConfirmNewMasterPwd] = useState('');
  const [isChangingMaster, setIsChangingMaster] = useState(false);
  const [masterChangeError, setMasterChangeError] = useState('');
  const [isBiometricBusy, setIsBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const backupInputRef = useRef(null);
  const bitwardenInputRef = useRef(null);
  const [bitwardenImportRows, setBitwardenImportRows] = useState([]);
  const [bitwardenImportFileName, setBitwardenImportFileName] = useState('');
  const [bitwardenImportBusy, setBitwardenImportBusy] = useState(false);
  const [bitwardenImportError, setBitwardenImportError] = useState('');
  const [bitwardenDuplicateMode, setBitwardenDuplicateMode] = useState('ignore');
  const identifier = getPersistedAuthIdentifier() || '';
  const currentVaultKeyWrapMaster = vaultKeyWrapMaster || null;

  const bitwardenImportSummary = useMemo(() => {
    const total = bitwardenImportRows.length;
    const duplicates = bitwardenImportRows.filter((row) => row.duplicateId).length;
    const newItems = bitwardenImportRows.filter((row) => !row.duplicateId).length;
    const ignored = bitwardenImportRows.filter((row) => row.duplicateId && row.action === 'ignore').length;
    const importable = bitwardenImportRows.filter((row) => !row.duplicateId || row.action === 'replace').length;
    return {
      total,
      duplicates,
      newItems,
      ignored,
      importable,
    };
  }, [bitwardenImportRows]);

  const resetBitwardenImport = () => {
    setBitwardenImportRows([]);
    setBitwardenImportFileName('');
    setBitwardenImportError('');
    setBitwardenDuplicateMode('ignore');
    if (bitwardenInputRef.current) {
      bitwardenInputRef.current.value = '';
    }
  };

  const handleBitwardenImportFile = async (file) => {
    if (!file) return;

    setBitwardenImportBusy(true);
    setBitwardenImportError('');

    try {
      const raw = await file.text();
      const records = parseBitwardenCsv(raw);
      if (!records.length) {
        throw new Error('O CSV não contém registos importáveis.');
      }

      const previewRows = [];
      records.forEach((record, index) => {
        const mapped = mapBitwardenRecordToPassword(record);
        if (!mapped) return;

        const duplicateMatch = findPasswordImportMatch(mapped, passwords);
        previewRows.push({
          ...mapped,
          id: `bw-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
          date: Date.now(),
          duplicateId: duplicateMatch?.id || null,
          duplicateLabel: duplicateMatch?.title || duplicateMatch?.username || duplicateMatch?.url || '',
          action: duplicateMatch ? bitwardenDuplicateMode : 'import',
        });
      });

      if (!previewRows.length) {
        throw new Error('Não encontrei acessos do Bitwarden para importar.');
      }

      setBitwardenImportRows(previewRows);
      setBitwardenImportFileName(file.name || 'bitwarden.csv');
      setBitwardenImportError('');
      showToast('Importação Bitwarden preparada.');
    } catch (err) {
      setBitwardenImportRows([]);
      setBitwardenImportFileName('');
      setBitwardenImportError(err.message || 'Não foi possível ler o CSV do Bitwarden.');
    } finally {
      setBitwardenImportBusy(false);
      if (bitwardenInputRef.current) {
        bitwardenInputRef.current.value = '';
      }
    }
  };

  const updateBitwardenImportMode = (mode) => {
    setBitwardenDuplicateMode(mode);
    setBitwardenImportRows((rows) => rows.map((row) => (row.duplicateId ? { ...row, action: mode } : row)));
  };

  const updateBitwardenImportRowAction = (rowId, action) => {
    setBitwardenImportRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, action } : row)));
  };

  const handleConfirmBitwardenImport = async () => {
    if (!bitwardenImportRows.length) {
      setBitwardenImportError('Seleciona primeiro um CSV do Bitwarden.');
      return;
    }

    setBitwardenImportBusy(true);
    setBitwardenImportError('');

    try {
      const nextPasswords = [...passwords];
      let created = 0;
      let replaced = 0;
      let ignored = 0;

      bitwardenImportRows.forEach((row) => {
        if (row.duplicateId) {
          if (row.action === 'ignore') {
            ignored += 1;
            return;
          }

          const duplicateIndex = nextPasswords.findIndex((item) => item.id === row.duplicateId);
          if (duplicateIndex === -1) {
            created += 1;
            nextPasswords.push({
              ...row,
              id: `bw-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              category: 'Other',
              date: Date.now(),
            });
            return;
          }

          nextPasswords[duplicateIndex] = {
            ...nextPasswords[duplicateIndex],
            title: row.title,
            url: row.url,
            username: row.username,
            password: row.password,
            notes: row.notes,
            favorite: row.favorite,
            date: Date.now(),
          };
          replaced += 1;
          return;
        }

        nextPasswords.push({
          ...row,
          id: `bw-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          category: 'Other',
          date: Date.now(),
        });
        created += 1;
      });

      const nextCategories = normalizeCategories(categories);
      setPasswords(nextPasswords);
      setCategories(nextCategories);
      sessionStorage.setItem(PASSWORDS_PENDING_CATEGORY_KEY, 'Other');
      setActiveTab('passwords');
      await persistVault(nextCategories, nextPasswords);
      showToast(`Importados ${created} registos${replaced ? `, ${replaced} substituídos` : ''}${ignored ? `, ${ignored} ignorados` : ''}.`);
      resetBitwardenImport();
    } catch (err) {
      setBitwardenImportError(err.message || 'Não foi possível importar o CSV do Bitwarden.');
    } finally {
      setBitwardenImportBusy(false);
    }
  };

  const closeMasterModal = () => {
    setIsMasterModalOpen(false);
    setCurrentMasterPwd('');
    setNewMasterPwd('');
    setConfirmNewMasterPwd('');
    setMasterChangeError('');
  };

  useEffect(() => registerScreenBackHandler(() => {
    if (isMasterModalOpen) {
      closeMasterModal();
      return true;
    }
    return false;
  }), [registerScreenBackHandler, isMasterModalOpen]);

  const handleExportBackup = async () => {
    if (!backupPassword || backupPassword.length < 8) {
      setBackupError('Usa uma password de backup com pelo menos 8 caracteres.');
      return;
    }

    setIsBackupBusy(true);
    setBackupError('');

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        vaultVersion,
        categories,
        passwords,
        cards,
      };

      const encrypted = await encryptBackupPayload(payload, backupPassword);
      const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `passvault-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Backup encriptado exportado.');
    } catch (err) {
      setBackupError(err.message || 'Não foi possível exportar o backup.');
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleRestoreBackupFile = async (file) => {
    if (!file) return;
    if (!backupPassword || backupPassword.length < 8) {
      setBackupError('Insere primeiro a password do backup.');
      return;
    }

    setIsBackupBusy(true);
    setBackupError('');

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const payload = parsed.v === 1 && parsed.kind === 'passvault-backup'
        ? await decryptBackupPayload(parsed, backupPassword)
        : parseLegacyBackupPayload(parsed);

      if (!payload) {
        throw new Error('O ficheiro de backup é inválido ou não é compatível com esta versão.');
      }

      const nextCategories = normalizeCategories(Array.isArray(payload.categories) ? payload.categories : DEFAULT_CATEGORIES);
      const nextPasswords = Array.isArray(payload.passwords) ? payload.passwords : [];
      const nextCards = Array.isArray(payload.cards) ? payload.cards : [];
      const nextVaultVersion = Number.isFinite(Number(payload.vaultVersion)) ? Number(payload.vaultVersion) : vaultVersion;

      setCategories(nextCategories);
      setPasswords(nextPasswords);
      setCards(nextCards);
      setVaultVersion(nextVaultVersion);
      await syncVault({
        nextCategories,
        nextPasswords,
        nextCards,
        nextVaultVersion,
      });
      showToast('Backup restaurado com sucesso.');
    } catch (err) {
      const message = err?.name === 'OperationError' || /decrypt|operationerror/i.test(err?.message || '')
        ? 'Password do backup incorrecta ou ficheiro corrompido.'
        : err.message || 'Não foi possível restaurar o backup.';
      setBackupError(message);
    } finally {
      setIsBackupBusy(false);
      if (backupInputRef.current) {
        backupInputRef.current.value = '';
      }
    }
  };

  const getBiometricRegistrationError = (err) => {
    const message = err?.message || '';
    const code = err?.code || err?.cause?.code || '';
    if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || /previously registered/i.test(message)) {
      return `${t('biometricAlreadyRegistered')} ${t('biometricAlreadyRegisteredHint')}`;
    }
    return message || 'Não foi possível registar a biometria.';
  };

  const handleChangeMasterPassword = async (e) => {
    e.preventDefault();

    if (!currentMasterPwd || !newMasterPwd || !confirmNewMasterPwd) {
      setMasterChangeError('Preenche todos os campos.');
      return;
    }

    if (newMasterPwd.length < 6) {
      setMasterChangeError('A nova palavra-passe tem de ter pelo menos 6 caracteres.');
      return;
    }

    if (newMasterPwd !== confirmNewMasterPwd) {
      setMasterChangeError('As novas palavras-passe não coincidem.');
      return;
    }

    if (!masterHash || !vaultSalt) {
      setMasterChangeError('Não foi possível validar o cofre actual.');
      return;
    }
    if (!vaultKey || !vaultKeyRaw) {
      setMasterChangeError('Não foi possível encontrar a chave do cofre para re-encriptar a alteração.');
      return;
    }

    setIsChangingMaster(true);
    setMasterChangeError('');

    try {
      const currentMaterial = await deriveVaultMaterial(currentMasterPwd, vaultSalt);
      if (currentMaterial.verifier !== masterHash) {
        throw new Error('Palavra-passe mestra actual inválida.');
      }

      const nextSalt = generateVaultSalt();
      const nextMaterial = await deriveVaultMaterial(newMasterPwd, nextSalt);
      const nextVaultKeyWrapMaster = await encryptVaultObject(vaultKeyRaw, nextMaterial.key);
      const encryptedPasswords = await encryptVaultArray(passwords, vaultKey);
      const encryptedCards = await encryptVaultArray(cards, vaultKey);
      const nextPasskeys = await Promise.all(passkeyCredentials.map(async (credential) => ({
        ...credential,
        wrappedMasterHash: await encryptVaultObject(nextMaterial.verifier, vaultKey),
      })));

      const migrateRes = await fetch(`${API_URL}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'admin_vault',
          oldHash: currentMaterial.verifier,
          newHash: nextMaterial.verifier,
          salt: nextSalt,
          categories,
          passwords: encryptedPasswords,
          cards: encryptedCards,
          vaultKeyWrapMaster: nextVaultKeyWrapMaster,
          webauthnCredentials: nextPasskeys,
        }),
      });

      if (!migrateRes.ok) {
        const payload = await migrateRes.json().catch(() => ({}));
        throw new Error(payload?.error || 'Não foi possível actualizar a palavra-passe mestra.');
      }

      setMasterHash(nextMaterial.verifier);
      setVaultSalt(nextSalt);
      setVaultVersion(2);
      setVaultKeyWrapMaster(nextVaultKeyWrapMaster);
      setPasskeyCredentials(nextPasskeys);
      setHasPasskeys(nextPasskeys.length > 0);
      sessionStorage.setItem('pv_master_hash', nextMaterial.verifier);
      sessionStorage.setItem('pv_vault_salt', nextSalt);
      if (IS_ANDROID_NATIVE && nativeBiometricsEnabled) {
        await writeAndroidBiometricVault({
          userId: userId || 'admin_vault',
          identifier,
          masterHash: nextMaterial.verifier,
          vaultKeyRaw,
          vaultSalt: nextSalt,
          vaultVersion: 2,
          vaultKeyWrapMaster: nextVaultKeyWrapMaster || null,
        }, getVaultStorageScope(userId, identifier));
        setNativeBiometricsEnabled(true);
        setHasPasskeys(true);
      }
      showToast(t('masterPasswordUpdated'));
      closeMasterModal();
    } catch (err) {
      setMasterChangeError(err.message || 'Não foi possível actualizar a palavra-passe mestra.');
    } finally {
      setIsChangingMaster(false);
    }
  };

  const handleRegisterBiometrics = async () => {
    if (!masterHash || !vaultKey || !vaultKeyRaw) {
      setBiometricError('Não foi possível preparar a biometria neste cofre.');
      return;
    }
    setIsBiometricBusy(true);
    setBiometricError('');

    try {
      if (IS_ANDROID_NATIVE) {
        await authenticateAndroidBiometrics('Confirma a biometria para desbloquear o cofre.');
        await writeAndroidBiometricVault({
          userId: userId || 'admin_vault',
          identifier,
          masterHash,
          vaultKeyRaw,
          vaultSalt,
          vaultVersion,
          vaultKeyWrapMaster: currentVaultKeyWrapMaster,
        }, getVaultStorageScope(userId, identifier));
        setNativeBiometricsEnabled(true);
        setHasPasskeys(true);
        showToast('Biometria registada.');
        return;
      }

      const label = window.prompt('Nome para esta biometria', `Passkey ${navigator.platform || 'dispositivo'}`) || 'Passkey';
      const optionsRes = await fetch(`${API_URL}/passkeys/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'admin_vault', identifier, hash: masterHash, label }),
      });

      if (!optionsRes.ok) {
        const payload = await optionsRes.json().catch(() => ({}));
        throw new Error(payload?.error || 'Não foi possível iniciar o registo biométrico.');
      }

      const optionsPayload = await optionsRes.json();
      const registrationOptions = {
        ...optionsPayload.options,
        extensions: {
          ...(optionsPayload.options?.extensions || {}),
          ...(buildPrfExtensionsForSalt(optionsPayload.prfSalt) || {}),
        },
      };

      const registrationResponse = await startRegistration({ optionsJSON: registrationOptions });
      if (!registrationResponse.clientExtensionResults?.prf?.enabled) {
        throw new Error('Este dispositivo não suportou PRF durante o registo biométrico.');
      }
      const verifyRes = await fetch(`${API_URL}/passkeys/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'admin_vault', identifier, hash: masterHash, response: registrationResponse }),
      });

      if (!verifyRes.ok) {
        const payload = await verifyRes.json().catch(() => ({}));
        throw new Error(payload?.error || 'Falha ao verificar o registo biométrico.');
      }

      const verifyPayload = await verifyRes.json();
      const credentialId = verifyPayload?.credential?.id;
      if (!credentialId) {
        throw new Error('Não foi possível obter a credencial biométrica criada.');
      }

      const finishOptionsRes = await fetch(`${API_URL}/passkeys/finish/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'admin_vault', identifier, hash: masterHash, credentialId }),
      });

      if (!finishOptionsRes.ok) {
        const payload = await finishOptionsRes.json().catch(() => ({}));
        throw new Error(payload?.error || 'Não foi possível finalizar a biometria.');
      }

      const finishOptionsPayload = await finishOptionsRes.json();
      const finishOptions = {
        ...finishOptionsPayload.options,
        extensions: {
          ...(finishOptionsPayload.options?.extensions || {}),
          ...(buildPrfExtensionsForCredentials(finishOptionsPayload.credential ? [finishOptionsPayload.credential] : []) || {}),
        },
      };

      const authenticationResponse = await startAuthentication({ optionsJSON: finishOptions });
      const prfSeed = authenticationResponse.clientExtensionResults?.prf?.results?.first;
      if (!prfSeed) {
        throw new Error('Esta credencial não devolveu PRF suficiente para guardar a chave do cofre.');
      }

      const prfKey = await importPasskeyDerivedKey(prfSeed);
      const wrappedVaultKey = await encryptVaultObject(vaultKeyRaw, prfKey);
      const wrappedMasterHash = await encryptVaultObject(masterHash, vaultKey);

      const finishVerifyRes = await fetch(`${API_URL}/passkeys/finish/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'admin_vault',
          identifier,
          hash: masterHash,
          response: authenticationResponse,
          wrappedVaultKey,
          wrappedMasterHash,
        }),
      });

      if (!finishVerifyRes.ok) {
        const payload = await finishVerifyRes.json().catch(() => ({}));
        throw new Error(payload?.error || 'Falha ao guardar a biometria.');
      }

      const finishVerifyPayload = await finishVerifyRes.json().catch(() => ({}));
      const updatedCredential = finishVerifyPayload?.credential || {
        ...finishOptionsPayload.credential,
        wrappedVaultKey,
        wrappedMasterHash,
      };

      const nextPasskeys = [
        ...passkeyCredentials.filter((credential) => credential.id !== updatedCredential.id),
        updatedCredential,
      ];

      setPasskeyCredentials(nextPasskeys);
      setHasPasskeys(true);
      await syncVault({
        nextCategories: categories,
        nextPasswords: passwords,
        nextCards: cards,
        nextPasskeys,
        currentUserId: userId || 'admin_vault',
      });
      showToast('Biometria registada.');
    } catch (err) {
      setBiometricError(getBiometricRegistrationError(err));
    } finally {
      setIsBiometricBusy(false);
    }
  };

  const handleDisableBiometrics = async () => {
    if (!masterHash) return;
    if (!window.confirm('Desejas desactivar a biometria deste cofre?')) return;

    setIsBiometricBusy(true);
    setBiometricError('');

    try {
      if (IS_ANDROID_NATIVE) {
        await clearAndroidBiometricVault(getVaultStorageScope(userId, identifier));
        setNativeBiometricsEnabled(false);
        setHasPasskeys(passkeyCredentials.some((credential) => credential.wrappedVaultKey && credential.wrappedMasterHash));
        showToast('Biometria desactivada.');
        return;
      }

      const res = await fetch(`${API_URL}/passkeys/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'admin_vault', identifier, hash: masterHash }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Não foi possível desligar a biometria.');
      }

      setPasskeyCredentials([]);
      setHasPasskeys(false);
      await syncVault({
        nextCategories: categories,
        nextPasswords: passwords,
        nextCards: cards,
        nextPasskeys: [],
      });
      showToast('Biometria desactivada.');
    } catch (err) {
      setBiometricError(err.message || 'Não foi possível desligar a biometria.');
    } finally {
      setIsBiometricBusy(false);
    }
  };

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

      <div className="pt-4 border-t border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--text)] flex items-center">
          <Shield size={20} className="mr-2 text-[var(--primary)]" />
          {t('changeMasterPassword')}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Actualiza a palavra-passe mestra e reencripta o cofre no servidor.
        </p>
        <div className="mt-4">
          <Button variant="secondary" icon={Lock} className="w-full py-3" onClick={() => {
            setMasterChangeError('');
            setCurrentMasterPwd('');
            setNewMasterPwd('');
            setConfirmNewMasterPwd('');
            setIsMasterModalOpen(true);
          }}>
            {t('changeMasterPassword')}
          </Button>
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--text)] flex items-center">
          <Key size={20} className="mr-2 text-[var(--primary)]" />
          {t('biometricsSection')}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Usa passkeys/biometria para desbloquear o cofre neste dispositivo ou smartphone.
        </p>
        {biometricError && (
          <p className="mt-3 text-[var(--danger)] text-sm flex items-center">
            <AlertTriangle size={14} className="mr-1" />
            {biometricError}
          </p>
        )}
        <div className="mt-4 space-y-3">
          <Button
            variant="secondary"
            icon={Shield}
            className="w-full py-3"
            onClick={handleRegisterBiometrics}
            disabled={isBiometricBusy || !masterHash || !vaultKey || !vaultKeyRaw}
          >
            {isBiometricBusy ? t('generating') : t('registerBiometrics')}
          </Button>
          {hasPasskeys && (
            <Button
              variant="danger"
              icon={Trash}
              className="w-full py-3"
              onClick={handleDisableBiometrics}
              disabled={isBiometricBusy}
            >
              {t('disableBiometrics')}
            </Button>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--text)] flex items-center">
          <FolderPlus size={20} className="mr-2 text-[var(--primary)]" />
          {t('backupSection')}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {t('backupDescription')}
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-2">{t('backupPassword')}</label>
            <input
              type="password"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              placeholder={t('backupPasswordPlaceholder')}
              className="w-full bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          {backupError && (
            <p className="text-[var(--danger)] text-sm flex items-center">
              <AlertTriangle size={14} className="mr-1" />
              {backupError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="secondary"
              icon={Copy}
              className="w-full py-3"
              onClick={handleExportBackup}
              disabled={isBackupBusy}
            >
              {isBackupBusy ? t('generating') : t('exportBackup')}
            </Button>
            <Button
              variant="secondary"
              icon={Folder}
              className="w-full py-3"
              onClick={() => backupInputRef.current?.click()}
              disabled={isBackupBusy}
            >
              {isBackupBusy ? t('generating') : t('restoreBackup')}
            </Button>
          </div>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleRestoreBackupFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--text)] flex items-center">
          <Upload size={20} className="mr-2 text-[var(--primary)]" />
          {t('bitwardenImportSection')}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {t('bitwardenImportDescription')}
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {t('bitwardenImportHint')}
        </p>
        {bitwardenImportError && (
          <p className="mt-3 text-[var(--danger)] text-sm flex items-center">
            <AlertTriangle size={14} className="mr-1" />
            {bitwardenImportError}
          </p>
        )}
        <div className="mt-4 space-y-3">
          <Button
            variant="secondary"
            icon={Upload}
            className="w-full py-3"
            onClick={() => bitwardenInputRef.current?.click()}
            disabled={bitwardenImportBusy}
          >
            {bitwardenImportBusy ? t('generating') : t('bitwardenImportSelect')}
          </Button>
          <input
            ref={bitwardenInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleBitwardenImportFile(e.target.files?.[0])}
          />

          {bitwardenImportRows.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{t('bitwardenImportReview')}</p>
                  <p className="text-xs text-[var(--text-muted)]">{bitwardenImportFileName}</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-2 text-xs text-[var(--text-muted)]">
                  <ArrowLeftRight size={12} className="text-[var(--primary)]" />
                  <span>{t('bitwardenImportDuplicates')}</span>
                  <select
                    value={bitwardenDuplicateMode}
                    onChange={(e) => updateBitwardenImportMode(e.target.value)}
                    className="bg-transparent text-[var(--text)] outline-none"
                  >
                    <option value="ignore">{t('bitwardenImportIgnore')}</option>
                    <option value="replace">{t('bitwardenImportReplace')}</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{t('bitwardenImportTotal')}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text)]">{bitwardenImportSummary.total}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{t('bitwardenImportNew')}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text)]">{bitwardenImportSummary.newItems}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{t('bitwardenImportDuplicates')}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text)]">{bitwardenImportSummary.duplicates}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{t('bitwardenImportIgnored')}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text)]">{bitwardenImportSummary.ignored}</p>
                </div>
              </div>

              <div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
                {bitwardenImportRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText size={14} className="shrink-0 text-[var(--primary)]" />
                          <p className="truncate text-sm font-semibold text-[var(--text)]">{row.title || 'Sem nome'}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${row.duplicateId ? 'border border-amber-500/30 bg-amber-500/10 text-amber-200/90' : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90'}`}>
                            {row.duplicateId ? t('bitwardenImportDuplicates') : t('bitwardenImportNew')}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                          {row.username || '—'}
                          {row.url ? ` • ${row.url}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        <span className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                          Other
                        </span>
                        {row.duplicateId ? (
                          <select
                            value={row.action}
                            onChange={(e) => updateBitwardenImportRowAction(row.id, e.target.value)}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)] outline-none"
                          >
                            <option value="ignore">{t('bitwardenImportIgnore')}</option>
                            <option value="replace">{t('bitwardenImportReplace')}</option>
                          </select>
                        ) : (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
                            {t('bitwardenImportNew')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="primary"
                  icon={Check}
                  className="w-full py-3"
                  onClick={handleConfirmBitwardenImport}
                  disabled={bitwardenImportBusy}
                >
                  {bitwardenImportBusy ? t('generating') : t('bitwardenImportToOther')}
                </Button>
                <Button
                  variant="secondary"
                  icon={Trash}
                  className="w-full py-3"
                  onClick={resetBitwardenImport}
                  disabled={bitwardenImportBusy}
                >
                  {t('bitwardenImportClear')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)]/50 px-4 py-4 text-sm text-[var(--text-muted)]">
              {t('bitwardenImportNoFile')}
            </div>
          )}
        </div>
      </div>

      <div className="pt-8 border-t border-[var(--border)]">
        <Button variant="danger" icon={LogOut} className="w-full py-3" onClick={() => {
          setIsLocked(true);
          setMasterHash(null);
          setVaultKey(null);
          setVaultKeyRaw(null);
          setVaultKeyWrapMaster(null);
          setVaultSalt(null);
          sessionStorage.removeItem('pv_master_hash');
        }}>{t('logout')}</Button>
      </div>

      <Modal isOpen={isMasterModalOpen} onClose={closeMasterModal} title={t('changeMasterPassword')}>
        <form onSubmit={handleChangeMasterPassword} className="space-y-4">
          <Input
            label={t('currentMasterPassword')}
            type="password"
            icon={Lock}
            value={currentMasterPwd}
            onChange={e => setCurrentMasterPwd(e.target.value)}
            required
            autoFocus
          />
          <Input
            label={t('newMasterPassword')}
            type="password"
            icon={Lock}
            value={newMasterPwd}
            onChange={e => setNewMasterPwd(e.target.value)}
            required
          />
          <Input
            label={t('confirmNewMasterPassword')}
            type="password"
            icon={Lock}
            value={confirmNewMasterPwd}
            onChange={e => setConfirmNewMasterPwd(e.target.value)}
            required
          />

          {masterChangeError && (
            <p className="text-[var(--danger)] text-sm flex items-center">
              <AlertTriangle size={14} className="mr-1" />
              {masterChangeError}
            </p>
          )}

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeMasterModal} className="flex-1">
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isChangingMaster} className="flex-1">
              {isChangingMaster ? t('generating') : t('updateMasterPassword')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ==========================================
// 5. MAIN LAYOUT
// ==========================================

const MainLayout = () => {
  const {
    activeTab,
    setActiveTab,
    t,
    setIsLocked,
    setMasterHash,
    setVaultKey,
    setVaultKeyRaw,
    setVaultKeyWrapMaster,
    setVaultSalt,
    setPasskeyCredentials,
    setHasPasskeys,
    globalSearch,
    setGlobalSearch,
    passwords,
    cards,
    categories,
    quickCreate,
    setQuickCreate,
    quickEdit,
    setQuickEdit,
    triggerScreenBackHandler,
  } = useContext(AppContext);
  const globalTerms = useMemo(() => splitSearchTerms(globalSearch), [globalSearch]);

  useEffect(() => {
    const nextTab = resolveGlobalSearchTab({
      terms: globalTerms,
      passwords,
      cards,
      categories,
      activeTab,
    });

    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, cards, categories, globalTerms, passwords, setActiveTab]);

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
    setVaultKey(null);
    setVaultKeyRaw(null);
    setVaultKeyWrapMaster(null);
    setVaultSalt(null);
    sessionStorage.removeItem('pv_master_hash');
  };

  useEffect(() => {
    if (!IS_ANDROID_NATIVE || PREVIEW_MODE) return undefined;

    let isActive = true;
    let listenerHandle = null;

    const registerBackButton = async () => {
      listenerHandle = await CapacitorApp.addListener('backButton', () => {
        if (quickCreate) {
          setQuickCreate(null);
          return;
        }
        if (quickEdit) {
          setQuickEdit(null);
          return;
        }
        if (triggerScreenBackHandler()) {
          return;
        }
        if (activeTab !== 'dashboard') {
          setActiveTab('dashboard');
          return;
        }
        CapacitorApp.exitApp();
      });

      if (!isActive && listenerHandle) {
        await listenerHandle.remove();
      }
    };

    registerBackButton().catch((error) => {
      console.error('Falha ao registar back button Android:', error);
    });

    return () => {
      isActive = false;
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [activeTab, quickCreate, quickEdit, setActiveTab, setQuickCreate, setQuickEdit, triggerScreenBackHandler]);

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="p-6 flex items-center space-x-3 text-[var(--primary)]">
          <Shield size={28} />
          <span className="text-xl font-bold tracking-wide text-[var(--text)]">PassVault</span>
        </div>
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-2.5">
            <Search size={16} className="shrink-0 text-[var(--text-muted)]" />
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
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
      <main className="flex-1 flex min-h-0 flex-col h-full relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20">
          <div className="flex items-center space-x-2 text-[var(--primary)]">
            <Shield size={24} />
            <span className="text-lg font-bold text-[var(--text)]">PassVault</span>
          </div>
          <button onClick={handleLock} className="text-[var(--text-muted)] p-2"><LogOut size={20}/></button>
        </header>

        <div className="md:hidden px-4 pt-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
            <Search size={16} className="shrink-0 text-[var(--text-muted)]" />
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pb-28 md:p-8 md:pb-12">
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
      <GlobalQuickCreateModals />
      <GlobalQuickEditModals />
    </div>
  );
};

const AppContent = () => {
  const { isLocked } = useContext(AppContext);
  if (PREVIEW_MODE) return <MainLayout />;
  return isLocked ? <AuthScreen /> : <MainLayout />;
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
