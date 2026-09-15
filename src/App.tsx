import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, CheckCircle2, AlertTriangle, Settings, RefreshCw } from 'lucide-react';
import { fetchSnapshotHistory } from './api';
import type { SnapshotHistory } from './api';

function App() {
  const [history, setHistory] = useState<SnapshotHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<string>('all');
  const [dataSourceUrl, setDataSourceUrl] = useState<string>('');
  const [tempUrl, setTempUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    fetchSnapshotHistory(dataSourceUrl)
      .then(data => {
        if (isMounted) {
          setHistory(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { isMounted = false };
  }, [dataSourceUrl]);

  const handleApplyUrl = () => {
    setDataSourceUrl(tempUrl);
  };

  const allFunctions = useMemo(() => {
    if (!history) return [];
    const funcs = new Set<string>();
    history.snapshots.forEach(s => s.functions.forEach(f => funcs.add(f.name)));
    return Array.from(funcs);
  }, [history]);

  const chartData = useMemo(() => {
    if (!history) return [];
    return history.snapshots.map(snapshot => {
      const point: any = { commit: snapshot.commit_sha.substring(0, 7) };
      
      if (selectedFunction === 'all') {
        // Aggregate totals for 'all' view
        let totalCpu = 0;
        let totalMem = 0;
        snapshot.functions.forEach(f => {
          totalCpu += f.cpu_instructions;
          totalMem += f.memory_bytes;
        });
        point.cpu = totalCpu;
        point.memory = totalMem;
      } else {
        // Drill down for specific function
        const fn = snapshot.functions.find(f => f.name === selectedFunction);
        if (fn) {
          point.cpu = fn.cpu_instructions;
          point.memory = fn.memory_bytes;
        } else {
          point.cpu = 0;
          point.memory = 0;
        }
      }
      return point;
    });
  }, [history, selectedFunction]);

  const latestSnapshot = history?.snapshots[history.snapshots.length - 1];
  const previousSnapshot = history?.snapshots[history.snapshots.length - 2];
  
  // Calculate if there's a regression (e.g., CPU increased by more than 10%)
  const regressionStatus = useMemo(() => {
    if (!latestSnapshot || !previousSnapshot) return 'Clear';
    let hasRegression = false;
    latestSnapshot.functions.forEach(f => {
      const prevF = previousSnapshot.functions.find(pf => pf.name === f.name);
      if (prevF && f.cpu_instructions > prevF.cpu_instructions * 1.1) {
        hasRegression = true;
      }
    });
    return hasRegression ? 'Regression Detected' : 'Clear';
  }, [latestSnapshot, previousSnapshot]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <header className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-700 pb-6 gap-4">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold tracking-tight text-white">BudgetGate Dashboard</h1>
        </div>
        <div className="flex items-center gap-4 text-sm w-full md:w-auto">
          <div className="flex bg-slate-800 rounded-lg overflow-hidden border border-slate-700 w-full md:w-80">
            <input 
              type="text" 
              placeholder="Data Source URL (leave empty for demo)" 
              className="bg-transparent px-4 py-2 outline-none text-sm w-full text-slate-300"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
            />
            <button onClick={handleApplyUrl} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 transition-colors flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <span className="hidden md:flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Testnet Sync Active
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-4" />
            <p>Loading snapshot history...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 text-center text-red-200">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-red-400" />
            <h2 className="text-lg font-semibold mb-2">Error Fetching Data</h2>
            <p>{error}</p>
          </div>
        ) : !history || history.snapshots.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center text-slate-400">
            <Settings className="w-10 h-10 mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-semibold text-slate-300 mb-2">No Data Available</h2>
            <p>Please check your data source URL.</p>
          </div>
        ) : (
          <>
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col justify-center">
                <h3 className="text-slate-400 font-medium text-sm">Latest Commit</h3>
                <p className="text-2xl font-semibold mt-2 font-mono text-white">{latestSnapshot?.commit_sha.substring(0, 7)}</p>
                <p className="text-xs text-slate-500 mt-1">Generated: {new Date(latestSnapshot?.generated_at || '').toLocaleDateString()}</p>
              </div>
              <div className={`bg-slate-800 border rounded-xl p-6 flex items-center justify-between ${regressionStatus === 'Clear' ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                <div>
                  <h3 className="text-slate-400 font-medium text-sm">Regression Status</h3>
                  <p className={`text-2xl font-semibold mt-2 ${regressionStatus === 'Clear' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {regressionStatus}
                  </p>
                </div>
                {regressionStatus === 'Clear' ? (
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 opacity-20" />
                ) : (
                  <AlertTriangle className="w-12 h-12 text-red-400 opacity-20" />
                )}
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col justify-center">
                <h3 className="text-slate-400 font-medium text-sm">Functions Tracked</h3>
                <p className="text-2xl font-semibold mt-2 text-white">{allFunctions.length} Active</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Resource Consumption Trends</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    {selectedFunction === 'all' ? 'Aggregate resource cost across all functions' : `Resource cost for function: ${selectedFunction}`}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <label htmlFor="function-select" className="text-sm text-slate-400 whitespace-nowrap">Filter by:</label>
                  <select 
                    id="function-select"
                    value={selectedFunction} 
                    onChange={(e) => setSelectedFunction(e.target.value)}
                    className="bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
                  >
                    <option value="all">All Functions (Aggregate)</option>
                    {allFunctions.map(fn => (
                      <option key={fn} value={fn}>{fn}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="p-6 pt-8 bg-slate-800/50">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="commit" stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickMargin={10} />
                      <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickFormatter={(value) => `${value.toLocaleString()}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        formatter={(value: any) => Number(value).toLocaleString()}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line 
                        type="monotone" 
                        dataKey="cpu" 
                        name="CPU Instructions" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        dot={{ r: 4, strokeWidth: 2 }} 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="memory" 
                        name="Memory (Bytes)" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={{ r: 4, strokeWidth: 2 }} 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#34d399' }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
