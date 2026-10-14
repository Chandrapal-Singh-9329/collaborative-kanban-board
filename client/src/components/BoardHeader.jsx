import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, UserPlus, Share2, Check, Users } from 'lucide-react';

export default function BoardHeader({ onOpenAddTask, onOpenAddMember }) {
  const { activeBoard, onlineMembers } = useSelector((state) => state.board);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!activeBoard) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?board=${activeBoard._id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!activeBoard) return null;

  return (
    <div className="board-header">
      <div className="board-header-top">
        <div className="board-title-section">
          <div>
            <h2 className="board-title">{activeBoard.title}</h2>
            <p className="board-desc">
              {activeBoard.description || 'Drag and drop cards across columns to update workflow state in real-time.'}
            </p>
          </div>
        </div>

        <div className="board-header-actions">
          {/* Share Board Link */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleCopyLink}
            title="Copy board URL to open in a second browser session"
          >
            {copied ? <Check size={14} color="#10b981" /> : <Share2 size={14} />}
            <span>{copied ? 'Link Copied!' : 'Share Board'}</span>
          </button>

          {/* Add / Invite Member */}
          <button className="btn btn-secondary btn-sm" onClick={onOpenAddMember}>
            <UserPlus size={14} />
            <span>Invite Member</span>
          </button>

          {/* Add Task Button */}
          <button className="btn btn-primary" onClick={() => onOpenAddTask()}>
            <Plus size={16} />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Online Collaborators Presence */}
      <div className="online-members-bar">
        <div className="presence-label">
          <span className="pulse-dot" />
          <span>Live Collaborators ({onlineMembers.length}):</span>
        </div>

        <div className="avatar-stack">
          {onlineMembers.length > 0 ? (
            onlineMembers.map((member, i) => (
              <div
                key={member.userId || i}
                className="member-avatar"
                style={{
                  backgroundColor: ['#6366f1', '#06b6d4', '#ec4899', '#10b981', '#f59e0b'][i % 5]
                }}
                title={`${member.name} (${member.email || 'Online'})`}
              >
                {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
              </div>
            ))
          ) : (
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Connecting presence...</span>
          )}
        </div>
      </div>
    </div>
  );
}
