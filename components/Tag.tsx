import React from 'react';

interface TagProps {
  label: string;
  onClick?: () => void;
  onDelete?: () => void;
  active?: boolean;
  prefix?: string;
}

export const Tag: React.FC<TagProps> = ({ label, onClick, onDelete, active, prefix = '#' }) => {
  return (
    <span 
      onClick={onClick}
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 mb-2 cursor-pointer transition-colors border
        ${active 
          ? 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-700' 
          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'}
      `}
    >
      {prefix}{label}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
        >
          &times;
        </button>
      )}
    </span>
  );
};