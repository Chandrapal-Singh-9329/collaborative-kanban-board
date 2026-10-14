import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosClient from '../api/axiosClient.js';

// Pre-defined demo collaborator personas
export const DEMO_USERS = [
  { userId: 'user_sarah', name: 'Sarah Connor (Lead)', email: 'sarah@appsica.com', color: '#6366f1' },
  { userId: 'user_alex', name: 'Alex Johnson (Frontend)', email: 'alex@appsica.com', color: '#06b6d4' },
  { userId: 'user_maya', name: 'Maya Lin (Designer)', email: 'maya@appsica.com', color: '#ec4899' },
  { userId: 'user_devin', name: 'Devin Miller (QA)', email: 'devin@appsica.com', color: '#10b981' }
];

const getInitialDemoUser = () => {
  try {
    const saved = localStorage.getItem('kanban_demo_user');
    if (saved) return JSON.parse(saved);
  } catch {
    // fallback
  }
  return DEMO_USERS[0];
};

// Async Thunks
export const fetchBoards = createAsyncThunk('board/fetchBoards', async (_, { rejectWithValue }) => {
  try {
    const res = await axiosClient.get('/boards');
    return res.data.data;
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchBoardById = createAsyncThunk(
  'board/fetchBoardById',
  async (boardId, { rejectWithValue }) => {
    try {
      const res = await axiosClient.get(`/boards/${boardId}`);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createBoard = createAsyncThunk(
  'board/createBoard',
  async (boardData, { rejectWithValue }) => {
    try {
      const res = await axiosClient.post('/boards', boardData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const addMemberToBoard = createAsyncThunk(
  'board/addMemberToBoard',
  async ({ boardId, member }, { rejectWithValue }) => {
    try {
      const res = await axiosClient.post(`/boards/${boardId}/members`, member);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createTask = createAsyncThunk(
  'board/createTask',
  async ({ boardId, taskData }, { rejectWithValue }) => {
    try {
      const res = await axiosClient.post(`/boards/${boardId}/tasks`, taskData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateTask = createAsyncThunk(
  'board/updateTask',
  async ({ taskId, updates }, { rejectWithValue }) => {
    try {
      const res = await axiosClient.patch(`/tasks/${taskId}`, updates);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const moveTask = createAsyncThunk(
  'board/moveTask',
  async ({ taskId, moveData, previousState }, { rejectWithValue }) => {
    try {
      const res = await axiosClient.patch(`/tasks/${taskId}/move`, moveData);
      return res.data.data;
    } catch (err) {
      return rejectWithValue({ message: err.message, previousState });
    }
  }
);

export const deleteTask = createAsyncThunk(
  'board/deleteTask',
  async (taskId, { rejectWithValue }) => {
    try {
      const res = await axiosClient.delete(`/tasks/${taskId}`);
      return { taskId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchComments = createAsyncThunk(
  'board/fetchComments',
  async (taskId, { rejectWithValue }) => {
    try {
      const res = await axiosClient.get(`/tasks/${taskId}/comments`);
      return { taskId, comments: res.data.data };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const addComment = createAsyncThunk(
  'board/addComment',
  async ({ taskId, text, author }, { rejectWithValue }) => {
    try {
      const res = await axiosClient.post(`/tasks/${taskId}/comments`, { text, author });
      return { taskId, comment: res.data.data, task: res.data.task };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const initialState = {
  boards: [],
  activeBoard: null,
  tasks: [],
  onlineMembers: [],
  typingUsers: {}, // map of userId -> { name, taskId, column, timestamp }
  filters: {
    priority: 'All',
    member: 'All',
    dueDate: 'All',
    search: ''
  },
  currentDemoUser: getInitialDemoUser(),
  loading: false,
  boardLoading: false,
  error: null,
  activeRequests: {} // tracks client-initiated requestIds to prevent duplicate socket applies
};

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    setDemoUser: (state, action) => {
      state.currentDemoUser = action.payload;
      try {
        localStorage.setItem('kanban_demo_user', JSON.stringify(action.payload));
      } catch {}
    },
    setActiveBoard: (state, action) => {
      state.activeBoard = action.payload;
    },
    setFilter: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {
        priority: 'All',
        member: 'All',
        dueDate: 'All',
        search: ''
      };
    },
    // Optimistic Move
    moveTaskOptimistic: (state, action) => {
      const { taskId, source, destination } = action.payload;
      if (!source || !destination) return;

      const taskIndex = state.tasks.findIndex((t) => t._id === taskId);
      if (taskIndex === -1) return;

      const task = state.tasks[taskIndex];
      const sourceCol = source.droppableId;
      const destCol = destination.droppableId;
      const sourceIdx = source.index;
      const destIdx = destination.index;

      if (sourceCol === destCol && sourceIdx === destIdx) return;

      if (sourceCol === destCol) {
        // Same column reorder
        state.tasks.forEach((t) => {
          if (t._id === taskId) {
            t.position = destIdx;
          } else if (t.status === sourceCol) {
            if (destIdx > sourceIdx && t.position > sourceIdx && t.position <= destIdx) {
              t.position -= 1;
            } else if (destIdx < sourceIdx && t.position >= destIdx && t.position < sourceIdx) {
              t.position += 1;
            }
          }
        });
      } else {
        // Cross column move
        state.tasks.forEach((t) => {
          if (t._id === taskId) {
            t.status = destCol;
            t.position = destIdx;
          } else if (t.status === sourceCol && t.position > sourceIdx) {
            t.position -= 1;
          } else if (t.status === destCol && t.position >= destIdx) {
            t.position += 1;
          }
        });
      }
    },
    // Rollback if move failed
    moveTaskRollback: (state, action) => {
      if (action.payload?.previousTasks) {
        state.tasks = action.payload.previousTasks;
      }
    },
    // Socket.IO event handlers
    socketTaskCreated: (state, action) => {
      const { task } = action.payload;
      if (!task || !task._id) return;
      const exists = state.tasks.some((t) => t._id === task._id);
      if (!exists) {
        state.tasks.push(task);
      }
    },
    socketTaskUpdated: (state, action) => {
      const { task } = action.payload;
      if (!task || !task._id) return;
      const index = state.tasks.findIndex((t) => t._id === task._id);
      if (index !== -1) {
        state.tasks[index] = task;
      }
    },
    socketTaskMoved: (state, action) => {
      const { task } = action.payload;
      if (!task || !task._id) return;
      const index = state.tasks.findIndex((t) => t._id === task._id);
      if (index !== -1) {
        state.tasks[index] = task;
      }
    },
    socketTaskDeleted: (state, action) => {
      const { taskId } = action.payload;
      state.tasks = state.tasks.filter((t) => t._id !== taskId);
    },
    socketCommentCreated: (state, action) => {
      const { taskId, comment } = action.payload;
      if (!taskId || !comment) return;
      const task = state.tasks.find((t) => t._id === taskId);
      if (task) {
        if (!task.comments) task.comments = [];
        const exists = task.comments.some((c) => c._id === comment._id);
        if (!exists) {
          task.comments.push(comment);
        }
      }
    },
    setOnlineMembers: (state, action) => {
      state.onlineMembers = action.payload || [];
    },
    memberOnline: (state, action) => {
      const { user, onlineMembers } = action.payload;
      if (onlineMembers) {
        state.onlineMembers = onlineMembers;
      } else if (user && !state.onlineMembers.some((m) => m.userId === user.userId)) {
        state.onlineMembers.push(user);
      }
    },
    memberOffline: (state, action) => {
      const { user, onlineMembers } = action.payload;
      if (onlineMembers) {
        state.onlineMembers = onlineMembers;
      } else if (user) {
        state.onlineMembers = state.onlineMembers.filter((m) => m.userId !== user.userId);
      }
    },
    setTypingIndicator: (state, action) => {
      const { user, taskId, column } = action.payload;
      if (!user?.userId) return;
      state.typingUsers[user.userId] = {
        name: user.name,
        taskId,
        column,
        timestamp: Date.now()
      };
    },
    clearTypingIndicator: (state, action) => {
      const { user } = action.payload;
      if (user?.userId && state.typingUsers[user.userId]) {
        delete state.typingUsers[user.userId];
      }
    },
    cleanupStaleTyping: (state) => {
      const now = Date.now();
      Object.keys(state.typingUsers).forEach((userId) => {
        if (now - state.typingUsers[userId].timestamp > 4000) {
          delete state.typingUsers[userId];
        }
      });
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchBoards
      .addCase(fetchBoards.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBoards.fulfilled, (state, action) => {
        state.loading = false;
        state.boards = action.payload;
      })
      .addCase(fetchBoards.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchBoardById
      .addCase(fetchBoardById.pending, (state) => {
        state.boardLoading = true;
        state.error = null;
      })
      .addCase(fetchBoardById.fulfilled, (state, action) => {
        state.boardLoading = false;
        const { tasks, ...boardData } = action.payload;
        state.activeBoard = boardData;
        state.tasks = tasks || [];
      })
      .addCase(fetchBoardById.rejected, (state, action) => {
        state.boardLoading = false;
        state.error = action.payload;
      })
      // createBoard
      .addCase(createBoard.fulfilled, (state, action) => {
        state.boards.unshift(action.payload);
        state.activeBoard = action.payload;
        state.tasks = [];
      })
      // addMemberToBoard
      .addCase(addMemberToBoard.fulfilled, (state, action) => {
        state.activeBoard = action.payload;
      })
      // createTask
      .addCase(createTask.fulfilled, (state, action) => {
        const newTask = action.payload;
        const exists = state.tasks.some((t) => t._id === newTask._id);
        if (!exists) {
          state.tasks.push(newTask);
        }
      })
      // updateTask
      .addCase(updateTask.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.tasks.findIndex((t) => t._id === updated._id);
        if (index !== -1) {
          state.tasks[index] = updated;
        }
      })
      // moveTask
      .addCase(moveTask.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.tasks.findIndex((t) => t._id === updated._id);
        if (index !== -1) {
          state.tasks[index] = updated;
        }
      })
      .addCase(moveTask.rejected, (state, action) => {
        if (action.payload?.previousState) {
          state.tasks = action.payload.previousState;
        }
        state.error = action.payload?.message || 'Failed to move task';
      })
      // deleteTask
      .addCase(deleteTask.fulfilled, (state, action) => {
        const { taskId } = action.payload;
        state.tasks = state.tasks.filter((t) => t._id !== taskId);
      })
      // addComment
      .addCase(addComment.fulfilled, (state, action) => {
        const { taskId, comment } = action.payload;
        const task = state.tasks.find((t) => t._id === taskId);
        if (task) {
          if (!task.comments) task.comments = [];
          const exists = task.comments.some((c) => c._id === comment._id);
          if (!exists) {
            task.comments.push(comment);
          }
        }
      })
      // fetchComments
      .addCase(fetchComments.fulfilled, (state, action) => {
        const { taskId, comments } = action.payload;
        const task = state.tasks.find((t) => t._id === taskId);
        if (task) {
          task.comments = comments;
        }
      });
  }
});

export const {
  setDemoUser,
  setActiveBoard,
  setFilter,
  clearFilters,
  moveTaskOptimistic,
  moveTaskRollback,
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskMoved,
  socketTaskDeleted,
  socketCommentCreated,
  setOnlineMembers,
  memberOnline,
  memberOffline,
  setTypingIndicator,
  clearTypingIndicator,
  cleanupStaleTyping
} = boardSlice.actions;

export default boardSlice.reducer;
