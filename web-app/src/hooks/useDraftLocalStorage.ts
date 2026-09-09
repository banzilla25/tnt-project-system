import { useState, useEffect } from 'react';

export function useDraftLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          setValue(JSON.parse(item));
        }
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
      }
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage.
  const setValueWrapped = (valueToStore: T | ((val: T) => T)) => {
    setValue((current) => {
      try {
        const valueToSave = valueToStore instanceof Function ? valueToStore(current) : valueToStore;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToSave));
        }
        return valueToSave;
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
        return current;
      }
    });
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
