import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LogoutPage } from '@/pages/LogoutPage';
import { ChatPage } from '@/pages/ChatPage';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRouter() {
  console.log('AppRouter: Rendering');
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={<ChatPage />}
        />
        {/* Redirects for old admin routes */}
        <Route path="/admin/documents" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/users" element={<Navigate to="/users" replace />} />
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        {/* Root redirect - only redirect exact "/" path, not subroutes */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        {/* Catch-all for unknown routes - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

