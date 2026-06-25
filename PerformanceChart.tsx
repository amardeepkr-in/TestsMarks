'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PerformanceChartProps {
  data: Array<{ category: string; avg: number; min: number; max: number; count: number }>;
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} />
        <YAxis dataKey="category" type="category" width={150} />
        <Tooltip />
        <Legend />
        <Bar dataKey="min" fill="#FF6B6B" name="Minimum" />
        <Bar dataKey="avg" fill="#4ECDC4" name="Average" />
        <Bar dataKey="max" fill="#51CF66" name="Maximum" />
      </BarChart>
    </ResponsiveContainer>
  );
}


