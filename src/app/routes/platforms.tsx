/**
 * Platforms Page
 * 
 * Platform connections and OAuth management.
 */

import { CheckCircle2, XCircle, Settings } from 'lucide-react';

// Platform data
const PLATFORMS = [
  { id: 'ebay', name: 'eBay', color: '#E53238', integrationType: 'CSV', connected: true, listings: 523 },
  { id: 'shopify', name: 'Shopify', color: '#96BF48', integrationType: 'API', connected: true, listings: 412 },
  { id: 'etsy', name: 'Etsy', color: '#F1641E', integrationType: 'API', connected: true, listings: 312 },
  { id: 'facebook', name: 'Facebook Marketplace', color: '#1877F2', integrationType: 'API', connected: false, listings: 0 },
  { id: 'pinterest', name: 'Pinterest', color: '#E60023', integrationType: 'API', connected: false, listings: 0 },
  { id: 'whatnot', name: 'Whatnot', color: '#FF6B35', integrationType: 'Browser', connected: false, listings: 0 },
  { id: 'instagram', name: 'Instagram Shop', color: '#E4405F', integrationType: 'Browser', connected: false, listings: 0 },
  { id: 'depop', name: 'Depop', color: '#FF2300', integrationType: 'Browser', connected: false, listings: 0 },
  { id: 'mercari', name: 'Mercari', color: '#00A0E9', integrationType: 'Browser', connected: false, listings: 0 },
  { id: 'poshmark', name: 'Poshmark', color: '#7B2FBE', integrationType: 'Browser', connected: false, listings: 0 },
];

export default function Platforms() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Platforms</h1>
        <p className="text-sm text-[--text-secondary] mt-1">Connect and manage your marketplace integrations</p>
      </div>

      {/* Integration types legend */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[--accent-success]" />
          <span className="text-sm text-[--text-muted]">API — Automatic sync</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[--accent-warning]" />
          <span className="text-sm text-[--text-muted]">CSV — Manual upload</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[--accent-primary]" />
          <span className="text-sm text-[--text-muted]">Browser — Semi-automated</span>
        </div>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATFORMS.map((platform) => (
          <div key={platform.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${platform.color}20` }}
                >
                  <div
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                </div>
                <div>
                  <h3 className="font-medium text-[--text-primary]">{platform.name}</h3>
                  <span className={`text-xs ${
                    platform.integrationType === 'API' ? 'text-[--accent-success]' :
                    platform.integrationType === 'CSV' ? 'text-[--accent-warning]' :
                    'text-[--accent-primary]'
                  }`}>
                    {platform.integrationType}
                  </span>
                </div>
              </div>
              {platform.connected ? (
                <CheckCircle2 className="h-5 w-5 text-[--accent-success]" />
              ) : (
                <XCircle className="h-5 w-5 text-[--text-muted]" />
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-[--text-muted]">
                {platform.listings > 0 ? `${platform.listings} listings` : 'No listings'}
              </span>
              {platform.connected ? (
                <div className="flex items-center gap-2">
                  <button className="btn-ghost text-xs">
                    <Settings className="h-3 w-3" />
                  </button>
                  <button className="btn-secondary text-xs py-1">
                    Sync
                  </button>
                </div>
              ) : (
                <button className="btn-primary text-xs py-1">
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
