import express from 'express';
import {
  createBoard,
  getAllBoards,
  getBoardById,
  addMember,
  deleteBoard
} from '../controllers/boardController.js';
import { createTask } from '../controllers/taskController.js';

const router = express.Router();

// Board management
router.route('/')
  .post(createBoard)
  .get(getAllBoards);

router.route('/:id')
  .get(getBoardById)
  .delete(deleteBoard);

// Members
router.route('/:id/members')
  .post(addMember);

// Board Tasks
router.route('/:id/tasks')
  .post(createTask);

export default router;
