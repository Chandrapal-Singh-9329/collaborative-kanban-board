import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setFilter, clearFilters } from '../redux/boardSlice.js';
import { Search, X, Filter } from 'lucide-react';

export default function FilterBar() {
  const dispatch = useDispatch();
  const { filters, activeBoard, tasks } = useSelector((state) => state.board);

  const hasActiveFilters =
    filters.priority !== 'All' ||
    filters.member !== 'All' ||
    filters.dueDate !== 'All' ||
    filters.search.trim() !== '';

  // Collect unique assignees from tasks and board members
  const memberOptions = [];
  const memberSet = new Set();

  if (activeBoard?.members) {
    activeBoard.members.forEach((m) => {
      if (m.name && !memberSet.has(m.name)) {
        memberSet.add(m.name);
        memberOptions.push(m.name);
      }
    });
  }

  tasks.forEach((t) => {
    if (t.assignedTo?.name && t.assignedTo.name !== 'Unassigned' && !memberSet.has(t.assignedTo.name)) {
      memberSet.add(t.assignedTo.name);
      memberOptions.push(t.assignedTo.name);
    }
  });

  return (
    <div style={{ padding: '0 28px 16px 28px' }}>
      <div className="filter-bar">
        <div className="filter-group">
          {/* Keyword Search */}
          <div className="search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => dispatch(setFilter({ search: e.target.value }))}
            />
          </div>

          {/* Priority Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Priority:</span>
            <select
              className="filter-select"
              value={filters.priority}
              onChange={(e) => dispatch(setFilter({ priority: e.target.value }))}
            >
              <option value="All">All Priorities</option>
              <option value="High">🔴 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🟢 Low</option>
            </select>
          </div>

          {/* Member Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Assignee:</span>
            <select
              className="filter-select"
              value={filters.member}
              onChange={(e) => dispatch(setFilter({ member: e.target.value }))}
            >
              <option value="All">All Members</option>
              <option value="Unassigned">Unassigned</option>
              {memberOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Due Date:</span>
            <select
              className="filter-select"
              value={filters.dueDate}
              onChange={(e) => dispatch(setFilter({ dueDate: e.target.value }))}
            >
              <option value="All">All Dates</option>
              <option value="Overdue">⚠️ Overdue</option>
              <option value="DueToday">📅 Due Today</option>
              <option value="HasDate">Has Due Date</option>
              <option value="NoDate">No Date</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => dispatch(clearFilters())}
            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <X size={14} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
