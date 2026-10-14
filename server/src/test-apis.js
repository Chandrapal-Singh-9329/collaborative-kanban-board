import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🧪 Starting Full Backend Test Suite...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, name, details) => {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}:`, details || '');
      failed++;
    }
  };

  try {
    // 1. Health check
    const healthRes = await axios.get(`${API_BASE}/health`);
    assert(healthRes.status === 200 && healthRes.data.status === 'ok', 'GET /api/health');

    // 2. Create Board
    const createBoardRes = await axios.post(`${API_BASE}/boards`, {
      title: 'Sprint 1 Kanban',
      description: 'Development tracking board',
      createdBy: {
        userId: 'lead_dev',
        name: 'Tech Lead',
        email: 'lead@appsica.com'
      }
    });
    assert(
      createBoardRes.status === 201 && createBoardRes.data.success && createBoardRes.data.data._id,
      'POST /api/boards (Create Board)'
    );

    const boardId = createBoardRes.data.data._id;
    console.log(`   Board ID created: ${boardId}`);

    // 3. Add Member
    const addMemberRes = await axios.post(`${API_BASE}/boards/${boardId}/members`, {
      userId: 'dev_alex',
      name: 'Alex Johnson',
      email: 'alex@appsica.com',
      role: 'member'
    });
    assert(
      addMemberRes.status === 200 &&
        addMemberRes.data.data.members.some((m) => m.email === 'alex@appsica.com'),
      'POST /api/boards/:id/members (Add Member)'
    );

    // 4. Get Board By ID
    const getBoardRes = await axios.get(`${API_BASE}/boards/${boardId}`);
    assert(
      getBoardRes.status === 200 &&
        getBoardRes.data.data._id === boardId &&
        Array.isArray(getBoardRes.data.data.tasks),
      'GET /api/boards/:id (Get Board and Tasks)'
    );

    // 5. Create Task 1 (Todo)
    const task1Res = await axios.post(`${API_BASE}/boards/${boardId}/tasks`, {
      title: 'Design Authentication Schema',
      description: 'Define JWT and refresh token handling',
      priority: 'High',
      status: 'Todo',
      assignedTo: {
        userId: 'dev_alex',
        name: 'Alex Johnson',
        email: 'alex@appsica.com'
      }
    });
    assert(
      task1Res.status === 201 && task1Res.data.data.position === 0,
      'POST /api/boards/:id/tasks (Create Task 1)'
    );
    const task1Id = task1Res.data.data._id;

    // 6. Create Task 2 (Todo)
    const task2Res = await axios.post(`${API_BASE}/boards/${boardId}/tasks`, {
      title: 'Setup Socket.IO Rooms',
      description: 'Implement board-specific rooms and presence',
      priority: 'High',
      status: 'Todo'
    });
    assert(
      task2Res.status === 201 && task2Res.data.data.position === 1,
      'POST /api/boards/:id/tasks (Create Task 2 with auto-increment position)'
    );
    const task2Id = task2Res.data.data._id;

    // 7. Create Task 3 (In Progress)
    const task3Res = await axios.post(`${API_BASE}/boards/${boardId}/tasks`, {
      title: 'Setup Redux Store',
      priority: 'Medium',
      status: 'In Progress'
    });
    assert(
      task3Res.status === 201 && task3Res.data.data.status === 'In Progress',
      'POST /api/boards/:id/tasks (Create Task 3 in In Progress)'
    );
    const task3Id = task3Res.data.data._id;

    // 8. Update Task
    const updateTaskRes = await axios.patch(`${API_BASE}/tasks/${task1Id}`, {
      title: 'Design Authentication & Session Schema',
      priority: 'High',
      description: 'Updated with OAuth specifications'
    });
    assert(
      updateTaskRes.status === 200 &&
        updateTaskRes.data.data.title === 'Design Authentication & Session Schema',
      'PATCH /api/tasks/:id (Update Task Details)'
    );

    // 9. Move Task (Cross-column: Todo -> In Progress at position 0)
    const moveTaskRes = await axios.patch(`${API_BASE}/tasks/${task1Id}/move`, {
      status: 'In Progress',
      position: 0
    });
    assert(
      moveTaskRes.status === 200 &&
        moveTaskRes.data.data.status === 'In Progress' &&
        moveTaskRes.data.data.position === 0,
      'PATCH /api/tasks/:id/move (Move Task Cross-column)'
    );

    // 10. Verify Board Tasks ordering after move
    const boardAfterMove = await axios.get(`${API_BASE}/boards/${boardId}`);
    const inProgressTasks = boardAfterMove.data.data.tasks.filter(
      (t) => t.status === 'In Progress'
    );
    assert(
      inProgressTasks.length === 2 &&
        inProgressTasks[0]._id === task1Id &&
        inProgressTasks[1]._id === task3Id,
      'Task ordering verified in DB after cross-column move'
    );

    // 11. Comments API Tests
    // 11a. Reject empty comment
    try {
      await axios.post(`${API_BASE}/tasks/${task1Id}/comments`, { text: '   ' });
      assert(false, 'POST /api/tasks/:id/comments (Reject empty comment)', 'Expected 400');
    } catch (err) {
      assert(
        err.response?.status === 400,
        'POST /api/tasks/:id/comments (Reject empty comment validation)'
      );
    }

    // 11b. Add valid comment
    const addCommentRes = await axios.post(`${API_BASE}/tasks/${task1Id}/comments`, {
      text: 'Verified JWT token expiry and OAuth redirect flow',
      author: {
        userId: 'dev_alex',
        name: 'Alex Johnson',
        email: 'alex@appsica.com'
      }
    });
    assert(
      addCommentRes.status === 201 &&
        addCommentRes.data.data.text === 'Verified JWT token expiry and OAuth redirect flow' &&
        addCommentRes.data.data.author.name === 'Alex Johnson',
      'POST /api/tasks/:id/comments (Add Valid Comment)'
    );

    // 11c. Fetch comments for task
    const getCommentsRes = await axios.get(`${API_BASE}/tasks/${task1Id}/comments`);
    assert(
      getCommentsRes.status === 200 &&
        Array.isArray(getCommentsRes.data.data) &&
        getCommentsRes.data.data.some((c) => c.text.includes('JWT token expiry')),
      'GET /api/tasks/:id/comments (Fetch Task Comments)'
    );

    // 12. Delete Task
    const deleteTaskRes = await axios.delete(`${API_BASE}/tasks/${task2Id}`);
    assert(
      deleteTaskRes.status === 200 && deleteTaskRes.data.success,
      'DELETE /api/tasks/:id (Delete Task)'
    );

    // 13. Socket.IO Test
    console.log('\n🔌 Testing Socket.IO Integration...');
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: false
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket connection timed out'));
      }, 5000);

      socket.on('connect', () => {
        assert(socket.connected, 'Socket.IO Connection Established');

        // Test board:join
        socket.emit(
          'board:join',
          {
            boardId,
            user: { userId: 'tester_1', name: 'Tester', email: 'tester@appsica.com' }
          },
          (res) => {
            assert(res && res.success, 'Socket event board:join');

            // Test typing:start broadcast
            socket.emit('typing:start', {
              boardId,
              user: { userId: 'tester_1', name: 'Tester' },
              taskId: task1Id,
              column: 'In Progress'
            });
            assert(true, 'Socket event typing:start');

            // Test typing:stop
            socket.emit('typing:stop', {
              boardId,
              user: { userId: 'tester_1', name: 'Tester' },
              taskId: task1Id,
              column: 'In Progress'
            });
            assert(true, 'Socket event typing:stop');

            // Test socket comment:create
            socket.emit(
              'comment:create',
              {
                taskId: task1Id,
                text: 'Socket real-time comment verification',
                author: { userId: 'tester_1', name: 'Tester' }
              },
              (commentRes) => {
                assert(
                  commentRes && commentRes.success && commentRes.data?.text === 'Socket real-time comment verification',
                  'Socket event comment:create'
                );

                // Test board:leave
                socket.emit('board:leave', { boardId }, (leaveRes) => {
                  assert(leaveRes && leaveRes.success, 'Socket event board:leave');
                  clearTimeout(timeout);
                  socket.disconnect();
                  resolve();
                });
              }
            );
          }
        );
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log(`\n===========================================`);
    console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`===========================================\n`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test error:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTests();
