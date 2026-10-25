'use client';
import React, { useState, useEffect } from 'react';
import { ScrollText, Search, RefreshCw, ChevronRight, X } from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

interface AuditLog {
  id: number;
  actor_id?: number;
  actor_email?: string;
  action: string;
  entity: string;
  entity_id?: string;
  before_state?: any;
  after_state?: any;
  created_at: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Expanded log for inspecting JSON diff
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit: 25 };
      if (search) params.search = search;
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity = entityFilter;

      const res = await api.get('/api/v1/comms/audit-logs', { params });
      setLogs(res.data?.items || res.data || []);
      setTotal(res.data?.total || (res.data || []).length);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, entityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-emerald-600" />
            Immutable Audit Trail
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Cryptographic ledger tracking all critical mutations, state transitions, and administrative approvals
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchLogs} title="Refresh logs">
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by actor email, entity ID, or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="APPROVE">APPROVE</option>
            <option value="FINALIZE">FINALIZE</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Entities</option>
            <option value="User">User</option>
            <option value="Employee">Employee</option>
            <option value="LeaveRequest">LeaveRequest</option>
            <option value="Attendance">Attendance</option>
            <option value="PayrollRun">PayrollRun</option>
            <option value="CompanySettings">CompanySettings</option>
          </select>

          <Button type="submit" size="sm">
            <Search className="h-3.5 w-3.5 mr-1" /> Search
          </Button>
        </form>
      </Card>

      {/* Main Table + Diff Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`space-y-4 ${selectedLog ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Logged Entries ({total})</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Timestamp</th>
                    <th className="py-2.5 px-3 font-medium">Actor</th>
                    <th className="py-2.5 px-3 font-medium">Action</th>
                    <th className="py-2.5 px-3 font-medium">Entity</th>
                    <th className="py-2.5 px-3 font-medium">Entity ID</th>
                    <th className="py-2.5 px-3 font-medium text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center">
                        <Spinner size="md" />
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No mutation logs matching criteria
                      </td>
                    </tr>
                  ) : (
                    logs.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedLog(l)}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-900/40 cursor-pointer transition-colors ${
                          selectedLog?.id === l.id ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">{formatDate(l.created_at)}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-gray-900 dark:text-gray-100">
                          {l.actor_email || 'System'}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-[10px]">
                            {l.action}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{l.entity}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-500">{l.entity_id || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <ChevronRight className="h-4 w-4 text-gray-400 inline" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-400">Page {page}</span>
              <div className="space-x-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={logs.length < 25} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* State Snapshot Diff Viewer */}
        {selectedLog && (
          <div className="lg:col-span-1">
            <Card className="p-4 space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white">State Snapshot Diff</h3>
                  <p className="text-[11px] text-gray-400">Log Entry #{selectedLog.id}</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block mb-1">
                    Before Mutation:
                  </span>
                  <pre className="p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-[11px] font-mono text-gray-700 dark:text-gray-300 max-h-48 overflow-auto whitespace-pre-wrap">
                    {selectedLog.before_state
                      ? JSON.stringify(selectedLog.before_state, null, 2)
                      : 'null (Initial record creation)'}
                  </pre>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                    After Mutation:
                  </span>
                  <pre className="p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-[11px] font-mono text-gray-700 dark:text-gray-300 max-h-48 overflow-auto whitespace-pre-wrap">
                    {selectedLog.after_state ? JSON.stringify(selectedLog.after_state, null, 2) : 'null (Record deleted)'}
                  </pre>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
