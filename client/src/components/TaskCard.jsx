import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, Trash2, Edit2, Clock, MessageSquare } from 'lucide-react';

export default function TaskCard({ task, index, onEdit, onDelete }) {
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0)) &&
    task.status !== 'Done';

  const formatDueDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'High':
        return 'priority-high';
      case 'Low':
        return 'priority-low';
      case 'Medium':
      default:
        return 'priority-medium';
    }
  };

  const assigneeName = task.assignedTo?.name || 'Unassigned';
  const assigneeInitial = assigneeName.charAt(0).toUpperCase();

  return (
    <Draggable draggableId={task._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
          onClick={() => onEdit(task)}
        >
          {/* Header: Priority & Card Actions */}
          <div className="task-card-header">
            <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
              {task.priority || 'Medium'}
            </span>

            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="action-btn"
                title="Edit Task"
                onClick={() => onEdit(task)}
              >
                <Edit2 size={13} />
              </button>
              <button
                className="action-btn btn-delete"
                title="Delete Task"
                onClick={() => onDelete(task._id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Title */}
          <h4 className="task-title">{task.title}</h4>

          {/* Description */}
          {task.description && <p className="task-desc">{task.description}</p>}

          {/* Footer: Due date & Assignee */}
          <div className="task-card-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {task.dueDate && (
                <div className={`task-due-date ${isOverdue ? 'is-overdue' : ''}`}>
                  {isOverdue ? <Clock size={12} /> : <Calendar size={12} />}
                  <span>{formatDueDate(task.dueDate)}</span>
                </div>
              )}
              {task.comments && task.comments.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#818cf8',
                    fontSize: '0.72rem',
                    fontWeight: 600
                  }}
                  title={`${task.comments.length} comment(s)`}
                >
                  <MessageSquare size={11} />
                  <span>{task.comments.length}</span>
                </div>
              )}
            </div>

            <div className="task-assignee" title={`Assigned to ${assigneeName}`}>
              <div
                className="assignee-avatar"
                style={{
                  backgroundColor:
                    assigneeName === 'Unassigned'
                      ? '#334155'
                      : ['#6366f1', '#06b6d4', '#ec4899', '#10b981', '#f59e0b'][
                          Math.abs(assigneeName.charCodeAt(0)) % 5
                        ]
                }}
              >
                {assigneeInitial}
              </div>
              <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {assigneeName}
              </span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
