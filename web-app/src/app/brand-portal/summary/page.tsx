"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchReportData } from '@/lib/reporting';
import ExcelExportButton from '@/components/ExcelExportButton';
import styles from './index.css';

export const dynamic = 'force-dynamic';

const SummaryPage = () => {
  const { id: campaignId } = useParams();
  const [loading, setLoading] = useState(true);
  const [totalSold, setTotalSold] = useState(0);
  const [topSkus, setTopSkus] = useState<Array<{ sku: string; gmv: number; thumbnail: string }>>([]);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    if (!campaignId) return;
    const load = async () => {
      setLoading(true);
      const data = await fetchReportData(campaignId as string);
      setTotalSold(data.totalSold);
      setTopSkus(data.topSkus);
      setReportData(data);
      setLoading(false);
    };
    load();
  }, [campaignId]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Campaign Summary</h1>
        <ExcelExportButton campaignId={campaignId as string} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Items Sold Card */}
        <div className="glass-card p-4">
          <h2 className="text-xl font-medium mb-2">Total Items Sold</h2>
          <p className="text-4xl font-semibold text-primary">{totalSold}</p>
        </div>
        {/* Top 5 SKU Insight */}
        <div className="glass-card p-4">
          <h2 className="text-xl font-medium mb-2">Top 5 SKUs by GMV</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {topSkus.map((sku) => (
              <div key={sku.sku} className="flex items-center gap-3">
                <img src={sku.thumbnail} alt={sku.sku} className="w-12 h-12 rounded" />
                <div>
                  <p className="font-medium">{sku.sku}</p>
                  <p className="text-sm text-gray-500">GMV: ${sku.gmv.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Tabs for detailed sheets */}
      <div className="mt-8">
        <Tabs data={reportData} />
      </div>
    </div>
  );
};

export default SummaryPage;

// Simple Tabs component – renders each sheet as a collapsible table
const Tabs = ({ data }: { data: any }) => {
  const sections = [
    { title: 'Creators', rows: data.creators },
    { title: 'Videos', rows: data.videos },
    { title: 'Samples', rows: data.samples },
    { title: 'Receipts', rows: data.receipts },
  ];

  const [active, setActive] = useState(sections[0].title);

  return (
    <div>
      <ul className="flex border-b mb-4">
        {sections.map((sec) => (
          <li
            key={sec.title}
            className={`mr-4 pb-2 cursor-pointer ${active === sec.title ? 'border-b-2 border-primary' : ''}`}
            onClick={() => setActive(sec.title)}
          >
            {sec.title}
          </li>
        ))}
      </ul>
      <div>
        {sections
          .filter((sec) => sec.title === active)
          .map((sec) => (
            <table key={sec.title} className="min-w-full table-auto">
              <thead className="bg-gray-100">
                <tr>
                  {sec.rows.length > 0 && Object.keys(sec.rows[0]).map((col) => (
                    <th key={col} className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sec.rows.map((row: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    {Object.values(row).map((val, i) => (
                      <td key={i} className="px-4 py-2 text-sm text-gray-800">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>
    </div>
  );
};
