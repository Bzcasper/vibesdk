/**
 * App Layout Component
 * 
 * Main layout wrapper with sidebar navigation.
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Package,
  FileSpreadsheet,
  Store,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'New Listing', href: '/new-listing', icon: PlusCircle },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'CSV Batches', href: '/csv-batches', icon: FileSpreadsheet },
  { name: 'Platforms', href: '/platforms', icon: Store },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[--bg-base]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[--bg-surface] border-r border-[--border]
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[--border]">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[--accent-primary] to-[--accent-shopify]" />
            <span className="font-semibold text-[--text-primary]">Caspers Jewelry</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-[--text-muted] hover:text-[--text-primary]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                  transition-colors
                  ${isActive
                    ? 'bg-[--accent-primary]/10 text-[--accent-primary]'
                    : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-[--border] p-3">
          <div className="rounded-lg bg-[--bg-elevated] p-3">
            <p className="text-xs text-[--text-muted]">Quick Tip</p>
            <p className="mt-1 text-sm text-[--text-secondary]">
              Press <kbd className="rounded bg-[--bg-base] px-1.5 py-0.5 text-xs">N</kbd> to create a new listing
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-[--border] bg-[--bg-base]/80 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between px-4">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-[--text-muted] hover:text-[--text-primary]"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Search */}
              <div className="hidden md:flex items-center gap-2 rounded-lg bg-[--bg-surface] px-3 py-1.5 border border-[--border]">
                <Search className="h-4 w-4 text-[--text-muted]" />
                <input
                  type="text"
                  placeholder="Search listings... (⌘K)"
                  className="bg-transparent text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none w-64"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <button className="relative p-2 text-[--text-muted] hover:text-[--text-primary]">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[--accent-error]" />
              </button>

              {/* User menu */}
              <button className="flex items-center gap-2 rounded-lg bg-[--bg-surface] px-3 py-1.5 border border-[--border] hover:bg-[--bg-hover]">
                <div className="h-6 w-6 rounded-full bg-[--accent-primary]" />
                <span className="text-sm text-[--text-primary] hidden sm:inline">Admin</span>
                <ChevronDown className="h-4 w-4 text-[--text-muted]" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
