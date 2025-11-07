import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LogoutPage } from '@/pages/LogoutPage';
import { ChatPage } from '@/pages/ChatPage';
import { SharedConversationPage } from '@/pages/SharedConversationPage';
import { ContactPage } from '@/pages/ContactPage';
import { TermsPage } from '@/pages/TermsPage';
import { DisclaimerDeclinedPage } from '@/pages/DisclaimerDeclinedPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';

export function AppRouter() {
  console.log('AppRouter: Rendering');
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route
          path="/dashboard"
          element={
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/owners"
          element={
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
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
        {/* Redirects for old admin routes */}
        <Route path="/admin/documents" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/users" element={<Navigate to="/users" replace />} />
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        {/* Chat page - React version (migration in progress) */}
        <Route
          path="/chat"
          element={<ChatPage />}
        />
        {/* Shared conversation page - public access */}
        <Route
          path="/shared/:shareToken"
          element={<SharedConversationPage />}
        />
        {/* Contact page - public access */}
        <Route
          path="/contact"
          element={<ContactPage />}
        />
        {/* Terms of Service page - public access */}
        <Route
          path="/terms"
          element={<TermsPage />}
        />
        {/* Disclaimer Declined page - public access */}
        <Route
          path="/disclaimer-declined"
          element={<DisclaimerDeclinedPage />}
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

