import { useState, useEffect } from 'react';

export function useDraftLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage.
  const setValueWrapped = (valueToStore: T | ((val: T) => T)) => {
    try {
      const valueToSave = valueToStore instanceof Function ? valueToStore(value) : valueToStore;
      setValue(valueToSave);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToSave));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  const clearDraft = () => {
    try {
      setValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error clearing localStorage key "${key}":`, error);
    }
  };

  return [value, setValueWrapped, clearDraft] as const;
}
