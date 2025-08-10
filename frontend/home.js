import { authFetch } from './authFetch.js';

// socket.io loaded from CDN in home.html as window.io
let socket = null;
let me = null; // { id, username, ... }
let onlineUsers = new Set(); // lưu userId đang online

document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();         // sets `me`
  initSocket();                // init socket after we have `me`
  loadUserSuggestions();       // list
  setupUIListeners();
});

function setupUIListeners() {
  document.getElementById('edit-profile').addEventListener('click', openModal);

  document.getElementById('profile-avatar').addEventListener('click', () => {
    const img = document.querySelector('#profile-avatar img');
    if (img) {
      document.getElementById('modal-avatar-img').src = img.src;
      document.getElementById('avatar-modal').classList.remove('hidden');
    }
  });

  document.getElementById('close-avatar-modal').addEventListener('click', () => {
    document.getElementById('avatar-modal').classList.add('hidden');
  });

  // Delegate clicks inside user list
  document.getElementById('user-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const userId = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'add') {
      const ok = await sendFriendRequest(userId);
      if (ok && socket && me) {
        socket.emit('friend:send_request', { senderId: me.id, receiverId: userId });
      }
    } else if (action === 'unfriend') {
      const ok = await unfriend(userId);
      if (ok && socket && me) {
        socket.emit('friend:unfriend', { userId: me.id, friendId: userId });
      }
    } else if (action === 'accept') {
      const ok = await acceptRequest(userId); // userId ở đây là requestId
      if (ok && socket && me) {
        socket.emit('friend:accept_request', { senderId: btn.dataset.senderId || null, receiverId: me.id });
      }
    } else if (action === 'decline') {
      const ok = await declineRequest(userId);
      if (ok && socket && me) {
        socket.emit('friend:decline_request', { senderId: btn.dataset.senderId || null, receiverId: me.id });
      }
    }

    await loadUserSuggestions();
    await loadProfile();
  });
}

// ----------------- socket init -----------------
function initSocket() {
  if (typeof window.io === 'undefined') {
    console.warn('Socket.io client not found.');
    return;
  }

  socket = window.io();

  socket.on('connect', () => {
    console.log('socket connected', socket.id);
    if (me && me.id) {
      socket.emit('register', me.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected');
  });

  // --- xử lý user online/offline ---
  socket.on('users:online_list', ({ online }) => {
    onlineUsers = new Set(online.map(String));
    updateUserListOnlineStatus();
  });

  socket.on('user:online', ({ userId }) => {
    onlineUsers.add(String(userId));
    updateUserListOnlineStatus();
  });

  socket.on('user:offline', ({ userId }) => {
    onlineUsers.delete(String(userId));
    updateUserListOnlineStatus();
  });

  // --- Friend events ---
  socket.on('friend:request_received', async ({ senderId }) => {
    console.log('Realtime: request received from', senderId);
    await loadUserSuggestions();
  });

  socket.on('friend:request_sent', async ({ receiverId, senderId }) => {
    if (senderId !== me.id) { 
      await loadUserSuggestions();
    }
  });

  socket.on('friend:request_accepted', async ({ senderId, receiverId }) => {
    console.log('Realtime: request accepted', { senderId, receiverId });
    await loadUserSuggestions();
    await loadProfile();
  });

  socket.on('friend:request_declined', async ({ senderId, receiverId }) => {
    console.log('Realtime: request declined', { senderId, receiverId });
    await loadUserSuggestions();
  });

  socket.on('friend:unfriended', async ({ by, friendId }) => {
    console.log('Realtime: unfriended', by, friendId);
    await loadUserSuggestions();
    await loadProfile();
  });

  socket.on('friend:update_count', async () => {
    await loadProfile();
  });
}

function updateUserListOnlineStatus() {
  document.querySelectorAll('.user-item .user-avatar').forEach(img => {
    const userId = img.dataset.userid;
    if (onlineUsers.has(userId)) {
      img.style.border = '3px solid #00E676';
    } else {
      img.style.border = '3px solid red';
    }
    img.style.borderRadius = '50%';
  });
}

// ----------------- Profile & UI / API helpers -----------------
async function loadProfile() {
  const res = await authFetch('/api/users/me');
  if (!res) return console.error('Không lấy được profile');
  const data = await res.json();
  me = data;
  document.getElementById('profile-avatar').innerHTML =
    `<img src="${data.avatar || 'default-avatar.png'}" alt="avatar">`;
  document.getElementById('profile-username').textContent = data.username;
  document.getElementById('profile-bio').textContent = data.bio || 'Chưa có giới thiệu';
  document.getElementById('profile-friends-count').textContent = `Bạn bè: ${data.friends_count}`;
  document.getElementById('edit-username').value = data.username;
  document.getElementById('edit-bio').value = data.bio || '';
}

async function loadUserSuggestions() {
  const res = await authFetch('/api/users');
  if (!res.ok) return console.error('Không tải được danh sách users');
  const users = await res.json();
  const listEl = document.getElementById('user-list');
  listEl.innerHTML = '';

  for (let user of users) {
    const status = await getFriendStatus(user.id);
    let btnHtml = '';

    if (status.status === 'none') {
      btnHtml = `<button data-id="${user.id}" data-action="add">Kết bạn</button>`;
    } else if (status.status === 'friends') {
      btnHtml = `<button data-id="${user.id}" data-action="unfriend">Hủy kết bạn</button>`;
    } else if (status.status === 'request-received') {
      btnHtml = `
        <button data-id="${status.requestId}" data-action="accept" data-sender-id="${user.id}">Chấp nhận</button>
        <button data-id="${status.requestId}" data-action="decline" data-sender-id="${user.id}">Từ chối</button>
      `;
    } else if (status.status === 'request-sent') {
      btnHtml = `<span>Đã gửi lời mời</span>`;
    }

    const item = document.createElement('div');
    item.className = 'user-item';
    item.innerHTML = `
      <div class="user-info">
        <img class="user-avatar" 
             src="${user.avatar || 'default-avatar.png'}" 
             alt="${user.username}"
             data-userid="${user.id}">
        <span>${user.username}</span>
      </div>
      <div class="user-buttons">${btnHtml}</div>
    `;
    listEl.appendChild(item);
  }

  updateUserListOnlineStatus();
}

async function getFriendStatus(userId) {
  const res = await authFetch(`/api/friends/status/${userId}`);
  if (!res.ok) return { status: 'none' };
  return res.json();
}

async function sendFriendRequest(receiverId) {
  const res = await authFetch('/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ receiverId })
  });
  return res.ok;
}

async function unfriend(friendId) {
  const res = await authFetch(`/api/friends/unfriend/${friendId}`, { method: 'DELETE' });
  return res.ok;
}

async function acceptRequest(requestId) {
  const res = await authFetch(`/api/friends/accept/${requestId}`, { method: 'POST' });
  return res.ok;
}

async function declineRequest(requestId) {
  const res = await authFetch(`/api/friends/decline/${requestId}`, { method: 'DELETE' });
  return res.ok;
}

// Modal
function openModal() { document.getElementById('edit-modal').classList.remove('hidden'); }
window.closeModal = function () { document.getElementById('edit-modal').classList.add('hidden'); };

window.submitEdit = async function () {
  const username = document.getElementById('edit-username').value;
  const bio = document.getElementById('edit-bio').value;
  const avatarFile = document.getElementById('edit-avatar').files[0];

  const formData = new FormData();
  formData.append('username', username);
  formData.append('bio', bio);
  if (avatarFile) formData.append('avatar', avatarFile);

  const res = await authFetch('/api/users/me', {
    method: 'PUT',
    body: formData
  });

  if (res.ok) {
    closeModal();
    await loadProfile();
  } else {
    console.error('Cập nhật thất bại');
  }
};
