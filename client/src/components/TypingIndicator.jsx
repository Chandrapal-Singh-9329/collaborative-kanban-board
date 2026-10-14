import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { cleanupStaleTyping } from '../redux/boardSlice.js';

export default function TypingIndicator() {
  const dispatch = useDispatch();
  const typingUsers = useSelector((state) => state.board.typingUsers);

  // Periodic cleanup of stale typing indicators (>4s without update)
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(cleanupStaleTyping());
    }, 2000);
    return () => clearInterval(interval);
  }, [dispatch]);

  const activeTypers = Object.values(typingUsers);

  if (activeTypers.length === 0) {
    return <div style={{ height: '14px' }} />;
  }

  const names = activeTypers.map((t) => t.name).join(', ');
  const location = activeTypers[0]?.column ? ` in ${activeTypers[0].column}` : '';

  return (
    <div className="typing-bar">
      <div className="typing-dots">
        <span />
        <span />
      </div>
      <span>
        {names} {activeTypers.length === 1 ? 'is' : 'are'} typing{location}...
      </span>
    </div>
  );
}
