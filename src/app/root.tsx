/**
 * App Root Component
 * 
 * Main layout wrapper with routing.
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages (lazy loaded)
const Dashboard = React.lazy(() => import('./routes/Dashboard'));
const NewListing = React.lazy(() => import('./routes/NewListing'));
const ListingDetail = React.lazy(() => import('./routes/listing.$id'));
const Inventory = React.lazy(() => import('./routes/Inventory'));
const CsvBatches = React.lazy(() => import('./routes/csv-batches'));
const Platforms = React.lazy(() => import('./routes/platforms'));
const Settings = React.lazy(() => import('./routes/settings'));

// Loading fallback
function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-[#8890A4]">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-listing" element={<NewListing />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/csv-batches" element={<CsvBatches />} />
          <Route path="/platforms" element={<Platforms />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}
