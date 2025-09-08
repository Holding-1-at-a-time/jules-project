'use client';

import { useState } from 'react';
import { useLazyQuery, useQuery, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

export default function Reports() {
  const user = useQuery(api.users.me);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [dataPoints, setDataPoints] = useState<string[]>(['revenue', 'booking_count']);
  const [reportData, setReportData] = useState<any>(null);

  const generateReport = useLazyQuery(api.reports.generate);
  const generateCsv = useAction(api.reports.generateCsv);

  const handleGenerateReport = async () => {
    if (!user || !user.tenantId) return;

    const result = await generateReport({
      tenantId: user.tenantId,
      startDate,
      endDate,
      filters: {
        // simplified for now
      },
      dataPoints,
    });
    setReportData(result);
  };

  const handleDownloadCsv = async () => {
    if (!user || !user.tenantId) return;

    const csv = await generateCsv({
      tenantId: user.tenantId,
      startDate,
      endDate,
      filters: {
        // simplified for now
      },
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
    <div>
      <h2>Custom Reports</h2>
      <div>
        <label>
          Start Date:
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          End Date:
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>
      <div>
        <label>
          Data Points:
          <select multiple value={dataPoints} onChange={(e) => setDataPoints(Array.from(e.target.selectedOptions, (option) => option.value))}>
            <option value="revenue">Revenue</option>
            <option value="booking_count">Booking Count</option>
          </select>
        </label>
      </div>
      <button onClick={handleGenerateReport}>Generate Report</button>

      {reportData && (
        <div className="mt-8">
          <h3>Report Results</h3>
          <table>
            <thead>
              <tr>
                {Object.keys(reportData).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {Object.values(reportData).map((value, index) => (
                  <td key={index}>{value}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <button onClick={handleDownloadCsv} className="mt-4">
            Download CSV
          </button>
        </div>
      )}
    </div>
  );
}
