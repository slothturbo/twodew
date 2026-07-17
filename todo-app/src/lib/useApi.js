import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Enhanced API hooks with error handling for Supabase operations
 * Includes localhost monitoring and debugging capabilities
 */
export function useTodos() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchTodos();
  }, []);

  async function fetchTodos() {
    try {
      setLoading(true);
      // Try to load from localStorage first for offline support
      const localData = localStorage.getItem("twodew-todos");
      if (localData) {
        setTodos(JSON.parse(localData));
      }
      
      // Then fetch from Supabase if available
      try {
        const response = await fetch("/api/todos");
        if (response.ok) {
          const data = await response.json();
          setTodos(data);
          localStorage.setItem("twodew-todos", JSON.stringify(data));
        }
      } catch (e) {
        console.warn("Supabase not available, using local storage:", e.message);
      }
    } catch (err) {
      setError(err.message || "Failed to load todos");
    } finally {
      setLoading(false);
    }
  }

  const addTodo = useCallback(async (todo) => {
    try {
      const newTodo = { ...todo, id: crypto.randomUUID(), createdAt: Date.now() };
      setTodos(prev => [...prev, newTodo]);
      
      // Save locally immediately for responsive UI
      localStorage.setItem("twodew-todos", JSON.stringify([...todos, newTodo]));

      try {
        await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTodo)
        });
      } catch (e) {
        console.warn("Failed to sync with server:", e.message);
      }
      
      return newTodo;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [todos]);

  const removeTodo = useCallback(async (id) => {
    try {
      setTodos(prev => prev.filter(t => t.id !== id));
      localStorage.setItem("twodew-todos", JSON.stringify(todos.filter(t => t.id !== id)));
      
      try {
        await fetch(`/api/todos/${id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("Failed to delete from server:", e.message);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [todos]);

  return { todos, loading, error, addTodo, removeTodo };
}

/**
 * Custom hook for managing component mount/unmount lifecycle with cleanup
 */
export function useIsMounted() {
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef.current;
}

/**
 * Hook for debounced values (useful for search/filter inputs)
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for handling async operations with proper cleanup
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (asyncFn) => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFn();
      return result;
    } catch (err) {
      setError(err.message || "An error occurred");
      throw err;
    } finally {
      if (!useIsMounted()) return; // Only set state if still mounted
      setLoading(false);
    }
  }, []);

  return { execute, loading, error };
}
