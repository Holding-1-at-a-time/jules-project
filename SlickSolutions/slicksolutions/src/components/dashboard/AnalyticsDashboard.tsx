'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface AnalyticsDashboardProps {
  detailerId: Id<'detailers'>;
}

export default function AnalyticsDashboard({ detailerId }: AnalyticsDashboardProps) {
  const analyticsData = useQuery(api.analytics.getDetailerAnalytics, { detailerId });

  if (!analyticsData) {
    return <p>Loading analytics...</p>;
  }

  const { totalAssessments, totalRevenue, averageRating, assessmentsByMonth, revenueByMonth } = analyticsData;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Analytics Dashboard</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Assessments</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{totalAssessments}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Average Rating</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{averageRating.toFixed(1)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Revenue by Month</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">Assessments by Month</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={assessmentsByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#82ca9d" name="Assessments" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
