import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member'
    }
  },
  { _id: false }
);

const createdBySchema = new mongoose.Schema(
  {
    userId: { type: String, default: 'anonymous' },
    name: { type: String, default: 'Guest User' },
    email: { type: String, default: '' }
  },
  { _id: false }
);

const boardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Board title is required'],
      trim: true,
      maxlength: [100, 'Board title cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: createdBySchema,
      default: () => ({ userId: 'anonymous', name: 'Guest User', email: '' })
    },
    members: {
      type: [memberSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const Board = mongoose.model('Board', boardSchema);
