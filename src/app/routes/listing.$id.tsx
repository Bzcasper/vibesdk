/**
 * Listing Detail Page
 * 
 * Full listing editor with media studio and dispatch control panel.
 */

import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, ExternalLink } from 'lucide-react';

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();

  // Mock data - would come from API
  const listing = {
    id,
    sku: 'CJP-RNG-2603-0042',
    status: 'listed',
    title: '14K Gold Diamond Ring Size 7 Excellent Condition',
    category: 'Ring',
    condition: 'Excellent',
    price: 299.99,
    platforms: [
      { name: 'ebay', status: 'listed', externalId: '123456789', url: 'https://ebay.com/itm/123456789' },
      { name: 'etsy', status: 'listed', externalId: '987654321', url: 'https://etsy.com/listing/987654321' },
      { name: 'shopify', status: 'pending', externalId: null, url: null },
    ],
    images: ['/placeholder-1.jpg', '/placeholder-2.jpg', '/placeholder-3.jpg'],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/inventory" className="p-2 rounded-lg hover:bg-[--bg-hover]">
            <ArrowLeft className="h-5 w-5 text-[--text-muted]" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[--text-primary]">{listing.title}</h1>
            <p className="text-sm text-[--text-muted]">{listing.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary">
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
          <button className="btn-ghost text-[--accent-error]">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Images */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <h2 className="font-medium text-[--text-primary] mb-4">Media Studio</h2>
            <div className="grid grid-cols-2 gap-2">
              {listing.images.map((_img, i) => (
                <div key={i} className="aspect-square rounded-lg bg-[--bg-elevated] flex items-center justify-center">
                  <span className="text-[--text-muted]">Image {i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle column: Details */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <h2 className="font-medium text-[--text-primary] mb-4">Listing Details</h2>
            <div className="space-y-3">
              <DetailRow label="Category" value={listing.category} />
              <DetailRow label="Condition" value={listing.condition} />
              <DetailRow label="Price" value={`$${listing.price}`} />
              <DetailRow label="Status" value={listing.status} />
            </div>
          </div>
        </div>

        {/* Right column: Dispatch */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="p-4 border-b border-[--border]">
              <h2 className="font-medium text-[--text-primary]">Dispatch Control</h2>
            </div>
            <div className="p-4 space-y-3">
              {listing.platforms.map((platform) => (
                <PlatformCard key={platform.name} {...platform} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[--border]/50 last:border-0">
      <span className="text-sm text-[--text-muted]">{label}</span>
      <span className="text-sm text-[--text-primary]">{value}</span>
    </div>
  );
}

function PlatformCard({ name, status, externalId, url }: {
  name: string;
  status: string;
  externalId: string | null;
  url: string | null;
}) {
  return (
    <div className="p-3 rounded-lg bg-[--bg-elevated] border border-[--border]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[--accent-success]" />
          <span className="text-sm font-medium text-[--text-primary] capitalize">{name}</span>
        </div>
        <span className="badge bg-[--accent-success]/20 text-[--accent-success] text-xs capitalize">
          {status}
        </span>
      </div>
      {externalId && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[--text-muted]">ID: {externalId}</span>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-[--accent-primary]">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
