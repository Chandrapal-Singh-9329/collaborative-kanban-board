import mongoose from 'mongoose';

const assignedToSchema = new mongoose.Schema(
  {
    userId: { type: String, default: '' },
    name: { type: String, default: 'Unassigned' },
    email: { type: String, default: '' }
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    author: {
      userId: { type: String, default: 'anonymous' },
      name: { type: String, default: 'Anonymous' },
      email: { type: String, default: '' },
      color: { type: String, default: '#6366f1' }
    }
  },
  {
    timestamps: true
  }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: [true, 'Filename is required']
    },
    originalName: {
      type: String,
      required: [true, 'Original filename is required']
    },
    mimetype: {
      type: String,
      required: [true, 'MIME type is required']
    },
    size: {
      type: Number,
      required: [true, 'File size is required']
    },
    url: {
      type: String,
      required: [true, 'Attachment URL is required']
    },
    uploadedBy: {
      userId: { type: String, default: 'anonymous' },
      name: { type: String, default: 'Anonymous' },
      email: { type: String, default: '' }
    }
  },
  {
    timestamps: true
  }
);

const taskSchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'Task must belong to a board'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Task title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    priority: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High'],
        message: '{VALUE} is not a valid priority. Use Low, Medium, or High.'
      },
      default: 'Medium'
    },
    dueDate: {
      type: Date,
      default: null
    },
    assignedTo: {
      type: assignedToSchema,
      default: () => ({ userId: '', name: 'Unassigned', email: '' })
    },
    status: {
      type: String,
      enum: {
        values: ['Todo', 'In Progress', 'Review', 'Done'],
        message: '{VALUE} is not a valid status. Use Todo, In Progress, Review, or Done.'
      },
      default: 'Todo',
      index: true
    },
    position: {
      type: Number,
      required: [true, 'Task position is required'],
      min: [0, 'Position must be a non-negative number'],
      default: 0
    },
    comments: {
      type: [commentSchema],
      default: []
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying tasks by board and status ordered by position
taskSchema.index({ board: 1, status: 1, position: 1 });

export const Task = mongoose.model('Task', taskSchema);
