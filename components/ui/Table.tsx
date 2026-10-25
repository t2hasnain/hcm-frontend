import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  );
}

export function TableHead({ children }: TableProps) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      {children}
    </thead>
  );
}

export function TableBody({ children }: TableProps) {
  return (
    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</tbody>
  );
}

export function TableRow({ children, className = '', onClick }: TableProps & { onClick?: () => void }) {
  return (
    <tr
      className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHeader({ children, className = '' }: TableProps) {
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>
  );
}

export function TableCell({ children, className = '' }: TableProps) {
  return (
    <td className={`px-4 py-3 text-gray-700 dark:text-gray-300 ${className}`}>
      {children}
    </td>
  );
}
