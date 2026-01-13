import React from 'react';
import { Book, Language } from '../types';
import { getHighlightedText, formatRelativeTime } from '../utils';
import { Star } from 'lucide-react';
import { Translation } from '../i18n';

interface BookCardProps {
  note: Book;
  searchQuery: string;
  onClick: (book: Book) => void;
  onTagClick: (tag: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  t: Translation;
  locale: string;
  language: Language;
}

export const NoteCard: React.FC<BookCardProps> = ({ 
  note: book, 
  searchQuery, 
  onClick, 
  onTagClick,
  isSelected,
  onSelect,
  selectionMode,
  t,
  language
}) => {
  
  const renderHighlight = (text: string) => {
    if (!searchQuery) return text;
    const parts = getHighlightedText(text, searchQuery);
    return Array.isArray(parts) 
      ? parts.map((part, i) => 
          part.toLowerCase() === searchQuery.toLowerCase() 
            ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-slate-900 dark:text-white rounded px-0.5">{part}</mark> 
            : part
        )
      : text;
  };

  // Get latest entry content for preview
  const latestEntry = book.entries.length > 0 ? book.entries[0] : null;
  const previewText = latestEntry ? latestEntry.content : '';

  return (
    <div 
      className={`
        relative group p-4 rounded-xl border transition-all duration-200 bg-white dark:bg-slate-800
        ${isSelected 
          ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10' 
          : 'border-slate-100 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-slate-600 shadow-sm hover:shadow-md'}
      `}
      onClick={() => selectionMode && onSelect ? onSelect(book.id) : onClick(book)}
    >
      {/* Row 1: Title & Rating */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate leading-snug flex-1 mr-2">
          {renderHighlight(book.title)}
        </h3>
        {book.rating > 0 && (
          <div className={`
            flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0
            ${book.rating >= 80 ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 
              book.rating >= 60 ? 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' :
              'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'}
          `}>
            <Star size={10} className="mr-0.5 fill-current" />
            {book.rating}
          </div>
        )}
      </div>

      {/* Row 2: Metadata (Protagonists + Tags) Compact */}
      {(book.protagonists.length > 0 || book.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2.5 text-xs text-slate-500 dark:text-slate-400 leading-normal">
          {/* Protagonists */}
          {book.protagonists.length > 0 && (
            <span className="font-medium text-slate-700 dark:text-slate-300">
               {book.protagonists.map((p, i) => (
                 <span key={i}>
                   {renderHighlight(p)}{i < book.protagonists.length - 1 ? '、' : ''}
                 </span>
               ))}
            </span>
          )}
          
          {/* Vertical Separator if both exist */}
          {book.protagonists.length > 0 && book.tags.length > 0 && (
             <span className="text-slate-300 dark:text-slate-600">|</span>
          )}

          {/* Tags */}
          {book.tags.map(tag => (
              <span 
                key={tag}
                onClick={(e) => {
                  if (selectionMode) return;
                  e && e.stopPropagation(); 
                  onTagClick(tag);
                }}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
              >
                #{tag}
              </span>
          ))}
        </div>
      )}

      {/* Row 3: Preview Content */}
      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed tracking-wide opacity-90">
        {previewText ? renderHighlight(previewText.substring(0, 150)) : <span className="italic text-slate-300 dark:text-slate-600">{t.noContent}</span>}
      </p>

      {/* Row 4: Footer (Entry Count & Date) - Pure Text, No Icons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-700/50 text-[10px] text-slate-400">
         <span>
           {t.entryCount(book.entries.length)}
         </span>
         <span>
           {formatRelativeTime(book.updatedAt, language)}
         </span>
      </div>

      {selectionMode && (
        <div className={`
          absolute top-4 left-[-12px] -translate-x-full h-full flex items-start
        `}>
           <input 
            type="checkbox" 
            checked={isSelected}
            readOnly
            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </div>
      )}
    </div>
  );
};