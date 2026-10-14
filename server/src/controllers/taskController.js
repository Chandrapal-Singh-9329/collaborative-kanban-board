import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { Board } from '../models/Board.js';

const VALID_STATUSES = ['Todo', 'In Progress', 'Review', 'Done'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

// @desc    Create a new task in a board
// @route   POST /api/boards/:id/tasks
export const createTask = async (req, res, next) => {
  try {
    const { id: boardId } = req.params;
    const {
      title,
      description = '',
      priority = 'Medium',
      dueDate = null,
      assignedTo,
      status = 'Todo',
      position,
      requestId
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Board ID format: ${boardId}`
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    const taskStatus = VALID_STATUSES.includes(status) ? status : 'Todo';
    const taskPriority = VALID_PRIORITIES.includes(priority) ? priority : 'Medium';

    // Calculate position
    let taskPosition;
    if (typeof position === 'number' && position >= 0) {
      taskPosition = Math.floor(position);
      // Shift existing tasks at or after this position
      await Task.updateMany(
        { board: boardId, status: taskStatus, position: { $gte: taskPosition } },
        { $inc: { position: 1 } }
      );
    } else {
      // Put at the end of the column
      const lastTask = await Task.findOne({ board: boardId, status: taskStatus })
        .sort({ position: -1 })
        .select('position');
      taskPosition = lastTask && typeof lastTask.position === 'number' ? lastTask.position + 1 : 0;
    }

    const task = new Task({
      board: boardId,
      title: title.trim(),
      description: description?.trim() || '',
      priority: taskPriority,
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

    // Broadcast real-time event to board room
    const io = req.app.get('io');
    if (io) {
      io.to(`board:${boardId}`).emit('task:created', {
        task: savedTask,
        boardId,
        requestId
      });
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: savedTask
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task details
// @route   PATCH /api/tasks/:id
export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, assignedTo, status, requestId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Task ID format: ${id}`
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Task title cannot be empty'
        });
      }
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description.trim();
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Valid options: ${VALID_PRIORITIES.join(', ')}`
        });
      }
      task.priority = priority;
    }

    if (dueDate !== undefined) {
      task.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (assignedTo !== undefined) {
      task.assignedTo = {
        userId: assignedTo.userId || '',
        name: assignedTo.name || 'Unassigned',
        email: assignedTo.email || ''
      };
    }

    // If status is updated directly via PATCH /api/tasks/:id without moveTask endpoint
    if (status !== undefined && status !== task.status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid options: ${VALID_STATUSES.join(', ')}`
        });
      }

      const oldStatus = task.status;
      const oldPosition = task.position;

      // Decrement following positions in old status column
      await Task.updateMany(
        { board: task.board, status: oldStatus, position: { $gt: oldPosition } },
        { $inc: { position: -1 } }
      );

      // Append to the end of new status column
      const lastTaskInNewCol = await Task.findOne({ board: task.board, status })
        .sort({ position: -1 })
        .select('position');

      task.status = status;
      task.position = lastTaskInNewCol ? lastTaskInNewCol.position + 1 : 0;
    }

    const updatedTask = await task.save();

    // Broadcast real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`board:${task.board}`).emit('task:updated', {
        task: updatedTask,
        boardId: task.board.toString(),
        requestId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Move or reorder a task
// @route   PATCH /api/tasks/:id/move
export const moveTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, position, requestId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Task ID format: ${id}`
      });
    }

    if (position === undefined || typeof position !== 'number' || position < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid non-negative position is required'
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const oldStatus = task.status;
    const oldPosition = task.position;
    const targetStatus = status && VALID_STATUSES.includes(status) ? status : oldStatus;
    const targetPosition = Math.floor(position);

    const isSameColumn = oldStatus === targetStatus;

    if (isSameColumn) {
      // Reordering within the same status column
      if (oldPosition !== targetPosition) {
        if (targetPosition > oldPosition) {
          // Task moved down: shift intermediate tasks up (-1)
          await Task.updateMany(
            {
              board: task.board,
              status: oldStatus,
              position: { $gt: oldPosition, $lte: targetPosition }
            },
            { $inc: { position: -1 } }
          );
        } else {
          // Task moved up: shift intermediate tasks down (+1)
          await Task.updateMany(
            {
              board: task.board,
              status: oldStatus,
              position: { $gte: targetPosition, $lt: oldPosition }
            },
            { $inc: { position: 1 } }
          );
        }

        task.position = targetPosition;
        await task.save();
      }
    } else {
      // Moving across columns
      // 1. Shift remaining tasks in old column down
      await Task.updateMany(
        {
          board: task.board,
          status: oldStatus,
          position: { $gt: oldPosition }
        },
        { $inc: { position: -1 } }
      );

      // 2. Shift tasks in target column at or after targetPosition up
      await Task.updateMany(
        {
          board: task.board,
          status: targetStatus,
          position: { $gte: targetPosition }
        },
        { $inc: { position: 1 } }
      );

      task.status = targetStatus;
      task.position = targetPosition;
      await task.save();
    }

    // Broadcast task:moved event to board room
    const io = req.app.get('io');
    if (io) {
      io.to(`board:${task.board}`).emit('task:moved', {
        task,
        boardId: task.board.toString(),
        fromStatus: oldStatus,
        toStatus: targetStatus,
        oldPosition,
        newPosition: targetPosition,
        requestId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task moved successfully',
      data: task
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { requestId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Task ID format: ${id}`
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const boardId = task.board.toString();
    const taskStatus = task.status;
    const taskPosition = task.position;

    await task.deleteOne();

    // Reorder remaining tasks in that status column
    await Task.updateMany(
      {
        board: task.board,
        status: taskStatus,
        position: { $gt: taskPosition }
      },
      { $inc: { position: -1 } }
    );

    // Broadcast real-time deletion
    const io = req.app.get('io');
    if (io) {
      io.to(`board:${boardId}`).emit('task:deleted', {
        taskId: id,
        boardId,
        status: taskStatus,
        requestId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      data: { taskId: id, boardId, status: taskStatus }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all comments for a task
// @route   GET /api/tasks/:id/comments
export const getComments = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Task ID format: ${id}`
      });
    }

    const task = await Task.findById(id).select('comments');
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.status(200).json({
      success: true,
      data: task.comments || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a comment to a task
// @route   POST /api/tasks/:id/comments
export const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text, author, requestId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Task ID format: ${id}`
      });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required and cannot be empty'
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const commentData = {
      text: text.trim(),
      author: {
        userId: author?.userId || 'anonymous',
        name: author?.name || 'Anonymous',
        email: author?.email || '',
        color: author?.color || '#6366f1'
      }
    };

    task.comments.push(commentData);
    await task.save();

    const createdComment = task.comments[task.comments.length - 1];

    // Broadcast comment:created and task:updated to the board room
    const io = req.app.get('io');
    if (io) {
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
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: createdComment,
      task
    });
  } catch (error) {
    next(error);
  }
};

