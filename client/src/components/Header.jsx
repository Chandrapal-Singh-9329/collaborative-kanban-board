import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setDemoUser,
  DEMO_USERS,
  setActiveBoard,
  fetchBoardById
} from '../redux/boardSlice.js';
import { joinBoard, leaveBoard } from '../services/socket.js';
import { Kanban, Plus, ChevronDown, Check, UserCircle, ExternalLink } from 'lucide-react';

export default function Header({ onOpenCreateBoard, onOpenShareLink }) {
  const dispatch = useDispatch();
  const { boards, activeBoard, currentDemoUser } = useSelector((state) => state.board);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBoardMenu, setShowBoardMenu] = useState(false);

  const handleSelectBoard = (board) => {
    if (activeBoard?._id !== board._id) {
      if (activeBoard?._id) {
        leaveBoard(activeBoard._id);
      }
      dispatch(setActiveBoard(board));
      dispatch(fetchBoardById(board._id));
      joinBoard(board._id, currentDemoUser);

      // Update URL query param without full reload
      const url = new URL(window.location.href);
      url.searchParams.set('board', board._id);
      window.history.pushState({}, '', url);
    }
    setShowBoardMenu(false);
  };

  const handleSelectUser = (user) => {
    dispatch(setDemoUser(user));
    if (activeBoard?._id) {
      // Re-announce presence with updated identity
      joinBoard(activeBoard._id, user);
    }
    setShowUserMenu(false);
  };

  return (
    <header className="top-nav">
      <div className="brand" onClick={() => setShowBoardMenu(!showBoardMenu)}>
        <div className="brand-logo">
          <Kanban size={20} />
        </div>
        <div className="brand-text">
          <h1>
            Appsica Kanban
            <span className="brand-badge">Real-Time</span>
          </h1>
        </div>
      </div>

      <div className="nav-controls">
        {/* Board Switcher Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowBoardMenu(!showBoardMenu)}
            style={{ fontWeight: 600 }}
          >
            <span>{activeBoard ? activeBoard.title : 'Select Board'}</span>
            <ChevronDown size={14} />
          </button>

          {showBoardMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                background: '#131b2e',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                width: '240px',
                zIndex: 60,
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '6px'
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '6px 8px'
                }}
              >
                Available Boards
              </div>

              {boards.map((b) => (
                <div
                  key={b._id}
                  onClick={() => handleSelectBoard(b)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: activeBoard?._id === b._id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    color: activeBoard?._id === b._id ? '#818cf8' : '#e2e8f0',
                    fontSize: '0.84rem'
                  }}
                >
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.title}
                  </span>
                  {activeBoard?._id === b._id && <Check size={14} />}
                </div>
              ))}

              <div style={{ borderTop: '1px solid #1e293b', marginTop: '6px', paddingTop: '6px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setShowBoardMenu(false);
                    onOpenCreateBoard();
                  }}
                >
                  <Plus size={14} />
                  New Board
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Demo Persona Switcher */}
        <div style={{ position: 'relative' }}>
          <div
            className="user-switcher"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title="Switch demo persona to test collaborative presence"
          >
            <div
              className="user-avatar-chip"
              style={{ backgroundColor: currentDemoUser.color || '#6366f1' }}
            >
              {currentDemoUser.name.charAt(0)}
            </div>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{currentDemoUser.name}</span>
            <ChevronDown size={14} color="#94a3b8" />
          </div>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                background: '#131b2e',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                width: '260px',
                zIndex: 60,
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '8px'
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '4px 8px 8px 8px'
                }}
              >
                Collaborator Persona (Demo)
              </div>
              {DEMO_USERS.map((user) => (
                <div
                  key={user.userId}
                  onClick={() => handleSelectUser(user)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    background:
                      currentDemoUser.userId === user.userId
                        ? 'rgba(99, 102, 241, 0.15)'
                        : 'transparent',
                    color: currentDemoUser.userId === user.userId ? '#818cf8' : '#e2e8f0',
                    fontSize: '0.84rem'
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: user.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{user.email}</div>
                  </div>
                  {currentDemoUser.userId === user.userId && <Check size={14} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
