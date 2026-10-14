import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { Board } from '../models/Board.js';

// In-memory registry for online members per board: boardId -> Map(socketId -> userData)
const boardUsersMap = new Map();

const getOnlineMembers = (boardId) => {
  const socketMap = boardUsersMap.get(boardId);
  if (!socketMap) return [];
  const uniqueUsers = new Map();
  for (const user of socketMap.values()) {
    if (user && user.userId) {
      uniqueUsers.set(user.userId, user);
    }
  }
  return Array.from(uniqueUsers.values());
};

export const registerBoardSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    // 1. Join Board Room
    socket.on('board:join', ({ boardId, user }, callback) => {
      try {
        if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
          if (callback) callback({ success: false, message: 'Invalid board ID' });
          return;
        }

        const room = `board:${boardId}`;

        // Leave any previous board room if connected to one
        if (socket.data.boardId && socket.data.boardId !== boardId) {
          const oldRoom = `board:${socket.data.boardId}`;
          socket.leave(oldRoom);
          const oldMap = boardUsersMap.get(socket.data.boardId);
          if (oldMap) {
            oldMap.delete(socket.id);
            if (oldMap.size === 0) {
              boardUsersMap.delete(socket.data.boardId);
            }
          }
          io.to(oldRoom).emit('member:offline', {
            user: socket.data.user,
            boardId: socket.data.boardId,
            onlineMembers: getOnlineMembers(socket.data.boardId)
          });
        }

        socket.join(room);

        const userData = {
          userId: user?.userId || `user_${socket.id.substring(0, 6)}`,
          name: user?.name || 'Anonymous',
          email: user?.email || '',
          socketId: socket.id
        };

        socket.data.boardId = boardId;
        socket.data.user = userData;

        if (!boardUsersMap.has(boardId)) {
          boardUsersMap.set(boardId, new Map());
        }
        boardUsersMap.get(boardId).set(socket.id, userData);

        const onlineMembers = getOnlineMembers(boardId);

        // Notify others in this board room that a member came online
        socket.to(room).emit('member:online', {
          user: userData,
          boardId,
          onlineMembers
        });

        if (callback) {
          callback({
            success: true,
            boardId,
            onlineMembers
          });
        }
      } catch (error) {
        console.error('[Socket board:join error]', error);
        if (callback) callback({ success: false, message: error.message });
      }
    });

    // 2. Leave Board Room
    socket.on('board:leave', ({ boardId }, callback) => {
      try {
        const targetBoardId = boardId || socket.data.boardId;
        if (!targetBoardId) return;

        const room = `board:${targetBoardId}`;
        socket.leave(room);

        const boardMap = boardUsersMap.get(targetBoardId);
        if (boardMap) {
          boardMap.delete(socket.id);
          if (boardMap.size === 0) {
            boardUsersMap.delete(targetBoardId);
          }
        }

        const onlineMembers = getOnlineMembers(targetBoardId);

        io.to(room).emit('member:offline', {
          user: socket.data.user,
          boardId: targetBoardId,
          onlineMembers
        });

        socket.data.boardId = null;

        if (callback) callback({ success: true });
      } catch (error) {
        console.error('[Socket board:leave error]', error);
        if (callback) callback({ success: false, message: error.message });
      }
    });

    // 3. Typing indicator
    socket.on('typing:start', ({ boardId, user, taskId, column }) => {
      const room = `board:${boardId || socket.data.boardId}`;
      socket.to(room).emit('typing:start', {
        user: user || socket.data.user,
        taskId,
        column,
        boardId
      });
    });

    socket.on('typing:stop', ({ boardId, user, taskId, column }) => {
      const room = `board:${boardId || socket.data.boardId}`;
      socket.to(room).emit('typing:stop', {
        user: user || socket.data.user,
        taskId,
        column,
        boardId
      });
    });

    // 4. Board refresh trigger
    socket.on('board:refresh', ({ boardId }) => {
      const room = `board:${boardId || socket.data.boardId}`;
      io.to(room).emit('board:refresh', { boardId });
    });

    // 5. Socket-based Task Actions with MongoDB persistence before broadcast
    socket.on('task:create', async (payload, callback) => {
      try {
        const { boardId, title, description, priority, dueDate, assignedTo, status, position, requestId } = payload;

        if (!boardId || !mongoose.Types.ObjectId.isValid(boardId) || !title?.trim()) {
          if (callback) callback({ success: false, message: 'Invalid board ID or task title' });
          return;
        }

        const validStatuses = ['Todo', 'In Progress', 'Review', 'Done'];
        const taskStatus = validStatuses.includes(status) ? status : 'Todo';

        let taskPosition;
        if (typeof position === 'number' && position >= 0) {
          taskPosition = Math.floor(position);
          await Task.updateMany(
            { board: boardId, status: taskStatus, position: { $gte: taskPosition } },
            { $inc: { position: 1 } }
          );
        } else {
          const last = await Task.findOne({ board: boardId, status: taskStatus }).sort({ position: -1 });
          taskPosition = last ? last.position + 1 : 0;
        }

        const task = new Task({
          board: boardId,
          title: title.trim(),
          description: description || '',
          priority: ['Low', 'Medium', 'High'].includes(priority) ? priority : 'Medium',
          dueDate: dueDate ? new Date(dueDate) : null,
          assignedTo: {
            userId: assignedTo?.userId || '',
            name: assignedTo?.name || 'Unassigned',
            email: assignedTo?.email || ''
          },
          status: taskStatus,
          position: taskPosition
        });

        const savedTask = await task.save();

        io.to(`board:${boardId}`).emit('task:created', {
          task: savedTask,
          boardId,
          requestId
        });

        if (callback) callback({ success: true, data: savedTask });
      } catch (error) {
        console.error('[Socket task:create error]', error);
        if (callback) callback({ success: false, message: error.message });
      }
    });

    socket.on('task:move', async (payload, callback) => {
      try {
        const { taskId, boardId, status, position, requestId } = payload;

        if (!taskId || !mongoose.Types.ObjectId.isValid(taskId) || typeof position !== 'number') {
          if (callback) callback({ success: false, message: 'Invalid task ID or position' });
          return;
        }

        const task = await Task.findById(taskId);
        if (!task) {
          if (callback) callback({ success: false, message: 'Task not found' });
          return;
        }

        const validStatuses = ['Todo', 'In Progress', 'Review', 'Done'];
        const oldStatus = task.status;
        const oldPosition = task.position;
        const targetStatus = status && validStatuses.includes(status) ? status : oldStatus;
        const targetPosition = Math.floor(position);

        if (oldStatus === targetStatus) {
          if (oldPosition !== targetPosition) {
            if (targetPosition > oldPosition) {
              await Task.updateMany(
                { board: task.board, status: oldStatus, position: { $gt: oldPosition, $lte: targetPosition } },
                { $inc: { position: -1 } }
              );
            } else {
              await Task.updateMany(
                { board: task.board, status: oldStatus, position: { $gte: targetPosition, $lt: oldPosition } },
                { $inc: { position: 1 } }
              );
            }
            task.position = targetPosition;
            await task.save();
          }
        } else {
          await Task.updateMany(
            { board: task.board, status: oldStatus, position: { $gt: oldPosition } },
            { $inc: { position: -1 } }
          );
          await Task.updateMany(
            { board: task.board, status: targetStatus, position: { $gte: targetPosition } },
            { $inc: { position: 1 } }
          );
          task.status = targetStatus;
          task.position = targetPosition;
          await task.save();
        }

        io.to(`board:${task.board}`).emit('task:moved', {
          task,
          boardId: task.board.toString(),
          fromStatus: oldStatus,
          toStatus: targetStatus,
          oldPosition,
          newPosition: targetPosition,
          requestId
        });

        if (callback) callback({ success: true, data: task });
      } catch (error) {
        console.error('[Socket task:move error]', error);
        if (callback) callback({ success: false, message: error.message });
      }
    });

    socket.on('task:delete', async (payload, callback) => {
      try {
        const { taskId, requestId } = payload;
        if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
          if (callback) callback({ success: false, message: 'Invalid task ID' });
          return;
        }

        const task = await Task.findById(taskId);
        if (!task) {
          if (callback) callback({ success: false, message: 'Task not found' });
          return;
        }

        const boardId = task.board.toString();
        const taskStatus = task.status;
        const taskPosition = task.position;

        await task.deleteOne();

        await Task.updateMany(
          { board: task.board, status: taskStatus, position: { $gt: taskPosition } },
          { $inc: { position: -1 } }
        );

        io.to(`board:${boardId}`).emit('task:deleted', {
          taskId,
          boardId,
          status: taskStatus,
          requestId
        });

        if (callback) callback({ success: true, data: { taskId, boardId } });
      } catch (error) {
        console.error('[Socket task:delete error]', error);
        if (callback) callback({ success: false, message: error.message });
      }
    });

    // 6. Socket-based Comment Creation
    socket.on('comment:create', async (payload, callback) => {
      try {
        const { taskId, text, author, requestId } = payload;
        if (!taskId || !mongoose.Types.ObjectId.isValid(taskId) || !text?.trim()) {
          if (callback) callback({ success: false, message: 'Invalid task ID or comment text' });
          return;
        }

        const task = await Task.findById(taskId);
        if (!task) {
          if (callback) callback({ success: false, message: 'Task not found' });
          return;
        }

        const commentData = {
          text: text.trim(),
          author: {
            userId: author?.userId || socket.data.user?.userId || 'anonymous',
            name: author?.name || socket.data.user?.name || 'Anonymous',
            email: author?.email || socket.data.user?.email || '',
            color: author?.color || '#6366f1'
          }
        };

        task.comments.push(commentData);
        await task.save();

        const createdComment = task.comments[task.comments.length - 1];

        io.to(`board:${task.board}`).emit('comment:created', {
          taskId: task._id.toString(),
          boardId: task.board.toString(),
          comment: createdComment,
          requestId
        });

        io.to(`board:${task.board}`).emit('task:updated', {
          task,
          boardId: task.board.toString(),
          requestId
        });

        if (callback) callback({ success: true, data: createdComment, task });
      } catch (error) {
        console.error('[Socket comment:create error]', error);
        if (callback) callback({ success: false, message: error.message });
      }
    });

    // 7. Handle Disconnection
    socket.on('disconnect', () => {
      const boardId = socket.data.boardId;
      if (boardId) {
        const boardMap = boardUsersMap.get(boardId);
        if (boardMap) {
          boardMap.delete(socket.id);
          if (boardMap.size === 0) {
            boardUsersMap.delete(boardId);
          }
        }

        const onlineMembers = getOnlineMembers(boardId);
        io.to(`board:${boardId}`).emit('member:offline', {
          user: socket.data.user,
          boardId,
          onlineMembers
        });
      }
    });
  });
};
