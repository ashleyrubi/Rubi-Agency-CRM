
import React from 'react';
import { LeadStatus, TaskStatus, UserStatus } from '../types';

interface StatusBadgeProps {
  status: LeadStatus | TaskStatus | UserStatus | string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    switch (status) {
      // Lead Statuses
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'Contacted': return 'bg-purple-100 text-purple-800';
      case 'Qualified': return 'bg-indigo-100 text-indigo-800';
      case 'Proposal': return 'bg-amber-100 text-amber-800';
      case 'Won': return 'bg-green-100 text-green-800';
      case 'Lost': return 'bg-gray-100 text-gray-800';
      
      // Task Statuses
      case 'Not Started': return 'bg-gray-100 text-gray-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Complete': return 'bg-green-100 text-green-800';

      // User Statuses
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-red-100 text-red-800';
      case 'On Leave': return 'bg-amber-100 text-amber-800';

      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStyles()}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
