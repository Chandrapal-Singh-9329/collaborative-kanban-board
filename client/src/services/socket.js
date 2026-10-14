import { io } from 'socket.io-client';
import {
  memberOnline,
  memberOffline,
  setOnlineMembers,
  setTypingIndicator,
  clearTypingIndicator,
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskMoved,
  socketTaskDeleted,
  socketCommentCreated,
  fetchBoardById
} from '../redux/boardSlice.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let currentJoinedBoardId = null;

export const getSocket = () => socket;

export const initSocket = (dispatch, getState) => {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server, ID:', socket.id);
    // If reconnecting and active board exists, rejoin and refresh
    const state = getState();
    const activeBoard = state.board?.activeBoard;
    const currentUser = state.board?.currentDemoUser;
    if (activeBoard?._id) {
      console.log('[Socket] Rejoining board:', activeBoard._id);
      joinBoard(activeBoard._id, currentUser);
      dispatch(fetchBoardById(activeBoard._id));
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.warn('[Socket] Connection error:', error.message);
  });

  // Collaborative Presence
  socket.on('member:online', (data) => {
    dispatch(memberOnline(data));
  });

  socket.on('member:offline', (data) => {
    dispatch(memberOffline(data));
  });

  // Collaborative Typing Indicators
  socket.on('typing:start', (data) => {
    const currentUserId = getState().board?.currentDemoUser?.userId;
    // Don't show typing for self
    if (data.user?.userId !== currentUserId) {
      dispatch(setTypingIndicator(data));
    }
  });

  socket.on('typing:stop', (data) => {
    dispatch(clearTypingIndicator(data));
  });

  // Collaborative Task Events
  socket.on('task:created', (data) => {
    dispatch(socketTaskCreated(data));
  });

  socket.on('task:updated', (data) => {
    dispatch(socketTaskUpdated(data));
  });

  socket.on('task:moved', (data) => {
    dispatch(socketTaskMoved(data));
  });

  socket.on('task:deleted', (data) => {
    dispatch(socketTaskDeleted(data));
  });

  socket.on('comment:created', (data) => {
    dispatch(socketCommentCreated(data));
  });

  // Full Refresh / Board event
  socket.on('board:refresh', (data) => {
    const activeBoard = getState().board?.activeBoard;
    if (activeBoard && activeBoard._id === data.boardId) {
      dispatch(fetchBoardById(data.boardId));
    }
  });

  return socket;
};

export const joinBoard = (boardId, user) => {
  if (!socket) return;
  currentJoinedBoardId = boardId;
  socket.emit('board:join', { boardId, user }, (response) => {
    if (response?.onlineMembers) {
      // acknowledgement with online members
      // (Redux store will update through member:online as well)
    }
  });
};

export const leaveBoard = (boardId) => {
  if (!socket) return;
  const targetId = boardId || currentJoinedBoardId;
  if (targetId) {
    socket.emit('board:leave', { boardId: targetId });
    currentJoinedBoardId = null;
  }
};

export const emitTypingStart = (boardId, user, taskId, column) => {
  if (!socket) return;
  socket.emit('typing:start', { boardId, user, taskId, column });
};

export const emitTypingStop = (boardId, user, taskId, column) => {
  if (!socket) return;
  socket.emit('typing:stop', { boardId, user, taskId, column });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentJoinedBoardId = null;
  }
};
