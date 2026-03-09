/**
 * Dashboard — Overview & Analytics
 * Main landing page showing listings, stats, recent activity
 */

import { useState, useEffect } from 'react';

interface ListingStats {
	total: number;
	draft: number;
	enriching: number;
	ready: number;
	published: number;
	live: number;
	error: number;
}

interface PlatformStats {
	platform: string;
	published: number;
	views: number;
	sales: number;
}

export default function Dashboard() {
	const [stats, setStats] = useState<ListingStats>({
		total: 0,
		draft: 0,
		enriching: 0,
		ready: 0,
		published: 0,
		live: 0,
		error: 0,
	});

	const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
	const [recentActivity, setRecentActivity] = useState<any[]>([]);

	useEffect(() => {
		fetchDashboardData();
	}, []);

	const fetchDashboardData = async () => {
		try {
			const response = await fetch('/api/dashboard/stats');
			if (response.ok) {
				const data = await response.json() as any;
				setStats(data.data?.listing_stats || stats);
				setPlatformStats(data.data?.platform_stats || []);
				setRecentActivity(data.data?.recent_activity || []);
			}
		} catch (err) {
			console.error('Failed to fetch dashboard data:', err);
		}
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
					<p className="text-slate-600 mt-1">Jewelry Store Listing Automation</p>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
				<StatCard label="Total" value={stats.total} color="slate" />
				<StatCard label="Draft" value={stats.draft} color="slate" />
				<StatCard label="Enriching" value={stats.enriching} color="amber" />
				<StatCard label="Ready" value={stats.ready} color="blue" />
				<StatCard label="Published" value={stats.published} color="green" />
				<StatCard label="Live" value={stats.live} color="emerald" />
				<StatCard label="Error" value={stats.error} color="red" />
			</div>

			{/* Chart Placeholders */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Status Distribution */}
				<div className="bg-white rounded-lg border border-slate-200 p-6">
					<h2 className="text-lg font-semibold text-slate-900 mb-4">Status Distribution</h2>
					<div className="h-72 bg-slate-100 rounded flex items-center justify-center">
						<p className="text-slate-600">Chart coming soon</p>
					</div>
				</div>

				{/* Platform Performance */}
				<div className="bg-white rounded-lg border border-slate-200 p-6">
					<h2 className="text-lg font-semibold text-slate-900 mb-4">Platform Performance</h2>
					<div className="h-72 bg-slate-100 rounded flex items-center justify-center">
						<p className="text-slate-600">Chart coming soon</p>
					</div>
				</div>
			</div>

			{/* Recent Activity */}
			<div className="bg-white rounded-lg border border-slate-200 p-6">
				<h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
				<div className="space-y-3">
					{recentActivity.length === 0 ? (
						<p className="text-slate-600">No recent activity</p>
					) : (
						recentActivity.map((activity, idx) => (
							<div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
								<div>
									<p className="font-medium text-slate-900">{activity.title}</p>
									<p className="text-sm text-slate-600">{activity.description}</p>
								</div>
								<span className="text-xs text-slate-500">{activity.timestamp}</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
	const colorMap = {
		slate: 'bg-slate-100 text-slate-900',
		amber: 'bg-amber-100 text-amber-900',
		blue: 'bg-blue-100 text-blue-900',
		green: 'bg-green-100 text-green-900',
		emerald: 'bg-emerald-100 text-emerald-900',
		red: 'bg-red-100 text-red-900',
	};

	return (
		<div className={`rounded-lg p-4 ${colorMap[color as keyof typeof colorMap]}`}>
			<p className="text-xs font-medium opacity-75">{label}</p>
			<p className="text-2xl font-bold mt-1">{value}</p>
		</div>
	);
}
