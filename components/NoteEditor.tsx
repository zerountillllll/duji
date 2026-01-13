import React, { useState, useEffect, useRef } from 'react';
import { Book, Entry } from '../types';
import { Button } from './Button';
import { Tag } from './Tag';
import { ConfirmDialog } from './ConfirmDialog';
import { fileToBase64, generateId, formatDate } from '../utils';
import { ArrowLeft, Plus, X, Image as ImageIcon, Trash2, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Translation } from '../i18n';

interface NoteEditorProps {
  initialNote?: Book | null;
  onSave: (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  availableTags?: string[];
  existingTitles?: string[]; // Added for duplicate check
  t: Translation;
  locale: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ 
  initialNote, 
  onSave, 
  onCancel, 
  onDelete, 
  availableTags = [], 
  existingTitles = [],
  t, 
  locale 
}) => {
  // Book Metadata
  const [title, setTitle] = useState('');
  const [protagonists, setProtagonists] = useState<string[]>([]);
  const [protagonistInput, setProtagonistInput] = useState('');
  
  const [rating, setRating] = useState<number | ''>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // Entries (Timeline)
  const [entries, setEntries] = useState<Entry[]>([]);
  
  // New Entry Form
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);

  // Dialog State
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  
  // Duplicate Check
  const isDuplicateTitle = existingTitles.some(et => et.toLowerCase() === title.trim().toLowerCase());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entryInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialNote) {
      setTitle(initialNote.title);
      setProtagonists(initialNote.protagonists);
      setRating(initialNote.rating);
      setTags(initialNote.tags);
      // Sort entries by date descending
      setEntries([...initialNote.entries].sort((a, b) => b.createdAt - a.createdAt));
    }
  }, [initialNote]);

  const handleSave = () => {
    if (!title.trim()) {
      alert(t.titleRequired);
      return;
    }

    let updatedEntries = [...entries];

    // If there is new content in the text area that hasn't been added yet, add it automatically
    if (newContent.trim() || newImages.length > 0) {
        const newEntry: Entry = {
            id: generateId(),
            content: newContent,
            images: newImages,
            createdAt: Date.now()
        };
        updatedEntries = [newEntry, ...updatedEntries];
    }

    onSave({
      title,
      protagonists,
      rating: typeof rating === 'number' ? rating : 0,
      tags,
      entries: updatedEntries,
    }, initialNote?.id);
  };

  const handleAddEntry = () => {
    if (!newContent.trim() && newImages.length === 0) return;

    const newEntry: Entry = {
      id: generateId(),
      content: newContent,
      images: newImages,
      createdAt: Date.now()
    };

    setEntries([newEntry, ...entries]);
    setNewContent('');
    setNewImages([]);
  };

  const handleDeleteEntryConfirm = () => {
      if (entryToDelete) {
          setEntries(entries.filter(e => e.id !== entryToDelete));
          setEntryToDelete(null);
      }
  };

  // --- Protagonist Logic ---
  const handleAddProtagonist = () => {
    const trimmed = protagonistInput.trim();
    if (trimmed && !protagonists.includes(trimmed)) {
      setProtagonists([...protagonists, trimmed]);
      setProtagonistInput('');
    }
  };

  const handleKeyDownProtagonist = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddProtagonist();
    }
  };

  const removeProtagonist = (name: string) => {
    setProtagonists(protagonists.filter(p => p !== name));
  };

  // --- Tag Logic ---
  const handleAddTag = (tagToAdd?: string) => {
    const trimmed = tagToAdd || tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleKeyDownTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const quickAddTags = availableTags.filter(t => !tags.includes(t));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        setNewImages([...newImages, base64]);
      } catch (err) {
        console.error("Image upload failed", err);
      }
    }
  };

  const removeImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <button onClick={onCancel} className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
          <ArrowLeft size={22} />
        </button>
        <div className="flex gap-2 items-center">
          {initialNote && onDelete && (
             <button type="button" onClick={() => onDelete(initialNote.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
               <Trash2 size={20} />
             </button>
          )}
          <button onClick={handleSave} className="px-5 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all text-sm shadow-sm">
            {t.save}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Book Metadata Section */}
        <div className="space-y-5">
            {/* Title */}
            <div>
              <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t.titlePlaceholder}
                  className={`w-full text-xl font-bold bg-transparent border-none p-0 focus:ring-0 leading-tight transition-colors ${
                    isDuplicateTitle ? 'text-red-600 dark:text-red-400' : 'placeholder:text-slate-300 dark:placeholder:text-slate-700'
                  }`}
                  autoFocus={!initialNote}
              />
              <div className={`h-px w-12 mt-2 transition-colors duration-300 ${isDuplicateTitle ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
              
              {isDuplicateTitle && (
                <div className="flex items-center mt-2 text-xs text-red-500 dark:text-red-400 animate-in slide-in-from-top-1">
                  <AlertCircle size={12} className="mr-1" />
                  {t.duplicateTitle}
                </div>
              )}

              {initialNote && !isDuplicateTitle && (
                  <div className="flex items-center text-xs text-slate-400 mt-2">
                      {t.created}: {formatDate(initialNote.createdAt, locale)}
                  </div>
              )}
            </div>

            {/* Protagonist (Multi) & Rating */}
            <div>
                 <div className="flex justify-between items-center mb-1.5">
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.protagonist}</label>
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.ratingLabel}</label>
                 </div>
                 <div className="grid grid-cols-[1fr_80px] gap-4">
                    {/* Protagonist Input */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        {protagonists.map(p => (
                            <span key={p} className="inline-flex items-center px-2 py-1 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs shadow-sm border border-slate-100 dark:border-slate-600">
                                {p}
                                <button onClick={() => removeProtagonist(p)} className="ml-1.5 text-slate-400 hover:text-red-500">&times;</button>
                            </span>
                        ))}
                         <div className="flex-1 flex items-center min-w-[100px]">
                           <input
                              type="text"
                              value={protagonistInput}
                              onChange={e => setProtagonistInput(e.target.value)}
                              onKeyDown={handleKeyDownProtagonist}
                              placeholder={t.protagonistPlaceholder}
                              className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400 py-0.5"
                          />
                          <button 
                            type="button" 
                            onClick={handleAddProtagonist}
                            className="ml-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5"
                          >
                            <Plus size={16} />
                          </button>
                         </div>
                    </div>

                    {/* Rating Input */}
                    <div>
                        <input
                        type="number"
                        min="0"
                        max="100"
                        value={rating}
                        onChange={e => {
                            const val = parseInt(e.target.value);
                            if (isNaN(val)) setRating('');
                            else if (val > 100) setRating(100);
                            else if (val < 0) setRating(0);
                            else setRating(val);
                        }}
                        placeholder="-"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none text-center font-mono font-bold text-slate-700 dark:text-slate-200"
                        />
                    </div>
                </div>
            </div>

            {/* Tags */}
            <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.tagsLabel}</label>
            <div className="flex flex-wrap items-center gap-2">
                {tags.map(tag => (
                <Tag key={tag} label={tag} onDelete={() => removeTag(tag)} active />
                ))}
                
                <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-full border border-slate-100 dark:border-slate-800 px-3 py-1">
                  <span className="text-slate-400 mr-1">#</span>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDownTag}
                    placeholder={t.addTagPlaceholder}
                    className="bg-transparent outline-none text-xs placeholder:text-slate-400 w-24"
                  />
                  <button 
                    type="button" 
                    onClick={() => handleAddTag()}
                    className="ml-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <Plus size={14} />
                  </button>
                </div>
            </div>
            
            {/* Quick Add Existing Tags */}
            {quickAddTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                    {quickAddTags.slice(0, 10).map(tag => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => handleAddTag(tag)}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}
            </div>
        </div>
        
        {/* Add New Entry Section */}
        <div className="mt-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
               {t.addEntryLabel}
            </h3>
            
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <textarea
                  ref={entryInputRef}
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  className="w-full h-32 bg-transparent border-none px-4 py-3 focus:ring-0 outline-none resize-none leading-relaxed text-sm placeholder:text-slate-300"
              />
              
              <div className="bg-slate-50 dark:bg-slate-900/50 px-3 py-2 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                 {/* Images Preview Row */}
                 {newImages.length > 0 && (
                    <div className="flex gap-1 mb-1">
                      {newImages.map((img, idx) => (
                          <div key={idx} className="relative group w-10 h-10 rounded overflow-hidden border border-slate-200 dark:border-slate-600">
                          <img src={img} alt="thumb" className="w-full h-full object-cover" />
                          <button 
                              onClick={() => removeImage(idx)}
                              className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                              <X size={12} />
                          </button>
                          </div>
                      ))}
                    </div>
                 )}

                 {/* Controls Row */}
                 <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 flex items-center gap-1 text-xs"
                            title={t.addImage}
                            >
                            <ImageIcon size={18} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload} 
                        />
                    </div>
                    
                    <button
                        onClick={handleAddEntry}
                        disabled={!newContent.trim() && newImages.length === 0}
                        className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {t.confirmAddNote}
                    </button>
                 </div>
              </div>
            </div>
        </div>

        {/* History Timeline */}
        {entries.length > 0 && (
            <div className="mt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t.historyLabel}</h3>
                <div className="space-y-4">
                    {entries.map((entry) => (
                        <div key={entry.id} className="group relative">
                            {/* Connector Line */}
                            <div className="absolute top-4 left-[9px] bottom-[-20px] w-px bg-slate-200 dark:bg-slate-800 last:hidden"></div>
                            
                            <div className="flex gap-4">
                                <div className="mt-1.5 w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 z-10">
                                   <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                </div>
                                
                                <div className="flex-1 pb-2">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="text-[10px] font-bold text-slate-400">
                                            {formatDate(entry.createdAt, locale)}
                                        </div>
                                        <button onClick={() => setEntryToDelete(entry.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                        {entry.content}
                                    </div>
                                    {entry.images && entry.images.length > 0 && (
                                        <div className="flex gap-2 mt-2 overflow-x-auto">
                                            {entry.images.map((img, i) => (
                                                <img key={i} src={img} className="h-16 w-auto rounded border border-slate-200 dark:border-slate-700" alt="attachment" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="h-10" /> 
        
        <ConfirmDialog 
          isOpen={!!entryToDelete}
          title={t.delete}
          message={t.confirmDeleteEntry}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          onConfirm={handleDeleteEntryConfirm}
          onCancel={() => setEntryToDelete(null)}
          isDestructive={true}
        />
      </div>
    </div>
  );
};