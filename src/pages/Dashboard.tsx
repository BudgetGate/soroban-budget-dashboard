import { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, CheckCircle2, AlertTriangle, Settings, RefreshCw, Zap, Server, Database, ChevronDown, Terminal, Play, X, Info, BookOpen, Clock } from 'lucide-react';
import { fetchSnapshotHistory, RateLimitError } from '../api';
import type { SnapshotHistory, Snapshot } from '../api';
import { toChartPoints } from '../metrics';
import MetricChart from '../components/MetricChart';
import '../App.css';

function Dashboard() {
  const [history, setHistory] = useState<SnapshotHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<string>('all');
  const [dataSourceUrl, setDataSourceUrl] = useState<string>('');
  const [tempUrl, setTempUrl] = useState<string>('');

  // Demo Terminal State
  const [showDemoTerminal, setShowDemoTerminal] = useState(false);
  const [demoLogs, setDemoLogs] = useState<string[]>([]);
  const [demoInProgress, setDemoInProgress] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [demoLogs]);

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
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => { isMounted = false };
  }, [dataSourceUrl]);

  const handleApplyUrl = () => {
    setDataSourceUrl(tempUrl);
  };

  const runDemoTest = () => {
    setShowDemoTerminal(true);
    setDemoInProgress(true);
    setDemoLogs([]);

    const sequence = [
      "> budget-core simulate --fixture \"liquidity_pool_v2\"",
      "> Initializing Soroban environment [v2.1.0]...",
      "> Compiling smart contracts to WASM...",
      "> [OK] target/wasm32-unknown-unknown/release/liquidity_pool.wasm",
      "> Running execution trace on 145 transactions...",
      "> Analyzing CPU instructions and Memory footprint...",
      "> ⚠️ WARNING: Resource utilization spike detected in `swap` function",
      "> Comparing with baseline commit...",
      "> CPU usage +25%, Memory usage +15% over baseline",
      "> Pushing regression snapshot to dashboard state...",
      "> DONE"
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < sequence.length) {
        setDemoLogs(prev => [...prev, sequence[i]]);
        i++;
      } else {
        clearInterval(interval);
        setDemoInProgress(false);

        // Inject fake snapshot
        if (history) {
          const newSnapshot: Snapshot = {
            schema_version: '1.0',
            network: 'testnet',
            commit_sha: 'd3m0b4d' + Math.floor(Math.random()*1000).toString(),
            generated_at: new Date().toISOString(),
            functions: (history.snapshots[history.snapshots.length - 1]?.functions || []).map(f => {
              // Increase cpu and mem
              return {
                ...f,
                cpu_instructions: Math.floor(f.cpu_instructions * 1.25),
                memory_bytes: f.memory_bytes === null ? null : Math.floor(f.memory_bytes * 1.15)
              };
            })
          };
          setHistory({
            ...history,
            snapshots: [...history.snapshots, newSnapshot]
          });
        }
      }
    }, 600);
  };

  const allFunctions = useMemo(() => {
    if (!history) return [];
    const funcs = new Set<string>();
    history.snapshots.forEach(s => s.functions.forEach(f => funcs.add(f.name)));
    return Array.from(funcs);
  }, [history]);

  const chartData = useMemo(
    () => (history ? toChartPoints(history.snapshots, selectedFunction) : []),
    [history, selectedFunction]
  );

  const latestSnapshot = history?.snapshots[history.snapshots.length - 1];
  const previousSnapshot = history?.snapshots[history.snapshots.length - 2];
  
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
    <div className="min-h-screen p-4 md:p-8 relative z-10 selection:bg-[#00ff9d] selection:text-black">
      
      {/* Demo Terminal Modal */}

      {showDemoTerminal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-2xl rounded-none border border-[#00ff9d]/50 shadow-[0_0_30px_rgba(0,255,157,0.2)] flex flex-col h-[500px]">
            <div className="border-b border-[#00ff9d]/30 bg-[#00ff9d]/10 p-3 flex justify-between items-center">
              <div className="flex items-center gap-2 text-[#00ff9d] font-bold text-sm tracking-widest">
                <Terminal className="w-4 h-4" />
                SYSTEM_EXEC::BUDGET_SIMULATION
              </div>
              {!demoInProgress && (
                <button onClick={() => setShowDemoTerminal(false)} className="text-[#00ff9d] hover:text-[#ff0080] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="p-4 flex-1 overflow-y-auto text-[#00ff9d] font-mono text-sm leading-relaxed">
              {demoLogs.map((log, idx) => (
                <div key={idx} className={`${log.includes('WARNING') ? 'text-[#ff0080]' : ''} mb-2`}>
                  {log}
                </div>
              ))}
              {demoInProgress && (
                <div className="mt-2">
                  <span className="terminal-cursor"></span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      <header className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between pb-6 gap-6 glass-panel p-6 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-[#00ff9d]/10 p-3 border border-[#00ff9d]/30 shadow-[0_0_15px_rgba(0,255,157,0.3)]">
            <Activity className="w-8 h-8 text-[#00ff9d]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-widest text-[#00ff9d] uppercase" style={{ textShadow: '0 0 10px rgba(0,255,157,0.5)' }}>SYS.BudgetGate</h1>
            <p className="text-xs text-[#00ff9d]/70 font-mono tracking-widest uppercase mt-1">Soroban Resource Monitor_v2.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm w-full md:w-auto relative z-10 flex-wrap">
          <a 
            href="https://budgetgate.github.io/docs/dashboard/"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-button px-4 py-3 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4" />
            READ DOCS
          </a>
          
          <button 
            onClick={runDemoTest}
            className="glass-button-pink px-4 py-3 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            RUN DEMO BUDGET TEST
          </button>

          <div className="flex overflow-hidden glass-input w-full md:w-64 shadow-inner">
            <input 
              type="text" 
              placeholder="DATASOURCE_URL" 
              className="bg-transparent px-4 py-3 outline-none text-xs w-full text-[#00ff9d] placeholder:text-[#00ff9d]/30 font-mono"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
            />
            <button 
              onClick={handleApplyUrl} 
              className="glass-button px-4 py-3 flex items-center justify-center font-medium border-l border-[#00ff9d]/40"
              aria-label="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <span className="hidden lg:flex items-center gap-2 bg-[#00ff9d]/10 text-[#00ff9d] px-4 py-3 border border-[#00ff9d]/30 whitespace-nowrap font-mono text-xs shadow-[0_0_10px_rgba(0,255,157,0.1)] uppercase">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full bg-[#00ff9d] opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 bg-[#00ff9d]"></span>
            </span>
            TESTNET_SYNC_ACTIVE
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8 relative z-10 font-mono">
        {loading ? (
          <div className="glass-panel flex flex-col items-center justify-center h-80 text-[#00ff9d]">
            <RefreshCw className="w-10 h-10 animate-spin mb-6 text-[#00ff9d]" />
            <p className="text-sm tracking-widest uppercase animate-pulse">Establishing connection...</p>
          </div>
        ) : error instanceof RateLimitError ? (
          <div className="glass-panel p-12 text-center text-[#00ff9d]">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-60" />
            <h2 className="text-xl font-bold mb-2 tracking-widest uppercase">RATE_LIMITED</h2>
            <p className="text-sm text-[#00ff9d]/80">{error.message}</p>
            <p className="text-sm text-[#00ff9d]/80 mt-2">
              {error.retryAt ? `Try again after ${error.retryAt.toLocaleString()}.` : 'Try again later.'}
            </p>
          </div>
        ) : error ? (
          <div className="bg-[#ff0080]/10 border border-[#ff0080] p-8 text-center text-[#ff0080] backdrop-blur-xl shadow-[0_0_30px_rgba(255,0,128,0.2)]">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-[#ff0080] animate-pulse" />
            <h2 className="text-xl font-bold mb-2 tracking-widest uppercase">CRITICAL SYSTEM ERROR</h2>
            <p className="text-[#ff0080]/80 text-sm">{error.message}</p>
          </div>
        ) : !history || history.snapshots.length === 0 ? (
          <div className="glass-panel p-12 text-center text-[#00ff9d]/50">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <h2 className="text-xl font-bold text-[#00ff9d] mb-2 tracking-widest uppercase">NO_DATA_STREAM</h2>
            <p className="text-sm">Connect a valid source to initialize visualizer.</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
            {/* Info Section */}
            <div className="glass-panel p-6 mb-8 border border-[#00ff9d]/30 bg-black/40 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#00ff9d]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="flex items-center gap-2 text-[#00ff9d] mb-4 relative z-10">
                <Info className="w-5 h-5" />
                <h2 className="text-sm font-bold tracking-widest uppercase">SYS.MANUAL // Telemetry Guide</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#00ff9d]/80 font-mono leading-relaxed relative z-10">
                <div className="bg-[#00ff9d]/5 p-4 border-l-2 border-[#00ff9d]">
                  <p><strong className="text-[#00ff9d] block mb-1 uppercase tracking-wider">CPU_INSTRUCTIONS:</strong> Soroban limits the total compute operations per transaction to ensure network stability. High CPU usage means your smart contract is computationally expensive and will cost more fees to execute.</p>
                </div>
                <div className="bg-[#00ff9d]/5 p-4 border-l-2 border-[#00ff9d]">
                  <p><strong className="text-[#00ff9d] block mb-1 uppercase tracking-wider">READ_BYTES / WRITE_BYTES:</strong> Ledger data read from disk and written by the transaction. Since protocol 23, read bytes leave out reads of live contract storage, so a new storage read may not move this number.</p>
                </div>
                <div className="bg-[#ff0080]/5 p-4 border-l-2 border-[#ff0080]">
                  <p><strong className="text-[#ff0080] block mb-1 uppercase tracking-wider">FOOTPRINT ENTRIES:</strong> Ledger entries the transaction touches: all footprint entries, and the read-write ones among them. These show added contract-storage access that read bytes miss.</p>
                </div>
              </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="glass-panel p-6 flex flex-col justify-center relative overflow-hidden group hover:border-[#00ff9d] transition-all duration-300">
                <div className="flex items-center gap-3 mb-3 text-[#00ff9d]">
                  <Database className="w-5 h-5" />
                  <h3 className="font-bold text-xs tracking-widest uppercase">SYS.LATEST_COMMIT</h3>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight mb-1">{latestSnapshot?.commit_sha.substring(0, 7)}</p>
                <p className="text-[10px] text-[#00ff9d]/50 uppercase mt-1">Most recent code snapshot analyzed.</p>
                <p className="text-xs text-[#00ff9d]/60 mt-2 uppercase">GEN_TIME: {new Date(latestSnapshot?.generated_at || '').toLocaleString()}</p>
              </div>

              <div className={`glass-panel p-6 flex items-center justify-between relative overflow-hidden group transition-all duration-300 ${regressionStatus === 'Clear' ? 'border-[#00ff9d]/40 shadow-[0_0_15px_rgba(0,255,157,0.1)]' : 'border-[#ff0080] shadow-[0_0_30px_rgba(255,0,128,0.3)] bg-[#ff0080]/5'}`}>
                <div className="relative z-10 flex flex-col justify-center">
                  <div className={`flex items-center gap-3 mb-3 ${regressionStatus === 'Clear' ? 'text-[#00ff9d]' : 'text-[#ff0080]'}`}>
                    <Activity className="w-5 h-5" />
                    <h3 className="font-bold text-xs tracking-widest uppercase">SYS.REGRESSION_STATE</h3>
                  </div>
                  <p className={`text-xl font-bold tracking-widest uppercase mb-1 ${regressionStatus === 'Clear' ? 'text-[#00ff9d]' : 'text-[#ff0080] animate-pulse'}`}>
                    {regressionStatus}
                  </p>
                  <p className={`text-[10px] uppercase mt-1 ${regressionStatus === 'Clear' ? 'text-[#00ff9d]/50' : 'text-[#ff0080]/60'}`}>
                    Monitors resource usage spikes {'>'}10%.
                  </p>
                </div>
                <div className="relative z-10">
                  {regressionStatus === 'Clear' ? (
                    <CheckCircle2 className="w-12 h-12 text-[#00ff9d]/40" />
                  ) : (
                    <AlertTriangle className="w-12 h-12 text-[#ff0080]/70" />
                  )}
                </div>
              </div>

              <div className="glass-panel p-6 flex flex-col justify-center relative overflow-hidden group hover:border-[#00ff9d] transition-all duration-300">
                <div className="flex items-center gap-3 mb-3 text-[#00ff9d]">
                  <Server className="w-5 h-5" />
                  <h3 className="font-bold text-xs tracking-widest uppercase">SYS.TRACKED_FNS</h3>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight mb-1">{allFunctions.length} <span className="text-sm text-[#00ff9d] uppercase tracking-widest">Active</span></p>
                <p className="text-[10px] text-[#00ff9d]/50 uppercase mt-1">Smart contract functions currently profiled.</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="glass-panel overflow-hidden">
              <div className="p-6 border-b border-[#00ff9d]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#00ff9d]/5">
                <div>
                  <h2 className="text-lg font-bold text-[#00ff9d] flex items-center gap-2 uppercase tracking-widest">
                    <Zap className="w-5 h-5" />
                    RESOURCE_TELEMETRY
                  </h2>
                  <p className="text-[#00ff9d]/60 text-xs mt-2 uppercase">
                    {selectedFunction === 'all' ? '> Aggregate cost across all vectors' : `> Vector footprint: ${selectedFunction}`}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <label htmlFor="function-select" className="text-xs text-[#00ff9d] font-bold uppercase tracking-widest">FILTER_VECTOR:</label>
                  <div className="relative w-full sm:w-64">
                    <select 
                      id="function-select"
                      value={selectedFunction} 
                      onChange={(e) => setSelectedFunction(e.target.value)}
                      className="glass-input text-[#00ff9d] text-xs block w-full p-2 pr-10 outline-none appearance-none cursor-pointer uppercase font-mono"
                    >
                      <option value="all" className="bg-[#030303]">* ALL_VECTORS (AGGREGATE)</option>
                      {allFunctions.map(fn => (
                        <option key={fn} value={fn} className="bg-[#030303]">{'>'} {fn}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#00ff9d] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
              
              <MetricChart
                title="CPU instructions"
                unit="instructions"
                data={chartData}
                series={[{ key: 'cpu_instructions', name: 'CPU_INSTRUCTIONS', color: '#00ff9d' }]}
              />
              <MetricChart
                title="Ledger bytes"
                unit="bytes"
                data={chartData}
                series={[
                  { key: 'read_bytes', name: 'READ_BYTES', color: '#00ff9d' },
                  { key: 'write_bytes', name: 'WRITE_BYTES', color: '#ff0080', dashed: true },
                ]}
              />
              <MetricChart
                title="Footprint entries"
                unit="entries"
                data={chartData}
                series={[
                  { key: 'read_entries', name: 'ALL_ENTRIES', color: '#00ff9d' },
                  { key: 'write_entries', name: 'READ_WRITE_ENTRIES', color: '#ff0080', dashed: true },
                ]}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
