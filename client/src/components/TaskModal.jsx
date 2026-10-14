import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { emitTypingStart, emitTypingStop } from '../services/socket.js';
import { addComment } from '../redux/boardSlice.js';
import { X, Calendar, Flag, User, MessageSquare, Send, Clock } from 'lucide-react';

export default function TaskModal({ task, defaultStatus, isOpen, onClose, onSave }) {
  const dispatch = useDispatch();
  const { activeBoard, currentDemoUser, tasks } = useSelector((state) => state.board);

  // Read latest task from Redux store so incoming socket comments appear immediately in real-time
  const liveTask = task?._id ? tasks.find((t) => t._id === task._id) : null;
  const currentTask = liveTask || task;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'Todo',
    dueDate: '',
    assigneeName: '',
    assigneeEmail: ''
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Comments state
  const [newCommentText, setNewCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'Medium',
        status: task.status || 'Todo',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        assigneeName: task.assignedTo?.name || '',
        assigneeEmail: task.assignedTo?.email || ''
      });
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'Medium',
        status: defaultStatus || 'Todo',
        dueDate: '',
        assigneeName: '',
        assigneeEmail: ''
      });
    }
    setError('');
    setCommentError('');
    setNewCommentText('');
  }, [task, defaultStatus, isOpen]);

  // Handle typing broadcast
  const handleTyping = (column) => {
    if (!activeBoard?._id) return;
    emitTypingStart(activeBoard._id, currentDemoUser, currentTask?._id, column || formData.status);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(activeBoard._id, currentDemoUser, currentTask?._id, column || formData.status);
    }, 2500);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');

    if (field === 'title' || field === 'description') {
      handleTyping(formData.status);
    }
  };

  const handleSelectMember = (e) => {
    const val = e.target.value;
    if (val === 'Unassigned') {
      setFormData((prev) => ({ ...prev, assigneeName: 'Unassigned', assigneeEmail: '' }));
      return;
    }
    const member = activeBoard?.members?.find((m) => m.name === val);
    if (member) {
      setFormData((prev) => ({
        ...prev,
        assigneeName: member.name,
        assigneeEmail: member.email || ''
      }));
    } else {
      setFormData((prev) => ({ ...prev, assigneeName: val }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Task title is required');
      return;
    }

    setSubmitting(true);
    try {
      if (activeBoard?._id) {
        emitTypingStop(activeBoard._id, currentDemoUser, currentTask?._id, formData.status);
      }

      await onSave({
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        assignedTo: {
          name: formData.assigneeName.trim() || 'Unassigned',
          email: formData.assigneeEmail.trim() || '',
          userId: `user_${formData.assigneeName.toLowerCase().replace(/\s+/g, '_')}`
        }
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Comment Handler
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) {
      setCommentError('Comment cannot be empty');
      return;
    }

    if (!currentTask?._id) {
      setCommentError('Save the task first before adding comments');
      return;
    }

    setCommentSubmitting(true);
    setCommentError('');

    try {
      await dispatch(
        addComment({
          taskId: currentTask._id,
          text: newCommentText.trim(),
          author: {
            userId: currentDemoUser.userId,
            name: currentDemoUser.name,
            email: currentDemoUser.email,
            color: currentDemoUser.color || '#6366f1'
          }
        })
      ).unwrap();

      setNewCommentText('');
      // Scroll to newest comment
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setCommentError(err.message || 'Failed to post comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const formatCommentDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  const comments = currentTask?.comments || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-task-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{currentTask?._id ? 'Task Details & Activity' : 'Create New Task'}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}

            {/* Title */}
            <div className="form-group">
              <label>Task Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Implement Socket.IO reconnect logic"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Add helpful details, acceptance criteria, or links..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            {/* Status & Priority */}
            <div className="form-row">
              <div className="form-group">
                <label>Status Column</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select
                  className="form-select"
                  value={formData.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                >
                  <option value="High">🔴 High</option>
                  <option value="Medium">🟡 Medium</option>
                  <option value="Low">🟢 Low</option>
                </select>
              </div>
            </div>

            {/* Due Date & Assignee */}
            <div className="form-row">
              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.dueDate}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Assigned Member</label>
                <select
                  className="form-select"
                  value={formData.assigneeName}
                  onChange={handleSelectMember}
                >
                  <option value="">Choose member...</option>
                  <option value="Unassigned">Unassigned</option>
                  {activeBoard?.members?.map((m) => (
                    <option key={m.userId || m.name} value={m.name}>
                      {m.name} ({m.role || 'member'})
                    </option>
                  ))}
                  {currentDemoUser &&
                    !activeBoard?.members?.some((m) => m.name === currentDemoUser.name) && (
                      <option value={currentDemoUser.name}>{currentDemoUser.name} (You)</option>
                    )}
                </select>
              </div>
            </div>

            {/* Comments Section (Visible when editing an existing task) */}
            {currentTask?._id ? (
              <div className="comments-section">
                <div className="comments-section-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={16} color="#818cf8" />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                      Comments ({comments.length})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Real-time collaborative discussion
                  </span>
                </div>

                {commentError && <div className="error-banner">{commentError}</div>}

                {/* Comments List */}
                <div className="comments-list">
                  {comments.length > 0 ? (
                    comments.map((comment) => (
                      <div key={comment._id} className="comment-bubble">
                        <div
                          className="comment-avatar"
                          style={{
                            backgroundColor: comment.author?.color || '#6366f1'
                          }}
                        >
                          {(comment.author?.name || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div className="comment-content">
                          <div className="comment-meta">
                            <span className="comment-author-name">
                              {comment.author?.name || 'Anonymous'}
                            </span>
                            <span className="comment-time">
                              {formatCommentDate(comment.createdAt)}
                            </span>
                          </div>
                          <p className="comment-text">{comment.text}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="comments-empty">
                      <MessageSquare size={20} opacity={0.3} />
                      <span>No comments yet. Be the first to share an update!</span>
                    </div>
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* Add Comment Input */}
                <div className="comment-input-box">
                  <div
                    className="comment-avatar"
                    style={{ backgroundColor: currentDemoUser.color || '#6366f1', flexShrink: 0 }}
                    title={`Commenting as ${currentDemoUser.name}`}
                  >
                    {currentDemoUser.name.charAt(0)}
                  </div>
                  <input
                    type="text"
                    className="form-input comment-text-input"
                    placeholder={`Comment as ${currentDemoUser.name}...`}
                    value={newCommentText}
                    onChange={(e) => {
                      setNewCommentText(e.target.value);
                      setCommentError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment(e);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm comment-submit-btn"
                    onClick={handleAddComment}
                    disabled={commentSubmitting || !newCommentText.trim()}
                  >
                    <Send size={14} />
                    <span>Post</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="comments-note">
                <MessageSquare size={14} opacity={0.5} />
                <span>Comments can be added once the task is created.</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : currentTask?._id ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
