export interface Entry {
  id: string;
  content: string;
  images: string[];
  createdAt: number;
}

export interface Book {
  id: string;
  title: string;
  protagonists: string[]; // Changed from protagonist: string to array
  rating: number; // 0-100
  tags: string[];
  entries: Entry[]; 
  createdAt: number;
  updatedAt: number;
}

// Legacy type for migration
export interface LegacyNote {
  id: string;
  title: string;
  protagonist?: string; // Old field
  protagonists?: string[]; // New field
  rating: number;
  tags: string[];
  content?: string;
  images?: string[];
  createdAt: number;
  updatedAt: number;
  entries?: Entry[];
}

export type SortField = 'createdAt' | 'updatedAt' | 'rating';
export type Language = 'en' | 'zh';

export interface ImportConflict {
  existing: Book;
  incoming: Book;
}

export interface Stats {
  totalBooks: number;
  totalWords: number;
}