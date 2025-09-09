'use client';

import { useState } from 'react';
import { useLazyQuery, useQuery, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

/**
 * Renders a UI for generating and downloading tenant-scoped custom reports.
 *
 * The component lets a signed-in user pick a start date, end date, and one or more data points,
 * then generate a report via a Convex lazy query and optionally download the result as a CSV
 * via a Convex action. It guards operations if there is no authenticated user or tenantId.
 *
 * Behavior:
 * - Maintains local state for start/end dates, selected data points, generated report data, and a loading flag.
 * - Calls `api.reports.generate` (lazy query) to fetch report data and displays the results in a simple table.
 * - Calls `api.reports.generateCsv` (action) to obtain a CSV string, creates a Blob, and triggers a browser download named `report.csv`.
 *
 * UI notes:
 * - Inputs: Start Date, End Date (date inputs), and a multi-select for data points (defaults to `['revenue', 'booking_count']`).
 * - "Generate Report" button is disabled while a report is being generated and shows a loading state.
 * - When report data is present, column headers are derived from the report object's keys; a single-row summary of values is shown.
 *
 * @returns A React element that renders the reports UI.
 */
export default function Reports() {
  const user = useQuery(api.users.me);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dataPoints, setDataPoints] = useState<string[]>(['revenue', 'booking_count']);
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateReport = useLazyQuery(api.reports.generate);
  const generateCsv = useAction(api.reports.generateCsv);

  const handleGenerateReport = async () => {
    if (!user || !user.tenantId) return;

    setIsLoading(true);
    const result = await generateReport({
      tenantId: user.tenantId,
      startDate,
      endDate,
      filters: {},
      dataPoints,
    });
    setReportData(result);
    setIsLoading(false);
  };

  const handleDownloadCsv = async () => {
    if (!user || !user.tenantId) return;

    const csv = await generateCsv({
      tenantId: user.tenantId,
      startDate,
      endDate,
      filters: {},
      dataPoints,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'report.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Custom Reports</h2>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">Data Points</label>
          <select
            multiple
            value={dataPoints}
            onChange={(e) => setDataPoints(Array.from(e.target.selectedOptions, (option) => option.value))}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          >
            <option value="revenue">Revenue</option>
            <option value="booking_count">Booking Count</option>
          </select>
        </div>
      </div>
      <button
        onClick={handleGenerateReport}
        className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-blue-300"
        disabled={isLoading}
      >
        {isLoading ? 'Generating...' : 'Generate Report'}
      </button>

      {isLoading && <div className="mt-8 text-center">Loading...</div>}

      {!isLoading && reportData && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-2">Report Results</h3>
          {Object.keys(reportData).length > 0 ? (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(reportData).map((key) => (
                      <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    {Object.values(reportData).map((value, index) => (
                      <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {value}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <button
                onClick={handleDownloadCsv}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md"
              >
                Download CSV
              </button>
            </>
          ) : (
            <p>No data found for the selected criteria.</p>
          )}
        </div>
      )}
    </div>
  );
}
