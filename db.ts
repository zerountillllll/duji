import { Book } from './types';

const DB_NAME = 'NovelLogDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

export const db = {
  open: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  },

  getAllBooks: async (): Promise<Book[]> => {
    const dbInstance = await db.open();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  saveBook: async (book: Book): Promise<void> => {
    const dbInstance = await db.open();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(book);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  deleteBook: async (id: string): Promise<void> => {
    const dbInstance = await db.open();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // For batch operations or full imports
  saveAllBooks: async (books: Book[]): Promise<void> => {
    const dbInstance = await db.open();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      books.forEach(book => {
        store.put(book);
      });
    });
  },

  clearAll: async (): Promise<void> => {
    const dbInstance = await db.open();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
  }
};
