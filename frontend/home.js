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
 
// tìm kiếm mới :
const searchInput = document.getElementById('search');
const searchResultsEl = document.getElementById('search-results');
const userListEl = document.getElementById('user-list');
//
const searchHistoryPopup = document.getElementById('search-history-popup');
const searchHistoryList = document.getElementById('search-history-list');
const clearHistoryBtn = document.getElementById('clear-search-history');

async function fetchAndRenderSearchHistory() {
  const res = await authFetch('/api/search/history');
  if (!res.ok) {
    console.error('Lỗi khi lấy lịch sử tìm kiếm');
    return;
  }
  let history = await res.json();
  console.log('Lịch sử tìm kiếm:', history);

  history = history.slice(0, 3);
  renderSearchHistory(history);
}
function renderSearchHistory(items) {
  searchHistoryList.innerHTML = '';
  if (items.length === 0) {
    searchHistoryList.innerHTML = '<li>Chưa có lịch sử tìm kiếm</li>';
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.keyword || item;

    // Nút xóa từng từ khóa
    const delBtn = document.createElement('button');
    delBtn.textContent = 'X';
    delBtn.style.marginLeft = '10px';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Xoá keyword trên backend
      await authFetch('/api/search/history/delete', {
        method: 'POST',
        body: JSON.stringify({ keyword: item.keyword || item })
      });
      li.remove();

      // Nếu danh sách trống thì hiện thông báo
      if (searchHistoryList.children.length === 0) {
        searchHistoryList.innerHTML = '<li>Chưa có lịch sử tìm kiếm</li>';
      }
    });

    li.appendChild(delBtn);

    // Khi click vào từ khóa thì gán giá trị tìm kiếm, đóng popup, và thực hiện tìm kiếm
    li.addEventListener('click', () => {
      searchInput.value = item.keyword || item;
      searchHistoryPopup.classList.remove('show');
      triggerSearch(item.keyword || item);
    });    

    searchHistoryList.appendChild(li);
  });
}
// Xóa toàn bộ lịch sử
clearHistoryBtn.addEventListener('click', async () => {
  await authFetch('/api/search/history/delete', {
    method: 'POST',
    body: JSON.stringify({ clearAll: true })
  });
  searchHistoryList.innerHTML = '<li>Đã xóa toàn bộ</li>';
});
// Hiển thị popup lịch sử khi focus vào ô tìm kiếm
searchInput.addEventListener('focus', async () => {
  await fetchAndRenderSearchHistory();
  searchHistoryPopup.classList.add('show');
});
// Ẩn popup khi click ra ngoài popup hoặc ô tìm kiếm
document.addEventListener('mousedown', (e) => {
  if (!searchHistoryPopup.contains(e.target) && e.target !== searchInput) {
    searchHistoryPopup.classList.remove('show');
  }
});
// Khi nhập mới, nếu rỗng thì hiện lịch sử, nếu có giá trị thì ẩn popup lịch sử (hoặc có thể hiện gợi ý)
searchInput.addEventListener('input', async () => {
  const query = searchInput.value.trim();
  if (!query) {
    await fetchAndRenderSearchHistory();
    searchHistoryPopup.classList.add('show');
  } else {
    searchHistoryPopup.classList.remove('show');
  }
});
// Hàm gọi API tìm kiếm chính (bạn có thể gọi lại đoạn code bạn có)
async function triggerSearch(query) {
  if (!query) return;

  // Gọi API tìm kiếm
  const res = await authFetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return console.error('Lỗi tìm kiếm');

  const results = await res.json();

  // Lấy lịch sử tìm kiếm hiện tại để kiểm tra trùng
  const historyRes = await authFetch('/api/search/history');
  let history = [];
  if (historyRes.ok) {
    history = await historyRes.json();
  }

  // Kiểm tra xem query đã có trong lịch sử chưa (so sánh không phân biệt hoa thường)
  const queryLower = query.toLowerCase();
  const exists = history.some(item => (item.keyword || item).toLowerCase() === queryLower);

  if (!exists) {
    // Nếu chưa có mới lưu
    await authFetch('/api/search/history', {
      method: 'POST',
      body: JSON.stringify({ keyword: query })
    });
  }

  // Nếu popup lịch sử đang mở thì làm mới lại
  if (!searchHistoryPopup.classList.contains('hidden')) {
    await fetchAndRenderSearchHistory();
  }

  // Hiển thị kết quả tìm kiếm
  userListEl.classList.add('hidden');
  await renderSearchResults(results);
  searchResultsEl.classList.remove('hidden');
}

let searchTimeout = null;
searchInput.addEventListener('input', () => {
  if (searchTimeout) clearTimeout(searchTimeout);

  searchTimeout = setTimeout(async () => {
    const query = searchInput.value.trim();

    if (!query) {
      searchResultsEl.classList.add('hidden');
      userListEl.classList.remove('hidden');
      await loadUserSuggestions();
      return;
    }

    const res = await authFetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      console.error('Lỗi tìm kiếm');
      return;
    }
    const results = await res.json();
    console.log('Kết quả tìm kiếm từ API:', results);

    userListEl.classList.add('hidden');
    await renderSearchResults(results);
    await triggerSearch(query);
    searchResultsEl.classList.remove('hidden');
  }, 300);  // đợi 300ms sau khi gõ mới gọi API
});
async function renderSearchResults(results) {
  searchResultsEl.innerHTML = '';

  if (!me) {
    searchResultsEl.innerHTML = '<p>Vui lòng đăng nhập để xem kết quả.</p>';
    return;
  }

  // Lọc bỏ user hiện tại
  const filteredResults = results.filter(user => user.id !== me.id);

  if (filteredResults.length === 0) {
    searchResultsEl.innerHTML = '<p>Không tìm thấy kết quả.</p>';
    return;
  }

  // Lấy trạng thái bạn bè cho tất cả user song song
  const statuses = await Promise.all(filteredResults.map(user => getFriendStatus(user.id)));

  for (let i = 0; i < filteredResults.length; i++) {
    const user = filteredResults[i];
    const status = statuses[i];

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
    
    const info = document.createElement('div');
    info.className = 'user-info';
    
    const opts = document.createElement('span');
    opts.className = 'user-options';
    opts.dataset.userid = String(user.id);
    opts.textContent = '⋮';
    
    const img = document.createElement('img');
    img.className = 'user-avatar';
    img.src = safeImageURL(user.avatar, 'default.png');
    img.alt = user.username || '';
    
    const name = document.createElement('span');
    name.textContent = user.username || '';
    
    info.append(opts, img, name);
    
    const btnWrap = document.createElement('div');
    btnWrap.className = 'user-buttons';
    btnWrap.append(renderActionButtonSafe(status));
    
    item.append(info, btnWrap);
    listEl.appendChild(item);
    

    // Thêm sự kiện mở popup info
    item.querySelector('.user-options').addEventListener('click', () => {
      openUserInfoPopup(user.id);
    });

    // Thêm sự kiện cho các nút thao tác
    item.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
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
          const ok = await acceptRequest(userId);
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
    });

    searchResultsEl.appendChild(item);
  }

  updateUserListOnlineStatus();
}
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
      img.style.border = '4px solid #00E676';
    } else {
      img.style.border = '4px solid red';
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

  // Avatar trong profile section
  document.getElementById('profile-avatar').innerHTML =
    `<img src="${data.avatar || 'default-avatar.png'}" alt="avatar">`;
  document.getElementById('profile-username').textContent = data.username;
  document.getElementById('profile-bio').textContent = data.bio || 'Chưa có giới thiệu';
  document.getElementById('profile-friends-count').textContent = `Bạn bè: ${data.friends_count}`;
  document.getElementById('edit-username').value = data.username;
  document.getElementById('edit-bio').value = data.bio || '';

  // Avatar sidebar & popup logout
  document.getElementById('sidebar-avatar-img').src = data.avatar || 'default-avatar.png';
  document.getElementById('logout-popup-img').src = data.avatar || 'default-avatar.png';
  document.getElementById('logout-popup-username').textContent = data.username;
}

// Mở popup khi click avatar sidebar
document.getElementById('sidebar-avatar').addEventListener('click', () => {
  document.getElementById('logout-popup').classList.add('show');
});

// Xử lý logout
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  sessionStorage.clear();
  window.location.href = 'auth.html';
});


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
          <span class="user-options" data-userid="${user.id}">⋮</span>
          <img class="user-avatar" 
               src="${user.avatar || 'default-avatar.png'}" 
               alt="${user.username}"
               data-userid="${user.id}">
          <span>${user.username}</span>
        </div>
        <div class="user-buttons">${btnHtml}</div>
      `;
  
      // Thêm sự kiện mở popup info
      item.querySelector('.user-options').addEventListener('click', () => {
        openUserInfoPopup(user.id);
      });
  
      listEl.appendChild(item);
    }
  
    updateUserListOnlineStatus();
}
//popup
let selectedUserId = null;

function openUserInfoPopup(userId) {
  selectedUserId = userId;

  // Lấy thông tin user để hiện popup
  authFetch(`/api/users/${userId}`)
    .then(res => res.json())
    .then(user => {
      document.querySelector('#user-info-popup .popup-avatar').src = user.avatar || 'default-avatar.png';
      document.querySelector('#user-info-popup .popup-username').textContent = user.username;
      document.querySelector('#user-info-popup .popup-bio').textContent = user.bio || '';
      document.getElementById('user-info-popup').classList.add('show');
      
    });
}

function closeUserInfoPopup() {
  document.getElementById('user-info-popup').classList.remove('show');
}
function startChatWithUser() {
  if (!selectedUserId) return;
  window.location.href = `chat.html?userId=${selectedUserId}`;
}



window.openUserInfoPopup = openUserInfoPopup;
window.closeUserInfoPopup = closeUserInfoPopup;
window.startChatWithUser = startChatWithUser;

  

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

document.addEventListener('DOMContentLoaded', () => {
  const chatBtn = document.getElementById('btn-chat');

  chatBtn.addEventListener('click', async () => {
    try {
      // 1. Lấy recent chats
      const resRecent = await authFetch('/api/messages/recent');
      const recentChats = await resRecent.json();

      let targetUserId = null;

      if (recentChats.length > 0) {
        // Lấy người chat gần nhất (tin nhắn mới nhất)
        targetUserId = recentChats[0].user_id;
      } else {
        // Nếu không có recent chats, lấy bạn bè đầu tiên
        const resFriends = await authFetch('/api/friends');
        const friends = await resFriends.json();

        if (friends.length > 0) {
          targetUserId = friends[0].friend_id; // hoặc friends[0].id tùy cấu trúc api
        }
      }

      if (targetUserId) {
        window.location.href = `chat.html?user=${targetUserId}`;
      } else {
        alert('Bạn chưa có bạn bè hoặc cuộc trò chuyện nào.');
      }
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu chat:', err);
      alert('Lỗi khi khởi động chat.');
    }
  });
});

