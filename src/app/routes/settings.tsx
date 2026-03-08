/**
 * Settings Page
 * 
 * Application settings and configuration.
 */

import { useState } from 'react';
import { Save, Globe, Package } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    storeName: 'Caspers Jewelry',
    defaultCurrency: 'USD',
    defaultMarketplace: 'EBAY_US',
    dispatchDays: '2',
    returnDays: '30',
    autoEndOnSold: true,
    aiConfidenceThreshold: '0.7',
  });

  const handleChange = (key: string, value: string | boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">Settings</h1>
        <p className="text-sm text-[--text-secondary] mt-1">Configure your store preferences</p>
      </div>

      {/* General Settings */}
      <div className="card">
        <div className="p-4 border-b border-[--border]">
          <h2 className="font-medium text-[--text-primary] flex items-center gap-2">
            <Globe className="h-4 w-4" />
            General
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[--text-primary] mb-1">
              Store Name
            </label>
            <input
              type="text"
              value={settings.storeName}
              onChange={(e) => handleChange('storeName', (e.target as HTMLInputElement).value)}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[--text-primary] mb-1">
                Default Currency
              </label>
              <select
                  value={settings.defaultCurrency}
                  onChange={(e) => handleChange('defaultCurrency', (e.target as HTMLSelectElement).value)}
                  className="input"
                >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[--text-primary] mb-1">
                Default Marketplace
              </label>
              <select
                value={settings.defaultMarketplace}
                onChange={(e) => handleChange('defaultMarketplace', (e.target as HTMLSelectElement).value)}
                className="input"
              >
                <option value="EBAY_US">eBay US</option>
                <option value="EBAY_UK">eBay UK</option>
                <option value="EBAY_DE">eBay Germany</option>
                <option value="EBAY_AU">eBay Australia</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Shipping & Returns */}
      <div className="card">
        <div className="p-4 border-b border-[--border]">
          <h2 className="font-medium text-[--text-primary] flex items-center gap-2">
            <Package className="h-4 w-4" />
            Shipping & Returns
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[--text-primary] mb-1">
                Dispatch Time (days)
              </label>
              <input
                type="number"
                value={settings.dispatchDays}
                onChange={(e) => handleChange('dispatchDays', (e.target as HTMLInputElement).value)}
                className="input"
                min="1"
                max="30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--text-primary] mb-1">
                Return Window (days)
              </label>
              <input
                type="number"
                value={settings.returnDays}
                onChange={(e) => handleChange('returnDays', (e.target as HTMLInputElement).value)}
                className="input"
                min="0"
                max="60"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Automation */}
      <div className="card">
        <div className="p-4 border-b border-[--border]">
          <h2 className="font-medium text-[--text-primary] flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Automation
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-[--text-primary]">
                Auto-end on Sold
              </label>
              <p className="text-xs text-[--text-muted]">
                Automatically end listings on other platforms when sold
              </p>
            </div>
            <button
              onClick={() => handleChange('autoEndOnSold', !settings.autoEndOnSold)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.autoEndOnSold ? 'bg-[--accent-primary]' : 'bg-[--bg-elevated]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.autoEndOnSold ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-[--text-primary] mb-1">
              AI Confidence Threshold
            </label>
            <input
              type="range"
              value={settings.aiConfidenceThreshold}
              onChange={(e) => handleChange('aiConfidenceThreshold', (e.target as HTMLInputElement).value)}
              className="w-full"
              min="0.5"
              max="1"
              step="0.1"
            />
            <p className="text-xs text-[--text-muted] mt-1">
              Minimum confidence for AI-suggested values ({Math.round(Number(settings.aiConfidenceThreshold) * 100)}%)
            </p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button className="btn-primary">
          <Save className="h-4 w-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}
