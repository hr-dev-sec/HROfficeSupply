/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { SupplyHubProvider } from './context/SupplyHubContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AssistantPage } from './pages/AssistantPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ForecastPage } from './pages/ForecastPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { MasterItemsPage } from './pages/MasterItemsPage';
import { OpnamePage } from './pages/OpnamePage';
import { OverheadInventoryPage } from './pages/OverheadInventoryPage';
import { PublicRequestPage } from './pages/PublicRequestPage';
import { ReportsPage } from './pages/ReportsPage';
import { RequestsPage } from './pages/RequestsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SignaturesPage } from './pages/SignaturesPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { VerifyReportPage } from './pages/VerifyReportPage';
import type { UserRole } from './types';

const RoleGuard: React.FC<{ roles?: UserRole[]; children: React.ReactNode }> = ({
  roles,
  children,
}) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app/reports" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <SupplyHubProvider>
            <AuthProvider>
              <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/pengambilan" element={<PublicRequestPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/verifikasi/:id" element={<VerifyReportPage />} />

                <Route path="/app" element={<AppShell />}>
                  <Route index element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route
                    path="items"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <MasterItemsPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="transactions"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <TransactionsPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="opname"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <OpnamePage />
                      </RoleGuard>
                    }
                  />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route
                    path="documents"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <DocumentsPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="signatures"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <SignaturesPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="inventory"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <OverheadInventoryPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="requests"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <RequestsPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="forecast"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <ForecastPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="assistant"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <AssistantPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="audit"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <AuditLogPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <RoleGuard roles={['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER']}>
                        <SettingsPage />
                      </RoleGuard>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </BrowserRouter>
            </AuthProvider>
          </SupplyHubProvider>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
