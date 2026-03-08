/**
 * CSV Batches Page
 * 
 * eBay File Exchange CSV batch management.
 */

import { Link } from 'react-router-dom';
import { FileSpreadsheet, Download, Trash2, PlusCircle } from 'lucide-react';

// Mock data
const mockBatches = [
  { id: '1', name: 'March 7 Upload', status: 'completed', listingCount: 24, createdAt: '2026-03-07T10:30:00Z' },
  { id: '2', name: 'March 6 Upload', status: 'completed', listingCount: 18, createdAt: '2026-03-06T14:20:00Z' },
  { id: '3', name: 'March 5 Upload', status: 'error', listingCount: 12, error: 'eBay API timeout', createdAt: '2026-03-05T09:15:00Z' },
  { id: '4', name: 'March 4 Upload', status: 'ready', listingCount: 30, createdAt: '2026-03-04T16:45:00Z' },
];

export default function CsvBatches() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[--text-primary]">CSV Batches</h1>
          <p className="text-sm text-[--text-secondary] mt-1">eBay File Exchange batch uploads</p>
        </div>
        <Link to="/inventory" className="btn-primary">
          <PlusCircle className="h-4 w-4" />
          Create Batch
        </Link>
      </div>

      {/* Instructions */}
      <div className="card p-4 bg-[--bg-elevated]">
        <h3 className="font-medium text-[--text-primary] mb-2">How to Upload to eBay</h3>
        <ol className="text-sm text-[--text-secondary] space-y-1 list-decimal list-inside">
          <li>Select listings from Inventory and click "Create CSV Batch"</li>
          <li>Download the generated CSV file</li>
          <li>Go to eBay File Exchange and upload the CSV</li>
          <li>Check this page for upload confirmation</li>
        </ol>
      </div>

      {/* Batch list */}
      <div className="space-y-3">
        {mockBatches.map((batch) => (
          <div key={batch.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  batch.status === 'completed' ? 'bg-[--accent-success]/10' :
                  batch.status === 'error' ? 'bg-[--accent-error]/10' :
                  batch.status === 'ready' ? 'bg-[--accent-warning]/10' :
                  'bg-[--bg-elevated]'
                }`}>
                  <FileSpreadsheet className={`h-5 w-5 ${
                    batch.status === 'completed' ? 'text-[--accent-success]' :
                    batch.status === 'error' ? 'text-[--accent-error]' :
                    batch.status === 'ready' ? 'text-[--accent-warning]' :
                    'text-[--text-muted]'
                  }`} />
                </div>
                <div>
                  <h3 className="font-medium text-[--text-primary]">{batch.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-[--text-muted]">{batch.listingCount} listings</span>
                    <span className="text-sm text-[--text-muted]">
                      {new Date(batch.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {batch.error && (
                    <p className="text-sm text-[--accent-error] mt-1">{batch.error}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {batch.status === 'ready' && (
                  <button className="btn-secondary text-sm">
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                )}
                {batch.status === 'error' && (
                  <button className="btn-secondary text-sm">
                    <svg className="h-4 w-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </button>
                )}
                <button className="btn-ghost text-[--text-muted]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
