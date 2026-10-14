import express from 'express';
import {
  updateTask,
  moveTask,
  deleteTask,
  getComments,
  addComment
} from '../controllers/taskController.js';

const router = express.Router();

router.route('/:id')
  .patch(updateTask)
  .delete(deleteTask);

router.route('/:id/move')
  .patch(moveTask);

router.route('/:id/comments')
  .get(getComments)
  .post(addComment);

export default router;
