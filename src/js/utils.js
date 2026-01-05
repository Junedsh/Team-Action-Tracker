export const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const isOverdue = (task) => {
    return !task.status.includes('Done') && new Date(task.promise_date + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
};

export const getStatusColors = (task) => {
    if (isOverdue(task)) return { bg: 'bg-red-100', text: 'text-red-800', label: 'Overdue', calendarColor: '#EF4444' };
    switch (task.status) {
        case 'Pending': return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending', calendarColor: '#FBBF24' };
        case 'In Progress': return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress', calendarColor: '#3B82F6' };
        case 'Done': return { bg: 'bg-green-100', text: 'text-green-800', label: 'Done', calendarColor: '#10B981' };
        default: return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown', calendarColor: '#6B7280' };
    }
};

export const getPriorityColors = (priority) => {
    switch (priority) {
        case 'Urgent': return 'bg-red-500 text-white';
        case 'High': return 'bg-orange-500 text-white';
        case 'Medium': return 'bg-blue-500 text-white';
        case 'Low': return 'bg-gray-500 text-white';
        default: return 'bg-gray-400 text-white';
    }
};

export const calculateDaysTaken = (task) => {
    if (task.status !== 'Done' || !task.completed_date) return '—';
    const assigned = new Date(task.assigned_date + 'T00:00:00');
    const completed = new Date(task.completed_date + 'T00:00:00');
    if (isNaN(assigned) || isNaN(completed)) return '—';
    const diffTime = Math.abs(completed - assigned);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? 'Today' : `${diffDays}d`;
};

export const calculatePromiseDifference = (task) => {
    if (!task.assigned_date || !task.promise_date) return 'N/A';
    const assigned = new Date(task.assigned_date);
    const promise = new Date(task.promise_date);
    if (isNaN(assigned.getTime()) || isNaN(promise.getTime())) return 'N/A';
    const diffTime = promise.getTime() - assigned.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} day(s)`;
};
