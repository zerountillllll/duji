import { Book, LegacyNote, Entry } from './types';
import { translations } from './i18n';

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const formatDate = (timestamp: number, locale: string = 'en-US'): string => {
  return new Date(timestamp).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatRelativeTime = (timestamp: number, language: 'en' | 'zh'): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const t = translations[language];

  const isToday = now.getDate() === date.getDate() && 
                  now.getMonth() === date.getMonth() && 
                  now.getFullYear() === date.getFullYear();

  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (isToday) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${t.timeToday} ${hours}:${minutes}`;
  }

  if (diffDays === 1) {
    return t.timeYesterday;
  }

  if (diffDays === 2) {
    return t.timeBeforeYesterday;
  }

  if (diffDays > 2 && diffDays <= 7) {
    return `${diffDays} ${t.timeDaysAgo}`;
  }

  if (diffDays > 365) {
    const years = Math.floor(diffDays / 365);
    return `${years} ${t.timeYearsAgo}`;
  }

  // > 7 days and < 1 year: Show Month-Day
  return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric'
  });
};

// Helper to count words across all entries in a book
export const countBookWords = (book: Book): number => {
  return book.entries.reduce((acc, entry) => acc + countWords(entry.content), 0);
};

export const countWords = (text: string): number => {
  if (!text) return 0;
  const clean = text.trim();
  const matches = clean.match(/[\w\d\’\'-]+|[\u4E00-\u9FFF]/gi);
  return matches ? matches.length : 0;
};

// Helper to highlight text based on query
export const getHighlightedText = (text: string, highlight: string) => {
  if (!highlight.trim()) {
    return text;
  }
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return parts; 
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const filterBooks = (books: Book[], query: string, activeTag: string | null): Book[] => {
  let filtered = books;

  if (activeTag) {
    filtered = filtered.filter(b => b.tags.includes(activeTag));
  }

  if (query.trim()) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter(b => 
      b.title.toLowerCase().includes(lowerQuery) ||
      b.protagonists.some(p => p.toLowerCase().includes(lowerQuery)) ||
      b.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
      b.entries.some(e => e.content.toLowerCase().includes(lowerQuery))
    );
  }

  return filtered;
};

// Migration function to convert old Notes to Books with Entries and Array Protagonists
export const migrateNotesToBooks = (data: any[]): Book[] => {
  if (!Array.isArray(data)) return [];
  
  return data.map((item: LegacyNote) => {
    // 1. Handle Entries Migration
    let entries = item.entries || [];
    if (!item.entries && (item.content || (item.images && item.images.length > 0))) {
      entries = [{
        id: generateId(),
        content: item.content || '',
        images: item.images || [],
        createdAt: item.updatedAt || Date.now()
      }];
    }

    // 2. Handle Protagonist Migration (String -> Array)
    let protagonists: string[] = [];
    if (item.protagonists && Array.isArray(item.protagonists)) {
      protagonists = item.protagonists;
    } else if (item.protagonist) {
      protagonists = [item.protagonist];
    }

    return {
      id: item.id,
      title: item.title,
      protagonists: protagonists,
      rating: item.rating || 0,
      tags: item.tags || [],
      entries: entries,
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now()
    };
  });
};