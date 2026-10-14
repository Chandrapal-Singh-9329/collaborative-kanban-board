import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard.jsx';
import { Plus, Inbox } from 'lucide-react';

const COLUMN_COLORS = {
  Todo: 'indicator-todo',
  'In Progress': 'indicator-inprogress',
  Review: 'indicator-review',
  Done: 'indicator-done'
};

export default function Column({ status, tasks, onAddTask, onEditTask, onDeleteTask }) {
  const colorClass = COLUMN_COLORS[status] || 'indicator-todo';

  return (
    <div className="kanban-column">
      {/* Column Header */}
      <div className="column-header">
        <div className="column-title-group">
          <span className={`column-color-indicator ${colorClass}`} />
          <h3>{status}</h3>
          <span className="task-count-badge">{tasks.length}</span>
        </div>

        <button
          className="btn-icon"
          title={`Add task to ${status}`}
          onClick={() => onAddTask(status)}
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Droppable Task List */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`column-tasks-list ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
          >
            {tasks.length > 0 ? (
              tasks.map((task, index) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  index={index}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ))
            ) : (
              <div className="column-empty">
                <Inbox size={22} opacity={0.4} />
                <span>No tasks in {status}</span>
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
