import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { AppRouter } from '@/routes/AppRouter';

function App() {
  return (
    <AuthProvider>
      <PermissionsProvider>
        <AppRouter />
      </PermissionsProvider>
    </AuthProvider>
  );
}

export default App;

