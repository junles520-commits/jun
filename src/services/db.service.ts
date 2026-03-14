
import { Injectable } from '@angular/core';
import { KlinePoint } from './models';

export interface CachedETFData {
  code: string;
  history: KlinePoint[];
  lastUpdated: number; // Timestamp
}

export interface ApiCacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiry: number;
}

@Injectable({
  providedIn: 'root'
})
export class DbService {
  private dbName = 'ETF_Alpha_DB';
  private storeName = 'kline_history';
  private cacheStoreName = 'api_cache'; // New store for generic API cache
  private version = 2; // Increment version
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject('Database error');
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'code' });
        }
        // Create cache store
        if (!db.objectStoreNames.contains(this.cacheStoreName)) {
          db.createObjectStore(this.cacheStoreName, { keyPath: 'key' });
        }
      };
    });
  }

  // --- ETF History Methods ---

  async getETF(code: string): Promise<CachedETFData | undefined> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(code);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveETF(data: CachedETFData): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Generic API Cache Methods ---

  async getCache(key: string): Promise<any | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.cacheStoreName], 'readonly');
      const store = transaction.objectStore(this.cacheStoreName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as ApiCacheEntry;
        if (result && result.expiry > Date.now()) {
          resolve(result.data);
        } else {
          if (result) {
             // Clean up expired
             this.deleteCache(key); 
          }
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setCache(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.cacheStoreName], 'readwrite');
      const store = transaction.objectStore(this.cacheStoreName);
      const entry: ApiCacheEntry = {
        key,
        data,
        timestamp: Date.now(),
        expiry: Date.now() + (ttlSeconds * 1000)
      };
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCache(key: string): Promise<void> {
     const db = await this.dbPromise;
     const transaction = db.transaction([this.cacheStoreName], 'readwrite');
     const store = transaction.objectStore(this.cacheStoreName);
     store.delete(key);
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
