'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface MarksBarChartProps {
  data: Array<{ range: string; count: number }>;
}

export default function MarksBarChart({ data }: MarksBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available
      </div>
    );
  }

  // Color code bars: red for fail ranges (0-39), green for pass ranges (40+)
  const getBarColor = (range: string) => {
    const minValue = parseInt(range.split('-')[0]);
    return minValue < 40 ? '#FF6B6B' : '#51CF66';
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" name="Number of Students">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}


