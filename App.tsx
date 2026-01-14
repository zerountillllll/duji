import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Book, SortField, ImportConflict, Language } from './types';
import { generateId, filterBooks, countBookWords, migrateNotesToBooks } from './utils';
import { NoteCard } from './components/NoteCard';
import { NoteEditor } from './components/NoteEditor';
import { TagFilterDialog } from './components/TagFilterDialog';
import { ImportDialog } from './components/ImportDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Button } from './components/Button';
import { Plus, Search, Download, Upload, Moon, Sun, X, Check, Trash2, Menu, Globe, Loader2, ChevronDown } from 'lucide-react';
import { translations } from './i18n';
import { db } from './db';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// --- App Version Configuration ---
const APP_VERSION = "v1.0.4"; 

// Keep Theme and Language in LocalStorage for instant UI feedback
const useStickyState = <T,>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    const stickyValue = window.localStorage.getItem(key);
    return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};

const App: React.FC = () => {
  // State
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [theme, setTheme] = useStickyState<'light' | 'dark'>('light', 'novellog-theme');
  const [language, setLanguage] = useStickyState<Language>('zh', 'novellog-language');
  
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  
  // UI State - Dropdowns and Dialogs
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);

  // UI State - General
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showExitToast, setShowExitToast] = useState(false);
  
  // Dialog States
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [pendingImport, setPendingImport] = useState<Book[] | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  // Translations
  const t = translations[language];
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';

  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initial Setup: Status Bar Overlay
  useEffect(() => {
    const initStatusBar = async () => {
      try {
        // Make the status bar transparent (overlay content)
        if (Capacitor.isNativePlatform()) {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
      } catch (e) {
        console.log("StatusBar plugin not available or web environment");
      }
    };
    initStatusBar();
  }, []);

  // Apply Theme & Status Bar Style
  useEffect(() => {
    const applyTheme = async () => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        try {
          if (Capacitor.isNativePlatform()) {
            await StatusBar.setStyle({ style: Style.Dark }); 
          }
        } catch {}
      } else {
        document.documentElement.classList.remove('dark');
        try {
          if (Capacitor.isNativePlatform()) {
             await StatusBar.setStyle({ style: Style.Light }); 
          }
        } catch {}
      }
    };
    applyTheme();
  }, [theme]);

  // Back Button Handling
  useEffect(() => {
    const handleBackButton = async () => {
      const listener = await CapacitorApp.addListener('backButton', () => {
        if (view === 'editor') {
          // IMPORTANT: Do nothing here.
          // The NoteEditor component has its own listener to handle unsaved changes check.
          // If we handle it here, we might bypass that check.
          return;
        } else if (selectionMode) {
          // If selecting, cancel selection
          setSelectionMode(false);
          setSelectedIds(new Set());
        } else if (isMenuOpen) {
           setIsMenuOpen(false);
        } else if (isTagFilterOpen) {
           setIsTagFilterOpen(false);
        } else if (isSortOpen) {
           setIsSortOpen(false);
        } else {
          // Root View: Double tap to exit
          if (showExitToast) {
            CapacitorApp.exitApp();
          } else {
            setShowExitToast(true);
            setTimeout(() => setShowExitToast(false), 2000);
          }
        }
      });
      return listener;
    };

    let listenerHandle: any;
    handleBackButton().then(handle => { listenerHandle = handle; });

    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [view, selectionMode, isMenuOpen, showExitToast, isTagFilterOpen, isSortOpen]);

  // Initial Data Load & Migration Logic
  useEffect(() => {
    const initData = async () => {
      try {
        setIsLoading(true);
        
        // 1. Check for legacy data in LocalStorage
        const legacyData = window.localStorage.getItem('novellog-notes');
        
        if (legacyData) {
          try {
            const parsed = JSON.parse(legacyData);
            const migratedBooks = migrateNotesToBooks(parsed);
            await db.saveAllBooks(migratedBooks);
            window.localStorage.removeItem('novellog-notes');
          } catch (err) {
            console.error("Migration failed:", err);
          }
        }

        // 2. Load data from IndexedDB
        const loadedBooks = await db.getAllBooks();
        setBooks(loadedBooks);
      } catch (error) {
        console.error("Failed to initialize database:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, []);

  // Derived State
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    books.forEach(b => b.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [books]);

  const existingTitles = useMemo(() => {
      return books
        .filter(b => b.id !== editingBookId)
        .map(b => b.title);
  }, [books, editingBookId]);

  const filteredBooks = useMemo(() => {
    const filtered = filterBooks(books, searchQuery, activeTags);
    return filtered.sort((a, b) => {
      if (sortField === 'rating') return b.rating - a.rating;
      if (sortField === 'createdAt') return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt; 
    });
  }, [books, searchQuery, activeTags, sortField]);

  const stats = useMemo(() => ({
    totalBooks: books.length,
    totalWords: books.reduce((acc, book) => acc + countBookWords(book), 0)
  }), [books]);

  // CRUD Operations
  const handleSaveBook = async (bookData: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    const now = Date.now();
    let bookToSave: Book;

    if (id) {
      const existingBook = books.find(b => b.id === id);
      if (!existingBook) return;
      bookToSave = { ...existingBook, ...bookData, updatedAt: now };
    } else {
      bookToSave = {
        ...bookData,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
    }

    await db.saveBook(bookToSave);
    
    setBooks(prev => {
        if (id) {
            return prev.map(b => b.id === id ? bookToSave : b);
        } else {
            return [bookToSave, ...prev];
        }
    });

    setView('list');
    setEditingBookId(null);
  };

  const handleDeleteBook = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      message: t.confirmDelete,
      onConfirm: async () => {
        await db.deleteBook(id);
        setBooks(prev => prev.filter(b => b.id !== id));
        
        if (view === 'editor') {
          setView('list');
          setEditingBookId(null);
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchDelete = () => {
    setConfirmConfig({
      isOpen: true,
      message: t.batchDeleteConfirm(selectedIds.size),
      onConfirm: async () => {
        const idsToDelete = Array.from(selectedIds);
        for (const id of idsToDelete) {
            await db.deleteBook(id);
        }
        setBooks(prev => prev.filter(b => !selectedIds.has(b.id)));
        setSelectionMode(false);
        setSelectedIds(new Set());
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Export / Import logic
  const handleExport = async () => {
    const fileName = `novellog_backup_${new Date().toISOString().slice(0,10)}.json`;
    const jsonString = JSON.stringify(books);

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        await Share.share({
          title: t.exportJson,
          text: `NovelLog Backup - ${new Date().toLocaleDateString()}`,
          files: [result.uri],
          dialogTitle: t.exportJson,
        });

      } else {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      }
    } catch (e: any) {
      console.error("Export failed", e);
      if (Capacitor.isNativePlatform()) {
        alert(`${t.exportFail}${e.message || e}`);
      } else {
        alert(`${t.exportFail}${e.message || ''}`);
      }
    }
    
    setIsMenuOpen(false);
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const result = event.target?.result;
          if (typeof result === 'string') {
            const rawData = JSON.parse(result);
            const importedBooks = migrateNotesToBooks(rawData);
            processImport(importedBooks);
          }
        } catch (err) {
          alert(t.importFail);
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setIsMenuOpen(false);
  };

  const processImport = (imported: Book[]) => {
    const conflicts: ImportConflict[] = [];
    const nonConflicting: Book[] = [];
    const existingTitleMap = new Map(books.map(b => [b.title.toLowerCase(), b]));

    imported.forEach(inc => {
      if (!inc.title) return;
      const existing = existingTitleMap.get(inc.title.toLowerCase());
      if (existing) {
        conflicts.push({ existing, incoming: inc });
      } else {
        nonConflicting.push({ ...inc, id: generateId() }); 
      }
    });

    if (conflicts.length > 0) {
      setPendingImport(nonConflicting);
      setImportConflicts(conflicts);
    } else {
      saveImportedBooks([...nonConflicting]);
      alert(t.importSuccess(nonConflicting.length));
    }
  };

  const resolveImportConflicts = (resolutions: { [key: string]: 'skip' | 'overwrite' }) => {
    let finalImportList: Book[] = [];
    if (pendingImport) {
      finalImportList = [...pendingImport];
    }
    const conflictsToProcess = [...importConflicts];
    conflictsToProcess.forEach(c => {
      const decision = resolutions[c.incoming.id];
      if (decision === 'overwrite') {
        finalImportList.push({ ...c.incoming, id: generateId() }); 
        db.deleteBook(c.existing.id).then(() => {
             setBooks(prev => prev.filter(b => b.id !== c.existing.id));
        });
      }
    });
    saveImportedBooks(finalImportList);
    setImportConflicts([]);
    setPendingImport(null);
  };

  const saveImportedBooks = async (newBooks: Book[]) => {
      await db.saveAllBooks(newBooks);
      const allBooks = await db.getAllBooks();
      setBooks(allBooks);
  };

  if (isLoading) {
      return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <p className="text-slate-500 text-sm">Loading Library...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 flex flex-col">
      {/* Navbar - Only show in LIST view to avoid double headers in Editor */}
      {view === 'list' && (
        <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 pt-safe">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {selectionMode ? (
              <div className="flex items-center w-full justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedIds.size} {t.selected}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSelectionMode(false);
                      setSelectedIds(new Set());
                    }}>{t.cancel}</Button>
                    <Button variant="danger" size="sm" icon={<Trash2 size={16}/>} onClick={handleBatchDelete} disabled={selectedIds.size === 0}>
                      {t.delete}
                    </Button>
                  </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    {t.appTitle}
                  </h1>
                  <span className="text-[10px] text-slate-400 font-medium mt-1">{APP_VERSION}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)} 
                    className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full relative"
                  >
                    <Menu size={20} />
                    {isMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 flex flex-col text-sm z-30 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                        <button onClick={() => {setTheme(current => current === 'light' ? 'dark' : 'light'); setIsMenuOpen(false);}} className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left">
                          {theme === 'light' ? <Moon size={16} className="mr-2"/> : <Sun size={16} className="mr-2"/>} 
                          {theme === 'light' ? t.darkMode : t.lightMode}
                        </button>
                        <button onClick={() => {setLanguage(current => current === 'en' ? 'zh' : 'en'); setIsMenuOpen(false);}} className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left">
                          <Globe size={16} className="mr-2"/> 
                          {t.switchLanguage}
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                        <button onClick={() => {setSelectionMode(true); setIsMenuOpen(false);}} className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left">
                          <Check size={16} className="mr-2"/> {t.selectMultiple}
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                        <button onClick={handleExport} className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left">
                          <Upload size={16} className="mr-2"/> {t.exportJson}
                        </button>
                        <button onClick={handleImportClick} className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left">
                          <Download size={16} className="mr-2"/> {t.importJson}
                        </button>
                      </div>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto ${view === 'list' ? 'max-w-2xl p-4 pb-20' : 'h-full'} relative`}>
        
        {view === 'editor' ? (
          <NoteEditor
            initialNote={editingBookId ? books.find(b => b.id === editingBookId) : null}
            onSave={handleSaveBook}
            onCancel={() => {
              setView('list');
              setEditingBookId(null);
            }}
            onDelete={handleDeleteBook}
            availableTags={allTags}
            existingTitles={existingTitles}
            t={t}
            locale={locale}
          />
        ) : (
          <>
            {/* Stats (Moved back to top, left-aligned) */}
            {!selectionMode && (
                <div className="mb-2 text-xs text-slate-400 font-medium opacity-80 flex items-center gap-3">
                    <span>{stats.totalBooks} {t.statsBooks}</span>
                    <span className="w-0.5 h-3 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                    <span>{stats.totalWords} {t.statsWords}</span>
                </div>
            )}

            {/* Search & Filter */}
            {!selectionMode && (
              <div className="mb-4 space-y-2">
                 {/* Combined Search & Sort Row */}
                 <div className="flex items-center gap-2">
                    {/* Search Bar */}
                    <div className="relative group flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <Search size={16} />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[38px]"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Sort Button (Text with Dropdown, Borderless, Compact) */}
                    <div className="relative" ref={sortRef}>
                        <button 
                        onClick={() => setIsSortOpen(!isSortOpen)}
                        className="h-[38px] px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1 text-sm font-medium transition-colors"
                        >
                            <span>
                                {sortField === 'updatedAt' ? t.sortRecent : sortField === 'createdAt' ? t.sortCreated : t.sortRating}
                            </span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isSortOpen && (
                            <div className="absolute right-0 top-full mt-2 w-24 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                <button onClick={() => { setSortField('updatedAt'); setIsSortOpen(false); }} className={`w-full text-center px-2 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 ${sortField === 'updatedAt' ? 'text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                                    {t.sortRecent}
                                </button>
                                <button onClick={() => { setSortField('createdAt'); setIsSortOpen(false); }} className={`w-full text-center px-2 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 ${sortField === 'createdAt' ? 'text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                                    {t.sortCreated}
                                </button>
                                <button onClick={() => { setSortField('rating'); setIsSortOpen(false); }} className={`w-full text-center px-2 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 ${sortField === 'rating' ? 'text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                                    {t.sortRating}
                                </button>
                            </div>
                        )}
                    </div>
                 </div>

                 {/* Tags Filter Area */}
                 <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setIsTagFilterOpen(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-dashed ${
                            activeTags.size > 0
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-600 hover:text-slate-700'
                        }`}
                    >
                        <Plus size={12} /> {t.filterTags}
                    </button>
                    
                    {Array.from(activeTags).map(tag => (
                        <span key={tag} className="px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 flex items-center">
                            #{tag}
                            <button 
                                onClick={() => {
                                    const newSet = new Set(activeTags);
                                    newSet.delete(tag);
                                    setActiveTags(newSet);
                                }}
                                className="ml-1.5 hover:text-indigo-900 dark:hover:text-indigo-100"
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                 </div>
              </div>
            )}

            {/* List */}
            <div className="space-y-3 pb-20">
              {filteredBooks.length > 0 ? (
                <>
                    {filteredBooks.map(book => (
                      <NoteCard 
                        key={book.id} 
                        note={book} 
                        searchQuery={searchQuery}
                        onClick={() => {
                          if (selectionMode) {
                            const newSet = new Set(selectedIds);
                            if (newSet.has(book.id)) newSet.delete(book.id);
                            else newSet.add(book.id);
                            setSelectedIds(newSet);
                          } else {
                            setEditingBookId(book.id);
                            setView('editor');
                          }
                        }}
                        onTagClick={(tag) => {
                          const newSet = new Set(activeTags);
                          newSet.add(tag);
                          setActiveTags(newSet);
                          setSearchQuery('');
                        }}
                        isSelected={selectedIds.has(book.id)}
                        onSelect={(id) => {
                            const newSet = new Set(selectedIds);
                            if (newSet.has(id)) newSet.delete(id);
                            else newSet.add(id);
                            setSelectedIds(newSet);
                        }}
                        selectionMode={selectionMode}
                        t={t}
                        locale={locale}
                        language={language}
                      />
                    ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                   <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                      <Search size={24} className="opacity-50" />
                   </div>
                   <p>{t.noNotes}</p>
                   {!searchQuery && activeTags.size === 0 && <p className="text-xs mt-2 text-slate-400">{t.startJournal}</p>}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Floating Action Button (Only in List View & Not Selecting) */}
      {view === 'list' && !selectionMode && (
        <button
          onClick={() => {
             setEditingBookId(null);
             setView('editor');
          }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-30"
          aria-label="Add Book"
        >
          <Plus size={28} />
        </button>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog 
        isOpen={confirmConfig.isOpen}
        title={t.alertTitle}
        message={confirmConfig.message}
        confirmLabel={t.ok}
        cancelLabel={t.cancel}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        isDestructive
      />

      {/* Import Conflict Dialog */}
      {importConflicts.length > 0 && (
        <ImportDialog 
          conflicts={importConflicts}
          onResolve={resolveImportConflicts}
          onCancel={() => {
            setImportConflicts([]);
            setPendingImport(null);
          }}
          t={t}
          locale={locale}
        />
      )}

      {/* Tag Filter Dialog */}
      <TagFilterDialog 
        isOpen={isTagFilterOpen}
        onClose={() => setIsTagFilterOpen(false)}
        allTags={allTags}
        selectedTags={activeTags}
        onApply={(tags) => setActiveTags(tags)}
        t={t}
      />
    </div>
  );
};

export default App;