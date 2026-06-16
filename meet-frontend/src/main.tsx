import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { authApi } from './services/api';
import { useAuthStore } from './store/authStore';
import './index.css';

function AppRoot() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const state = useAuthStore.getState();
    if (state.token && state.isAuthenticated) {
      useAuthStore.setState({ initialized: true });
      return;
    }

    void authApi.refresh()
      .then((res) => {
        useAuthStore.setState({
          user: res.data.user,
          token: res.data.token,
          isAuthenticated: true,
          initialized: true,
        });
      })
      .catch(() => {
        useAuthStore.setState({ user: null, token: null, isAuthenticated: false, initialized: true });
      });
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster 
        position="top-center"
        containerStyle={{ top: 'max(8px, env(safe-area-inset-top, 8px))' }}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#fff',
            borderRadius: '12px',
          },
          success: { 
            duration: 3000,
            iconTheme: { primary: '#10b981', secondary: '#fff' }
          },
          error: { 
            duration: 5000,
            iconTheme: { primary: '#ef4444', secondary: '#fff' }
          },
        }}
      />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);

// Auto-reload when a stale chunk fails to load (new deploy while app is open)
window.addEventListener('error', (e) => {
  if (e.message?.includes('Failed to fetch dynamically imported module') && !sessionStorage.getItem('__reloaded')) {
    sessionStorage.setItem('__reloaded', '1');
    window.location.reload();
  }
});
