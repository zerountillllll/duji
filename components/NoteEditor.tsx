import React, { useState, useEffect, useRef } from 'react';
import { Book, Entry } from '../types';
import { Button } from './Button';
import { Tag } from './Tag';
import { ConfirmDialog } from './ConfirmDialog';
import { ImageModal } from './ImageModal';
import { fileToBase64, generateId, formatDate } from '../utils';
import { ArrowLeft, Plus, X, Image as ImageIcon, Trash2, Clock, AlertCircle } from 'lucide-react';
import { Translation } from '../i18n';
import { App as CapacitorApp } from '@capacitor/app';

interface NoteEditorProps {
  initialNote?: Book | null;
  onSave: (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  availableTags?: string[];
  existingTitles?: string[];
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  // Confirmation Dialogs
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  
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
      setEntries([...initialNote.entries].sort((a, b) => b.createdAt - a.createdAt));
    }
  }, [initialNote]);

  const hasUnsavedChanges = () => {
    // 1. Check if there is content in the "Add Entry" section or input fields
    if (newContent.trim() !== '' || newImages.length > 0) return true;
    if (protagonistInput.trim() !== '') return true;
    if (tagInput.trim() !== '') return true;

    // 2. Check if main fields differ from initial
    if (initialNote) {
        const currentRating = rating === '' ? 0 : rating;
        if (title !== initialNote.title) return true;
        if (currentRating !== initialNote.rating) return true;
        if (JSON.stringify(protagonists) !== JSON.stringify(initialNote.protagonists)) return true;
        if (JSON.stringify(tags) !== JSON.stringify(initialNote.tags)) return true;
        if (entries.length !== initialNote.entries.length) return true;
        return false;
    } else {
        // New book: is anything filled?
        if (title.trim() !== '') return true;
        if (protagonists.length > 0) return true;
        if (tags.length > 0) return true;
        if (rating !== '' && rating !== 0) return true;
        return false;
    }
  };

  // Hardware Back Button Handler for Editor
  useEffect(() => {
    const handleHardwareBack = async () => {
        const listener = await CapacitorApp.addListener('backButton', () => {
            if (showDiscardConfirm) {
                // If dialog is already open, do nothing (or close it?)
                return; 
            }
            
            if (hasUnsavedChanges()) {
                setShowDiscardConfirm(true);
            } else {
                onCancel();
            }
        });
        return listener;
    };

    let listenerHandle: any;
    handleHardwareBack().then(h => { listenerHandle = h; });

    return () => {
        if (listenerHandle) listenerHandle.remove();
    };
  }, [title, rating, protagonists, tags, entries, newContent, newImages, showDiscardConfirm]);


  const handleBack = () => {
      if (hasUnsavedChanges()) {
          setShowDiscardConfirm(true);
      } else {
          onCancel();
      }
  };

  const handleSave = () => {
    // Title Validation
    if (!title.trim()) {
      setShowDiscardConfirm(false); // Make sure discard dialog is closed if it was open
      setShowValidationAlert(true); // Show Alert
      return;
    }

    let updatedEntries = [...entries];

    // Auto-save draft content as new entry if exists
    if (newContent.trim() || newImages.length > 0) {
        const newEntry: Entry = {
            id: generateId(),
            content: newContent,
            images: newImages,
            createdAt: Date.now()
        };
        updatedEntries = [newEntry, ...updatedEntries];
    }

    // Auto-save pending inputs for Protagonists and Tags
    const finalProtagonists = [...protagonists];
    const pInputTrimmed = protagonistInput.trim();
    if (pInputTrimmed && !finalProtagonists.includes(pInputTrimmed)) {
        finalProtagonists.push(pInputTrimmed);
    }

    const finalTags = [...tags];
    const tInputTrimmed = tagInput.trim();
    if (tInputTrimmed && !finalTags.includes(tInputTrimmed)) {
        finalTags.push(tInputTrimmed);
    }

    onSave({
      title,
      protagonists: finalProtagonists,
      rating: typeof rating === 'number' ? rating : 0,
      tags: finalTags,
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

    setEntries(prev => [newEntry, ...prev]);
    setNewContent('');
    setNewImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteEntryConfirm = () => {
      if (entryToDelete) {
          setEntries(prev => prev.filter(e => e.id !== entryToDelete));
          setEntryToDelete(null);
      }
  };

  // --- Protagonist Logic ---
  const handleAddProtagonist = () => {
    const trimmed = protagonistInput.trim();
    if (trimmed && !protagonists.includes(trimmed)) {
      setProtagonists(prev => [...prev, trimmed]);
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
    setProtagonists(prev => prev.filter(p => p !== name));
  };

  // --- Tag Logic ---
  const handleAddTag = (tagToAdd?: string) => {
    const trimmed = tagToAdd || tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
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
    setTags(prev => prev.filter(t => t !== tag));
  };

  const quickAddTags = availableTags.filter(t => !tags.includes(t));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const files = Array.from(e.target.files);
        const promises = files.map(file => fileToBase64(file));
        const base64Results = await Promise.all(promises);
        setNewImages(prev => [...prev, ...base64Results]);
      } catch (err) {
        console.error("Image upload failed", err);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between pt-safe shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBack}
            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {initialNote ? t.editTitle : t.newTitle}
          </h2>
        </div>
        <div className="flex gap-2">
           {initialNote && onDelete && (
            <Button variant="ghost" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => onDelete(initialNote.id)}>
              <Trash2 size={18} />
            </Button>
           )}
           <Button onClick={handleSave}>{t.save}</Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-safe">
        
        {/* Book Metadata */}
        <div className="space-y-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.bookTitle} <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.titlePlaceholder}
              className={`w-full bg-slate-50 dark:bg-slate-900 border ${!initialNote && isDuplicateTitle ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all`}
            />
            {!initialNote && isDuplicateTitle && (
              <div className="flex items-center gap-1 mt-1 text-xs text-red-500 animate-in slide-in-from-top-1">
                <AlertCircle size={12} />
                {t.duplicateTitle}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* Protagonists */}
             <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.protagonist}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {protagonists.map(p => (
                    <Tag key={p} label={p} onDelete={() => removeProtagonist(p)} active prefix="" />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={protagonistInput}
                    onChange={(e) => setProtagonistInput(e.target.value)}
                    onKeyDown={handleKeyDownProtagonist}
                    placeholder={t.protagonistPlaceholder}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <Button type="button" variant="secondary" onClick={handleAddProtagonist} disabled={!protagonistInput.trim()} size="sm">
                    <Plus size={18} />
                  </Button>
                </div>
             </div>

             {/* Rating */}
             <div className="col-span-2 sm:col-span-1">
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.ratingLabel}</label>
               <input
                 type="number"
                 min="0"
                 max="100"
                 value={rating}
                 onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 100) setRating(val);
                    else if (e.target.value === '') setRating('');
                 }}
                 placeholder={t.scorePlaceholder}
                 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
               />
               <div className="mt-2 w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                        (rating || 0) >= 80 ? 'bg-green-500' : (rating || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} 
                    style={{ width: `${rating || 0}%` }}
                  />
               </div>
             </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.tagsLabel}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <Tag key={tag} label={tag} onDelete={() => removeTag(tag)} active />
              ))}
            </div>
            <div className="flex gap-2 mb-2">
                <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDownTag}
                    placeholder={t.addTagPlaceholder}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <Button type="button" variant="secondary" onClick={() => handleAddTag()} disabled={!tagInput.trim()} size="sm">
                    <Plus size={18} />
                </Button>
            </div>
            {/* Quick Add Tags */}
            {quickAddTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {quickAddTags.slice(0, 8).map(tag => (
                        <Tag key={tag} label={tag} onClick={() => handleAddTag(tag)} />
                    ))}
                </div>
            )}
          </div>
        </div>

        {/* New Entry Section */}
        <div className="space-y-3">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Plus size={16} className="text-indigo-500"/> {t.addEntryLabel}
                </h3>
             </div>
             
             <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                <textarea
                    ref={entryInputRef}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={t.notesPlaceholder}
                    className="w-full p-4 bg-transparent border-none focus:ring-0 resize-none min-h-[120px] text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400"
                />
                
                {/* Image Previews */}
                {newImages.length > 0 && (
                    <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                        {newImages.map((img, idx) => (
                            <div key={idx} className="relative group shrink-0">
                                <img src={img} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                <button 
                                    onClick={() => removeImage(idx)}
                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 flex justify-between items-center border-t border-slate-100 dark:border-slate-700">
                    <div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            multiple
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
                        >
                            <ImageIcon size={18} />
                            {newImages.length === 0 && t.addImage}
                        </button>
                    </div>
                    <Button 
                        size="sm" 
                        onClick={handleAddEntry} 
                        disabled={!newContent.trim() && newImages.length === 0}
                    >
                        {t.confirmAddNote}
                    </Button>
                </div>
             </div>
        </div>

        {/* Timeline */}
        {entries.length > 0 && (
            <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={14} /> {t.historyLabel}
                </h3>
                
                <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-6 pb-2">
                    {entries.map((entry) => (
                        <div key={entry.id} className="relative pl-6 group">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-50 dark:bg-slate-900 border-2 border-indigo-400 dark:border-indigo-600 z-10 group-hover:scale-110 transition-transform"></div>
                            
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow relative">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs text-slate-400 font-medium font-mono">
                                        {formatDate(entry.createdAt, locale)}
                                    </span>
                                    <button 
                                        onClick={() => setEntryToDelete(entry.id)}
                                        className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                {/* Added break-all class here for long number wrapping */}
                                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed break-all">
                                    {entry.content}
                                </div>
                                {entry.images && entry.images.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {entry.images.map((img, i) => (
                                            <div 
                                                key={i} 
                                                className="relative h-20 w-20 cursor-zoom-in rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:ring-2 ring-indigo-500/50 transition-all"
                                                onClick={() => setZoomedImage(img)}
                                            >
                                                <img 
                                                    src={img} 
                                                    alt="Attachment" 
                                                    className="w-full h-full object-cover" 
                                                    loading="lazy"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog 
        isOpen={!!entryToDelete}
        title={t.delete}
        message={t.confirmDeleteEntry}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        onConfirm={handleDeleteEntryConfirm}
        onCancel={() => setEntryToDelete(null)}
        isDestructive
      />
      
      {/* Unsaved Changes Dialog */}
      <ConfirmDialog 
        isOpen={showDiscardConfirm}
        title={t.discardTitle}
        message={t.discardMessage}
        confirmLabel={t.saveAndExit}
        cancelLabel={t.discardAndExit}
        onConfirm={handleSave}
        onCancel={onCancel}
        onClose={() => setShowDiscardConfirm(false)}
      />

      {/* Validation Alert (Empty Title) */}
      <ConfirmDialog
        isOpen={showValidationAlert}
        title={t.alertTitle}
        message={t.titleRequired}
        confirmLabel={t.ok}
        onConfirm={() => setShowValidationAlert(false)}
        onCancel={() => setShowValidationAlert(false)}
      />

      <ImageModal 
        isOpen={!!zoomedImage}
        imageUrl={zoomedImage}
        onClose={() => setZoomedImage(null)}
      />
    </div>
  );
};