import mongoose from 'mongoose';
import { Board } from '../models/Board.js';
import { Task } from '../models/Task.js';

// @desc    Create a new board
// @route   POST /api/boards
export const createBoard = async (req, res, next) => {
  try {
    const { title, description, createdBy } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Board title is required'
      });
    }

    const creator = {
      userId: createdBy?.userId || `user_${Date.now()}`,
      name: createdBy?.name || 'Guest User',
      email: createdBy?.email || 'guest@example.com'
    };

    const board = new Board({
      title: title.trim(),
      description: description?.trim() || '',
      createdBy: creator,
      members: [
        {
          userId: creator.userId,
          name: creator.name,
          email: creator.email,
          role: 'owner'
        }
      ]
    });

    const savedBoard = await board.save();

    res.status(201).json({
      success: true,
      message: 'Board created successfully',
      data: savedBoard
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all boards
// @route   GET /api/boards
export const getAllBoards = async (req, res, next) => {
  try {
    const boards = await Board.find().sort({ updatedAt: -1 }).lean();

    // Attach task counts to each board for UI convenience
    const boardIds = boards.map((b) => b._id);
    const taskCounts = await Task.aggregate([
      { $match: { board: { $in: boardIds } } },
      { $group: { _id: '$board', count: { $sum: 1 } } }
    ]);

    const countMap = taskCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const boardsWithCounts = boards.map((board) => ({
      ...board,
      taskCount: countMap[board._id.toString()] || 0
    }));

    res.status(200).json({
      success: true,
      data: boardsWithCounts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get board by ID and all its tasks
// @route   GET /api/boards/:id
export const getBoardById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Board ID format: ${id}`
      });
    }

    const board = await Board.findById(id).lean();

    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Fetch all tasks for this board, sorted by status and position
    const tasks = await Task.find({ board: id })
      .sort({ status: 1, position: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...board,
        tasks
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add / invite member to board
// @route   POST /api/boards/:id/members
export const addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, name, email, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Board ID format: ${id}`
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Member name is required'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Member email is required'
      });
    }

    const board = await Board.findById(id);

    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUserId = userId || `user_${Date.now()}`;

    // Check if member already exists
    const exists = board.members.some(
      (m) => m.email.toLowerCase() === cleanEmail || (userId && m.userId === userId)
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Member is already part of this board'
      });
    }

    const newMember = {
      userId: cleanUserId,
      name: name.trim(),
      email: cleanEmail,
      role: role && ['owner', 'admin', 'member'].includes(role) ? role : 'member'
    };

    board.members.push(newMember);
    await board.save();

    // Broadcast member added event if Socket.IO is initialized
    const io = req.app.get('io');
    if (io) {
      io.to(`board:${id}`).emit('board:refresh', {
        boardId: id,
        type: 'member:added',
        member: newMember
      });
    }

    res.status(200).json({
      success: true,
      message: 'Member added successfully',
      data: board
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete board and associated tasks
// @route   DELETE /api/boards/:id
export const deleteBoard = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Board ID format: ${id}`
      });
    }

    const board = await Board.findByIdAndDelete(id);

    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Delete all tasks belonging to this board
    await Task.deleteMany({ board: id });

    const io = req.app.get('io');
    if (io) {
      io.to(`board:${id}`).emit('board:refresh', {
        boardId: id,
        type: 'board:deleted'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Board and all its tasks were deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
