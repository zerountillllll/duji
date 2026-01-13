import React from 'react';
import { Book, ImportConflict } from '../types';
import { Button } from './Button';
import { Translation } from '../i18n';
import { formatDate, countBookWords } from '../utils';

interface ImportDialogProps {
  conflicts: ImportConflict[];
  onResolve: (resolutions: { [key: string]: 'skip' | 'overwrite' }) => void;
  onCancel: () => void;
  t: Translation;
  locale: string;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ conflicts, onResolve, onCancel, t, locale }) => {
  const [decisions, setDecisions] = React.useState<{ [key: string]: 'skip' | 'overwrite' }>({});
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const currentConflict = conflicts[currentIndex];

  const handleDecision = (decision: 'skip' | 'overwrite') => {
    const newDecisions = { ...decisions, [currentConflict.incoming.id]: decision }; 
    
    setDecisions(newDecisions);
    
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onResolve(newDecisions);
    }
  };

  if (!currentConflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t.importConflict} ({currentIndex + 1}/{conflicts.length})</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t.conflictMsg(currentConflict.existing.title)}
          </p>

          <div className="space-y-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-xs uppercase font-bold text-slate-400">{t.existingNote}</span>
              <div className="text-sm font-medium mt-1">{t.updated}: {formatDate(currentConflict.existing.updatedAt, locale)}</div>
              <div className="text-sm text-slate-500">{t.statsWords}: {countBookWords(currentConflict.existing)}</div>
            </div>
            
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <span className="text-xs uppercase font-bold text-indigo-400">{t.incomingNote}</span>
              <div className="text-sm font-medium mt-1">{t.updated}: {formatDate(currentConflict.incoming.updatedAt, locale)}</div>
              <div className="text-sm text-slate-500">{t.statsWords}: {countBookWords(currentConflict.incoming)}</div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onCancel} className="flex-1">{t.cancelImport}</Button>
            <Button variant="secondary" onClick={() => handleDecision('skip')} className="flex-1">{t.skip}</Button>
            <Button variant="primary" onClick={() => handleDecision('overwrite')} className="flex-1">{t.overwrite}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};