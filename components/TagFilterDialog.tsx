import React from 'react';
import { Button } from './Button';
import { Translation } from '../i18n';
import { X, Check } from 'lucide-react';

interface TagFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allTags: string[];
  selectedTags: Set<string>;
  onApply: (tags: Set<string>) => void;
  t: Translation;
}

export const TagFilterDialog: React.FC<TagFilterDialogProps> = ({
  isOpen,
  onClose,
  allTags,
  selectedTags,
  onApply,
  t
}) => {
  const [tempSelected, setTempSelected] = React.useState<Set<string>>(new Set(selectedTags));

  React.useEffect(() => {
    if (isOpen) {
      setTempSelected(new Set(selectedTags));
    }
  }, [isOpen, selectedTags]);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    const newSet = new Set(tempSelected);
    if (newSet.has(tag)) {
      newSet.delete(tag);
    } else {
      newSet.add(tag);
    }
    setTempSelected(newSet);
  };

  const handleReset = () => {
    setTempSelected(new Set());
  };

  const handleConfirm = () => {
    onApply(tempSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full flex flex-col max-h-[80vh] border border-slate-200 dark:border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-lg">{t.selectTags}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {allTags.length === 0 ? (
             <div className="text-center text-slate-400 py-8 italic">{t.noNotes}</div>
          ) : (
             <div className="flex flex-wrap gap-2">
                {allTags.map(tag => {
                    const isSelected = tempSelected.has(tag);
                    return (
                        <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 ${
                                isSelected 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                           {tag}
                           {isSelected && <Check size={14} />}
                        </button>
                    );
                })}
             </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <Button variant="ghost" onClick={handleReset} className="flex-1">{t.reset}</Button>
          <Button onClick={handleConfirm} className="flex-1">{t.confirm} ({tempSelected.size})</Button>
        </div>
      </div>
    </div>
  );
};