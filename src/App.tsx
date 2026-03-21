import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProjectList from './components/ProjectList';
import ProjectForm from './components/ProjectForm';
import RewardManagement from './pages/RewardManagement';
import CommentManagement from './pages/CommentManagement';
import PaymentManagement from './pages/PaymentManagement';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ProjectList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/new"
              element={
                <ProtectedRoute>
                  <ProjectForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/edit"
              element={
                <ProtectedRoute>
                  <ProjectForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/rewards"
              element={
                <ProtectedRoute>
                  <RewardManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/comments"
              element={
                <ProtectedRoute>
                  <CommentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id/payments"
              element={
                <ProtectedRoute>
                  <PaymentManagement />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;