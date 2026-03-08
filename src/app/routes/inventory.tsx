/**
 * Inventory Page
 * 
 * Full inventory table with filters and bulk actions.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download, PlusCircle } from 'lucide-react';

// Mock data
const mockListings = [
  { id: '1', sku: 'CJP-RNG-2603-0042', title: '14K Gold Diamond Ring', status: 'listed', price: 299.99, platforms: ['ebay', 'etsy'], category: 'Ring' },
  { id: '2', sku: 'CJP-NKL-2603-0038', title: 'Sterling Silver Pendant', status: 'ready', price: 89.99, platforms: [], category: 'Necklace' },
  { id: '3', sku: 'CJP-BRD-2603-0128', title: 'Vintage Pearl Bracelet', status: 'processing', price: 149.99, platforms: ['ebay'], category: 'Bracelet' },
  { id: '4', sku: 'CJP-ERG-2603-0007', title: 'Gold Hoop Earrings', status: 'draft', price: 199.99, platforms: [], category: 'Earring' },
  { id: '5', sku: 'CJP-WTC-2603-0003', title: 'Vintage Seiko Watch', status: 'sold', price: 349.99, platforms: ['ebay', 'mercari'], category: 'Watch' },
];

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[--text-primary]">Inventory</h1>
          <p className="text-sm text-[--text-secondary] mt-1">Manage all your listings</p>
        </div>
        <Link to="/new-listing" className="btn-primary">
          <PlusCircle className="h-4 w-4" />
          New Listing
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
          <input
            type="text"
            placeholder="Search by title, SKU, or brand..."
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            className="input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
          className="input w-40"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="processing">Processing</option>
          <option value="ready">Ready</option>
          <option value="listed">Listed</option>
          <option value="sold">Sold</option>
        </select>
        <button className="btn-secondary">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Bulk actions */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-[--accent-primary]/10 border border-[--accent-primary]/30">
          <span className="text-sm text-[--text-primary]">{selectedRows.length} selected</span>
          <button className="btn-ghost text-sm">Publish Selected</button>
          <button className="btn-ghost text-sm text-[--accent-error]">Delete Selected</button>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if ((e.target as HTMLInputElement).checked) {
                      setSelectedRows(mockListings.map((l) => l.id));
                    } else {
                      setSelectedRows([]);
                    }
                  }}
                  className="rounded"
                />
              </th>
              <th>SKU</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Price</th>
              <th>Platforms</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {mockListings.map((listing) => (
              <tr key={listing.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(listing.id)}
                    onChange={(e) => {
                      if ((e.target as HTMLInputElement).checked) {
                        setSelectedRows([...selectedRows, listing.id]);
                      } else {
                        setSelectedRows(selectedRows.filter((id) => id !== listing.id));
                      }
                    }}
                    className="rounded"
                  />
                </td>
                <td className="font-mono text-xs">{listing.sku}</td>
                <td>
                  <Link to={`/listing/${listing.id}`} className="text-[--text-primary] hover:text-[--accent-primary]">
                    {listing.title}
                  </Link>
                </td>
                <td className="text-[--text-secondary]">{listing.category}</td>
                <td>
                  <StatusBadge status={listing.status} />
                </td>
                <td className="text-[--text-primary]">${listing.price}</td>
                <td>
                  <div className="flex gap-1">
                    {listing.platforms.map((p) => (
                      <span key={p} className="badge bg-[--bg-elevated] text-[--text-muted] text-xs">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <button className="p-1 rounded hover:bg-[--bg-hover]">
                    <svg className="h-4 w-4 text-[--text-muted]" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-[--text-muted]/20 text-[--text-muted]',
    processing: 'bg-[--accent-primary]/20 text-[--accent-primary]',
    ready: 'bg-[--accent-warning]/20 text-[--accent-warning]',
    listed: 'bg-[--accent-success]/20 text-[--accent-success]',
    sold: 'bg-[--accent-error]/20 text-[--accent-error]',
  };

  return (
    <span className={`badge ${colors[status] || colors['draft']}`}>
      {status}
    </span>
  );
}
