import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch, useStore } from 'react-redux';
import { DragDropContext } from '@hello-pangea/dnd';
import {
  fetchBoards,
  fetchBoardById,
  createBoard,
  addMemberToBoard,
  createTask,
  updateTask,
  moveTask,
  moveTaskOptimistic,
  deleteTask,
  setActiveBoard
} from './redux/boardSlice.js';
import { initSocket, joinBoard, disconnectSocket } from './services/socket.js';

import Header from './components/Header.jsx';
import BoardHeader from './components/BoardHeader.jsx';
import FilterBar from './components/FilterBar.jsx';
import Column from './components/Column.jsx';
import TypingIndicator from './components/TypingIndicator.jsx';
import TaskModal from './components/TaskModal.jsx';
import CreateBoardModal from './components/CreateBoardModal.jsx';
import AddMemberModal from './components/AddMemberModal.jsx';

import { Loader2, AlertCircle, Plus, Kanban } from 'lucide-react';

const COLUMNS = ['Todo', 'In Progress', 'Review', 'Done'];

export default function App() {
  const dispatch = useDispatch();
  const store = useStore();
  const {
    boards,
    activeBoard,
    tasks,
    filters,
    currentDemoUser,
    loading,
    boardLoading,
    error
  } = useSelector((state) => state.board);

  // Modals state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskModalDefaultStatus, setTaskModalDefaultStatus] = useState('Todo');

  const [createBoardModalOpen, setCreateBoardModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  // 1. Initialize Socket.IO connection
  useEffect(() => {
    initSocket(dispatch, store.getState);
    return () => {
      disconnectSocket();
    };
  }, [dispatch, store]);

  // 2. Initial Data Loading & URL Board Matching
  useEffect(() => {
    const initApp = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const queryBoardId = urlParams.get('board');

      try {
        const boardList = await dispatch(fetchBoards()).unwrap();

        if (queryBoardId) {
          const matched = boardList.find((b) => b._id === queryBoardId);
          if (matched) {
            dispatch(setActiveBoard(matched));
            dispatch(fetchBoardById(queryBoardId));
            joinBoard(queryBoardId, currentDemoUser);
            return;
          }
        }

        // Default to first board if available
        if (boardList && boardList.length > 0) {
          const firstBoard = boardList[0];
          dispatch(setActiveBoard(firstBoard));
          dispatch(fetchBoardById(firstBoard._id));
          joinBoard(firstBoard._id, currentDemoUser);

          const url = new URL(window.location.href);
          url.searchParams.set('board', firstBoard._id);
          window.history.replaceState({}, '', url);
        } else {
          // If no board exists, automatically create a starter board
          const newBoard = await dispatch(
            createBoard({
              title: 'Sprint 1 - Collaborative Kanban',
              description: 'Real-time task tracking with instant multi-user synchronization.',
              createdBy: currentDemoUser
            })
          ).unwrap();

          dispatch(fetchBoardById(newBoard._id));
          joinBoard(newBoard._id, currentDemoUser);

          const url = new URL(window.location.href);
          url.searchParams.set('board', newBoard._id);
          window.history.replaceState({}, '', url);
        }
      } catch (err) {
        console.error('Error during initial board load:', err);
      }
    };

    initApp();
  }, [dispatch]);

  // Filter Tasks based on Redux filter state
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Priority filter
      if (filters.priority !== 'All' && task.priority !== filters.priority) {
        return false;
      }

      // 2. Member filter
      if (filters.member !== 'All') {
        const assignee = task.assignedTo?.name || 'Unassigned';
        if (filters.member === 'Unassigned') {
          if (assignee !== 'Unassigned') return false;
        } else if (assignee !== filters.member) {
          return false;
        }
      }

      // 3. Due Date filter
      if (filters.dueDate !== 'All') {
        const todayStr = new Date().toISOString().split('T')[0];
        const taskDateStr = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null;

        if (filters.dueDate === 'Overdue') {
          if (!task.dueDate || task.status === 'Done') return false;
          if (new Date(task.dueDate) >= new Date(new Date().setHours(0, 0, 0, 0))) return false;
        } else if (filters.dueDate === 'DueToday') {
          if (taskDateStr !== todayStr) return false;
        } else if (filters.dueDate === 'HasDate') {
          if (!task.dueDate) return false;
        } else if (filters.dueDate === 'NoDate') {
          if (task.dueDate) return false;
        }
      }

      // 4. Search keyword filter
      if (filters.search && filters.search.trim() !== '') {
        const query = filters.search.toLowerCase().trim();
        const titleMatch = task.title?.toLowerCase().includes(query);
        const descMatch = task.description?.toLowerCase().includes(query);
        const assigneeMatch = task.assignedTo?.name?.toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !assigneeMatch) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  // Group filtered tasks by column and sort by position ascending
  const tasksByColumn = useMemo(() => {
    const map = {
      Todo: [],
      'In Progress': [],
      Review: [],
      Done: []
    };

    filteredTasks.forEach((task) => {
      const col = map[task.status] ? task.status : 'Todo';
      map[col].push(task);
    });

    Object.keys(map).forEach((col) => {
      map[col].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    });

    return map;
  }, [filteredTasks]);

  // Drag and Drop Handler
  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Save snapshot of current tasks for optimistic rollback if API fails
    const previousTasks = [...tasks];

    // 1. Optimistic Redux Update
    dispatch(
      moveTaskOptimistic({
        taskId: draggableId,
        source,
        destination
      })
    );

    // 2. Dispatch Server Move API Call
    try {
      await dispatch(
        moveTask({
          taskId: draggableId,
          moveData: {
            status: destination.droppableId,
            position: destination.index
          },
          previousState: previousTasks
        })
      ).unwrap();
    } catch (err) {
      console.error('Task move API failed:', err);
    }
  };

  // Task Actions
  const handleOpenAddTask = (status = 'Todo') => {
    setSelectedTask(null);
    setTaskModalDefaultStatus(status);
    setTaskModalOpen(true);
  };

  const handleOpenEditTask = (task) => {
    setSelectedTask(task);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (taskData) => {
    if (selectedTask) {
      await dispatch(updateTask({ taskId: selectedTask._id, updates: taskData })).unwrap();
    } else {
      await dispatch(createTask({ boardId: activeBoard._id, taskData })).unwrap();
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await dispatch(deleteTask(taskId)).unwrap();
      } catch (err) {
        alert(err.message || 'Failed to delete task');
      }
    }
  };

  // Board Actions
  const handleCreateBoard = async (boardData) => {
    const newBoard = await dispatch(
      createBoard({
        ...boardData,
        createdBy: currentDemoUser
      })
    ).unwrap();

    dispatch(fetchBoardById(newBoard._id));
    joinBoard(newBoard._id, currentDemoUser);

    const url = new URL(window.location.href);
    url.searchParams.set('board', newBoard._id);
    window.history.pushState({}, '', url);
  };

  const handleAddMember = async (memberData) => {
    await dispatch(
      addMemberToBoard({
        boardId: activeBoard._id,
        member: memberData
      })
    ).unwrap();
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Header
        onOpenCreateBoard={() => setCreateBoardModalOpen(true)}
      />

      {/* Main Board View */}
      {boardLoading && !activeBoard ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            minHeight: '60vh',
            gap: '12px',
            color: '#94a3b8'
          }}
        >
          <Loader2 size={24} className="spin" />
          <span>Loading collaborative board...</span>
        </div>
      ) : activeBoard ? (
        <>
          <BoardHeader
            onOpenAddTask={handleOpenAddTask}
            onOpenAddMember={() => setAddMemberModalOpen(true)}
          />

          <TypingIndicator />

          <FilterBar />

          {/* Kanban Columns with Drag and Drop */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="kanban-board">
              {COLUMNS.map((status) => (
                <Column
                  key={status}
                  status={status}
                  tasks={tasksByColumn[status] || []}
                  onAddTask={handleOpenAddTask}
                  onEditTask={handleOpenEditTask}
                  onDeleteTask={handleDeleteTask}
                />
              ))}
            </div>
          </DragDropContext>
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            padding: '60px 20px',
            textAlign: 'center',
            gap: '16px'
          }}
        >
          <Kanban size={48} color="#6366f1" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>No Board Selected</h2>
          <p style={{ color: '#94a3b8', maxWidth: '420px', fontSize: '0.9rem' }}>
            Get started by creating a new Kanban board to organize your tasks with real-time collaboration.
          </p>
          <button className="btn btn-primary" onClick={() => setCreateBoardModalOpen(true)}>
            <Plus size={16} />
            <span>Create Your First Board</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <TaskModal
        isOpen={taskModalOpen}
        task={selectedTask}
        defaultStatus={taskModalDefaultStatus}
        onClose={() => setTaskModalOpen(false)}
        onSave={handleSaveTask}
      />

      <CreateBoardModal
        isOpen={createBoardModalOpen}
        onClose={() => setCreateBoardModalOpen(false)}
        onCreate={handleCreateBoard}
      />

      <AddMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        onAdd={handleAddMember}
      />
    </div>
  );
}
