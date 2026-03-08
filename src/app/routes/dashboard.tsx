/**
 * Dashboard Page
 * 
 * Main overview with stats, recent activity, and quick actions.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Package,
  AlertCircle,
  ArrowRight,
  DollarSign,
  ShoppingBag,
} from 'lucide-react';

// Mock data - in production, this would come from API
const mockStats = {
  activeListings: 1247,
  soldThisWeek: 23,
  soldThisMonth: 87,
  pendingDispatch: 12,
  syncErrors: 3,
  weeklyRevenue: 4238.50,
};

const mockRecentActivity = [
  { id: '1', type: 'listed', sku: 'CJP-RNG-2603-0042', platform: 'ebay', title: '14K Gold Diamond Ring', time: '5 min ago' },
  { id: '2', type: 'sold', sku: 'CJP-NKL-2603-0038', platform: 'etsy', title: 'Sterling Silver Pendant Necklace', time: '12 min ago' },
  { id: '3', type: 'created', sku: 'CJP-BRD-2603-0128', platform: null, title: 'Vintage Pearl Bracelet', time: '23 min ago' },
  { id: '4', type: 'error', sku: 'CJP-ERG-2603-0007', platform: 'shopify', title: 'Gold Hoop Earrings', error: 'API rate limit', time: '1 hour ago' },
  { id: '5', type: 'ended', sku: 'CJP-WTC-2603-0003', platform: 'ebay', title: 'Vintage Seiko Watch', time: '2 hours ago' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[--text-primary]">Dashboard</h1>
          <p className="text-sm text-[--text-secondary] mt-1">Welcome back! Here's your store overview.</p>
        </div>
        <Link
          to="/new-listing"
          className="btn-primary"
        >
          <PlusCircle className="h-4 w-4" />
          New Listing
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Listings"
          value={mockStats.activeListings.toLocaleString()}
          icon={Package}
          trend="+12 this week"
          trendUp={true}
        />
        <StatCard
          label="Sold This Week"
          value={mockStats.soldThisWeek.toString()}
          icon={ShoppingBag}
          subValue={`$${mockStats.weeklyRevenue.toLocaleString()}`}
          trend="+5 from last week"
          trendUp={true}
        />
        <StatCard
          label="Pending Dispatch"
          value={mockStats.pendingDispatch.toString()}
          icon={AlertCircle}
          className="text-[--accent-warning]"
        />
        <StatCard
          label="Sync Errors"
          value={mockStats.syncErrors.toString()}
          icon={AlertCircle}
          className="text-[--accent-error]"
          action={{ label: 'View', href: '/inventory?status=error' }}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent activity */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-[--border]">
              <h2 className="font-medium text-[--text-primary]">Recent Activity</h2>
              <Link to="/inventory" className="text-sm text-[--accent-primary] hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-[--border]/50">
              {mockRecentActivity.map((activity) => (
                <ActivityItem key={activity.id} {...activity} type={activity.type as 'error' | 'created' | 'listed' | 'sold' | 'ended'} />
              ))}
            </div>
          </div>
        </div>

        {/* Quick add */}
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="font-medium text-[--text-primary] mb-4">Quick Add</h2>
            <QuickAddForm />
          </div>

          {/* Platform status */}
          <div className="card p-4">
            <h2 className="font-medium text-[--text-primary] mb-4">Platform Status</h2>
            <div className="space-y-2">
              <PlatformStatusItem platform="eBay" status="connected" listings={523} />
              <PlatformStatusItem platform="Etsy" status="connected" listings={312} />
              <PlatformStatusItem platform="Shopify" status="connected" listings={412} />
              <PlatformStatusItem platform="Mercari" status="disconnected" listings={0} />
              <PlatformStatusItem platform="Poshmark" status="disconnected" listings={0} />
            </div>
            <Link
              to="/platforms"
              className="mt-4 block text-center text-sm text-[--accent-primary] hover:underline"
            >
              Manage platforms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card component
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  subValue?: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  action?: { label: string; href: string };
}

function StatCard({ label, value, icon: Icon, subValue, trend, trendUp, className, action }: StatCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg bg-[--bg-elevated] ${className}`}>
          <Icon className="h-5 w-5 text-[--text-secondary]" />
        </div>
        {action && (
          <Link to={action.href} className="text-xs text-[--accent-primary] hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold text-[--text-primary]">{value}</p>
      {subValue && <p className="text-sm text-[--text-secondary]">{subValue}</p>}
      <p className="mt-1 text-xs text-[--text-muted]">{label}</p>
      {trend && (
        <p className={`mt-2 text-xs ${trendUp ? 'text-[--accent-success]' : 'text-[--accent-error]'}`}>
          {trend}
        </p>
      )}
    </div>
  );
}

// Activity item component
interface ActivityItemProps {
  type: 'listed' | 'sold' | 'created' | 'ended' | 'error';
  sku: string;
  platform: string | null;
  title: string;
  error?: string;
  time: string;
}

function ActivityItem({ type, sku, platform, title, error, time }: ActivityItemProps) {
  const typeConfig = {
    listed: { icon: Package, color: 'text-[--accent-success]', label: 'Listed' },
    sold: { icon: DollarSign, color: 'text-[--accent-primary]', label: 'Sold' },
    created: { icon: PlusCircle, color: 'text-[--text-secondary]', label: 'Created' },
    ended: { icon: Package, color: 'text-[--text-muted]', label: 'Ended' },
    error: { icon: AlertCircle, color: 'text-[--accent-error]', label: 'Error' },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-4 hover:bg-[--bg-hover]/30 transition-colors">
      <div className={`p-2 rounded-lg bg-[--bg-elevated] ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[--text-primary] truncate">{title}</span>
          {platform && (
            <span className="badge bg-[--bg-elevated] text-[--text-muted] text-xs">
              {platform}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[--text-muted]">{sku}</span>
          {error && <span className="text-xs text-[--accent-error]">• {error}</span>}
        </div>
      </div>
      <span className="text-xs text-[--text-muted] whitespace-nowrap">{time}</span>
    </div>
  );
}

// Platform status item
interface PlatformStatusItemProps {
  platform: string;
  status: 'connected' | 'disconnected' | 'error';
  listings: number;
}

function PlatformStatusItem({ platform, status, listings }: PlatformStatusItemProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-[--accent-success]' : 'bg-[--text-muted]'}`} />
        <span className="text-sm text-[--text-primary]">{platform}</span>
      </div>
      <span className="text-sm text-[--text-muted]">{listings} listings</span>
    </div>
  );
}

// Quick add form (simplified)
function QuickAddForm() {
  const [text, setText] = React.useState('');

  return (
    <form className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText((e.target as HTMLTextAreaElement).value)}
        placeholder="Describe your item... (e.g., '14K gold diamond ring, size 7, 0.5ct center stone')"
        className="input min-h-[100px] text-sm"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-[--text-muted]">AI will extract details automatically</p>
        <Link
          to="/new-listing"
          className="btn-primary text-sm py-1.5"
        >
          Create Listing
        </Link>
      </div>
    </form>
  );
}
