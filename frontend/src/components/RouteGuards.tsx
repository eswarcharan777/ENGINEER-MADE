import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageLoading } from './RouteStates';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading label="Restoring your learning session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading label="Verifying administrator access…" />;
  if (!user) return <Navigate to="/admin-access" replace state={{ from: location }} />;
  if (!isAdmin) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
