export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    Probation: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    Exited: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    Approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    Finalized: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    Draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    present: 'bg-emerald-100 text-emerald-800',
    late: 'bg-amber-100 text-amber-800',
    half_day: 'bg-orange-100 text-orange-800',
    absent: 'bg-red-100 text-red-800',
    missing_checkout: 'bg-purple-100 text-purple-800',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

export function extractErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (!err) return fallback;

  if (typeof err === 'string') return err;

  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>;

    // Axios response data
    const response = errorObj.response as Record<string, unknown> | undefined;
    if (response?.data) {
      const data = response.data as Record<string, unknown>;
      const detail = data.detail;

      if (typeof detail === 'string') {
        return detail;
      }

      if (Array.isArray(detail)) {
        const msgs = detail.map((d) => {
          if (typeof d === 'string') return d;
          if (typeof d === 'object' && d !== null) {
            const item = d as Record<string, unknown>;
            const loc = Array.isArray(item.loc) ? item.loc.filter((x) => x !== 'body').join('.') : '';
            const msg = item.msg || item.message;
            if (loc && msg) return `${loc}: ${msg}`;
            if (msg) return String(msg);
          }
          return JSON.stringify(d);
        });
        return msgs.join(', ');
      }

      if (typeof detail === 'object' && detail !== null) {
        const detailObj = detail as Record<string, unknown>;
        if (typeof detailObj.msg === 'string') return detailObj.msg;
        if (typeof detailObj.message === 'string') return detailObj.message;
        return JSON.stringify(detail);
      }

      if (typeof data.message === 'string') {
        return data.message;
      }
    }

    if (errorObj instanceof Error) {
      return errorObj.message;
    }

    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }
  }

  return fallback;
}
