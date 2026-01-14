import React, { useState, useEffect, useMemo } from 'react';
import { Book, SortField, ImportConflict, Language } from './types';
import { generateId, filterBooks, countBookWords, migrateNotesToBooks } from './utils';
import { NoteCard } from './components/NoteCard';
import { NoteEditor } from './components/NoteEditor';
import { ImportDialog } from './components/ImportDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Button } from './components/Button';
import { Plus, Search, Download, Upload, Moon, Sun, X, Check, Trash2, Menu, Globe, Filter, Loader2 } from 'lucide-react';
import { translations } from './i18n';
import { db } from './db';

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
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  
  const [theme, setTheme] = useStickyState<'light' | 'dark'>('light', 'novellog-theme');
  const [language, setLanguage] = useStickyState<Language>('zh', 'novellog-language');
  
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  
  // UI State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
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

  // Apply Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Initial Data Load & Migration Logic
  useEffect(() => {
    const initData = async () => {
      try {
        setIsLoading(true);
        
        // 1. Check for legacy data in LocalStorage
        const legacyData = window.localStorage.getItem('novellog-notes');
        
        if (legacyData) {
          console.log("Legacy data found in LocalStorage. Migrating to IndexedDB...");
          try {
            const parsed = JSON.parse(legacyData);
            const migratedBooks = migrateNotesToBooks(parsed);
            
            // Batch save to IndexedDB
            await db.saveAllBooks(migratedBooks);
            
            // Clear LocalStorage after successful migration
            window.localStorage.removeItem('novellog-notes');
            console.log("Migration successful.");
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
    const filtered = filterBooks(books, searchQuery, activeTag);
    return filtered.sort((a, b) => {
      if (sortField === 'rating') return b.rating - a.rating;
      if (sortField === 'createdAt') return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt; 
    });
  }, [books, searchQuery, activeTag, sortField]);

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

    // Save to DB
    await db.saveBook(bookToSave);
    
    // Update Local State
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
        // Delete from DB
        await db.deleteBook(id);
        // Update State
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
        
        // Delete from DB sequentially to ensure integrity
        for (const id of idsToDelete) {
            await db.deleteBook(id);
        }

        // Update State
        setBooks(prev => prev.filter(b => !selectedIds.has(b.id)));
        setSelectionMode(false);
        setSelectedIds(new Set());
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Export / Import
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(books));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `novellog_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
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
        // Remove existing from DB is handled during save (put overwrites if id matches, but here IDs are different so we need to explicit delete old or just update state properly)
        // Actually, to keep it simple, we treat 'overwrite' as: delete old ID, add new ID.
        // OR: we keep old ID and update fields.
        // Current logic: New ID is generated for imports in processImport if no conflict.
        // If conflict, `inc` has a random ID from export or old ID.
        
        // Simpler strategy: Add to list to be saved. We will handle ID collision or replacement in saveImportedBooks logic.
        // Since we want to overwrite the *content* of the book with title X, we should delete the OLD book with title X, and add the NEW book.
        finalImportList.push({ ...c.incoming, id: generateId() }); // New ID to be safe
        // And mark existing for deletion
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
      // Reload everything to ensure consistency
      const allBooks = await db.getAllBooks();
      setBooks(allBooks);
  };

  // Render
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
      {/* Navbar with Safe Area Padding */}
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
              {view === 'editor' ? (
                 <div className="flex-1"></div> 
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    {t.appTitle}
                  </h1>
                  <span className="text-[10px] text-slate-400 font-medium mt-1">v1.0</span>
                </div>
              )}
              
              {view === 'list' && (
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
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-2xl mx-auto p-4 pb-20">
        
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
            {/* Stats & Search */}
            {!selectionMode && (
              <div className="mb-4 space-y-3">
                 {/* Stats Header */}
                 <div className="flex justify-between items-end px-1">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {stats.totalBooks} {t.statsBooks} &middot; {stats.totalWords} {t.statsWords}
                    </div>
                 </div>

                 {/* Search Bar */}
                 <div className="flex gap-2">
                    <div className="relative group flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                        <select 
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as SortField)}
                        className="text-xs bg-transparent border-none text-slate-500 focus:ring-0 cursor-pointer text-center"
                        >
                        <option value="updatedAt">{t.sortRecent}</option>
                        <option value="createdAt">{t.sortCreated}</option>
                        <option value="rating">{t.sortRating}</option>
                        </select>
                    </div>
                    </div>

                    {/* Tag Filter Dropdown */}
                    {allTags.length > 0 && (
                      <div className="relative">
                         <select 
                           value={activeTag || ''} 
                           onChange={(e) => setActiveTag(e.target.value || null)}
                           className="appearance-none h-full pl-3 pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer w-[40px] md:w-auto"
                           aria-label="Filter Tags"
                         >
                           <option value="">{t.allTags}</option>
                           {allTags.map(tag => (
                             <option key={tag} value={tag}>#{tag}</option>
                           ))}
                         </select>
                         <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-400">
                            <Filter size={14} />
                         </div>
                      </div>
                    )}
                 </div>
                 
                 {/* Active Tag Chip Display */}
                 {activeTag && (
                      <div className="flex">
                        <button 
                            onClick={() => setActiveTag(null)} 
                            className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-3 py-1.5 rounded-full flex items-center hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                        >
                            {t.tag}: {activeTag} <X size={12} className="ml-1"/>
                        </button>
                      </div>
                 )}
              </div>
            )}

            {/* List */}
            <div className="space-y-2">
              {filteredBooks.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <p className="mb-2">{t.noNotes}</p>
                  {books.length === 0 && <p className="text-sm">{t.startJournal}</p>}
                </div>
              ) : (
                filteredBooks.map(book => (
                  <NoteCard
                    key={book.id}
                    note={book}
                    searchQuery={searchQuery}
                    onClick={(b) => {
                      setEditingBookId(b.id);
                      setView('editor');
                    }}
                    onTagClick={(tag) => setActiveTag(tag)}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(book.id)}
                    onSelect={(id) => {
                      const newSet = new Set(selectedIds);
                      if (newSet.has(id)) newSet.delete(id);
                      else newSet.add(id);
                      setSelectedIds(newSet);
                    }}
                    t={t}
                    locale={locale}
                    language={language}
                  />
                ))
              )}
            </div>
            
            {/* FAB */}
            {!selectionMode && (
              <button
                onClick={() => {
                  setEditingBookId(null);
                  setView('editor');
                }}
                className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all duration-200 z-10"
              >
                <Plus size={28} />
              </button>
            )}
          </>
        )}
      </main>

      {/* Dialogs */}
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
      
      <ConfirmDialog 
        isOpen={confirmConfig.isOpen}
        title={t.delete}
        message={confirmConfig.message}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        isDestructive={true}
      />
    </div>
  );
};

export default App;