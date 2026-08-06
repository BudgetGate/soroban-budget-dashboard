import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';

const mockData = [
  { commit: 'a1b2c3d', cpu: 1000, memory: 500, read: 200, write: 100 },
  { commit: 'b2c3d4e', cpu: 1050, memory: 500, read: 200, write: 100 },
  { commit: 'c3d4e5f', cpu: 1100, memory: 550, read: 210, write: 100 },
  { commit: 'd4e5f6g', cpu: 1600, memory: 600, read: 210, write: 120 }, // Regression
  { commit: 'e5f6g7h', cpu: 1200, memory: 550, read: 200, write: 100 }, // Fix
];

function App() {
  const [data] = useState(mockData);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <header className="mb-10 flex items-center justify-between border-b border-slate-700 pb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold tracking-tight text-white">BudgetGate Dashboard</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Testnet Sync Active
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-slate-400 font-medium text-sm">Latest Commit</h3>
            <p className="text-2xl font-semibold mt-2 font-mono">e5f6g7h</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex items-center justify-between">
            <div>
              <h3 className="text-slate-400 font-medium text-sm">Regression Status</h3>
              <p className="text-2xl font-semibold text-emerald-400 mt-2">Clear</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 opacity-20" />
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-slate-400 font-medium text-sm">Functions Tracked</h3>
            <p className="text-2xl font-semibold mt-2">12 Active</p>
          </div>
        </div>

        {/* Charts */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">CPU Instructions History</h2>
            <p className="text-slate-400 text-sm mt-1">Resource cost per invocation over recent commits</p>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="commit" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Line type="monotone" dataKey="cpu" name="CPU Instructions" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
