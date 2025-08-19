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
// --- Helpers an toàn ---
function safeImageURL(url, fallback = 'default-avatar.png') {
  if (!url || typeof url !== 'string') return fallback;
  try {
    const u = new URL(url, window.location.origin);
    return u.href;
  } catch {
    return fallback;
  }
}

function renderActionButtonSafe(status, userId) {
  const wrap = document.createElement('div');
  wrap.className = 'user-buttons';

  const mk = (label, action, id, extra = {}) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.action = action;
    b.dataset.id = String(id);
    Object.entries(extra).forEach(([k, v]) => (b.dataset[k] = String(v)));
    return b;
  };

  if (status.status === 'none') {
    wrap.append(mk('Kết bạn', 'add', userId));
  } else if (status.status === 'friends') {
    wrap.append(mk('Hủy kết bạn', 'unfriend', userId));
  } else if (status.status === 'request-received') {
    wrap.append(
      mk('Chấp nhận', 'accept', status.requestId, { senderId: userId }),
      mk('Từ chối', 'decline', status.requestId, { senderId: userId })
    );
  } else if (status.status === 'request-sent') {
    const span = document.createElement('span');
    span.textContent = 'Đã gửi lời mời';
    wrap.append(span);
  }
  return wrap;
}


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
  if (searchHistoryPopup.classList.contains('show')) {
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
    searchResultsEl.textContent = 'Vui lòng đăng nhập để xem kết quả.';
    return;
  }

  // bỏ chính mình
  const items = (results || []).filter(u => u.id !== me.id);
  if (items.length === 0) {
    searchResultsEl.textContent = 'Không tìm thấy kết quả.';
    return;
  }

  // lấy trạng thái bạn bè song song
  const statuses = await Promise.all(items.map(u => getFriendStatus(u.id)));

  for (let i = 0; i < items.length; i++) {
    const user = items[i];
    const status = statuses[i];

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
    img.src = safeImageURL(user.avatar, 'default-avatar.png');
    img.alt = user.username || '';
    img.dataset.userid = String(user.id); // để tô viền online/offline

    const name = document.createElement('span');
    name.textContent = user.username || '';

    info.append(opts, img, name);

    const btnWrap = renderActionButtonSafe(status, user.id);
    item.append(info, btnWrap);

    // mở popup info
    opts.addEventListener('click', () => openUserInfoPopup(user.id));

    // gắn handler cho các nút
    item.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'add') {
          const ok = await sendFriendRequest(userId);
          if (ok && socket && me) socket.emit('friend:send_request', { senderId: me.id, receiverId: userId });
        } else if (action === 'unfriend') {
          const ok = await unfriend(userId);
          if (ok && socket && me) socket.emit('friend:unfriend', { userId: me.id, friendId: userId });
        } else if (action === 'accept') {
          const ok = await acceptRequest(userId);
          if (ok && socket && me) socket.emit('friend:accept_request', { senderId: btn.dataset.senderId || null, receiverId: me.id });
        } else if (action === 'decline') {
          const ok = await declineRequest(userId);
          if (ok && socket && me) socket.emit('friend:decline_request', { senderId: btn.dataset.senderId || null, receiverId: me.id });
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
    // Reload danh sách thông báo từ DB (server sẽ tạo thông báo rồi emit 'notification:new' nếu bạn đã thêm bên backend)
    await renderNotificationsFromDB();
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
  socket.on('notification:new', (notif) => {
    console.log('🔔 New notif:', notif);
  
    const li = document.createElement('li');
    li.className = notif.is_read ? '' : 'notif-unread';
  
    // chọn icon theo type
    let iconHtml = '';
    switch (notif.type) {
      case 'friend_request':
        iconHtml = '<i class="fa-solid fa-user-plus"></i>';
        break;
      case 'message':
        iconHtml = '<i class="fa-solid fa-envelope"></i>';
        break;
      case 'system':
        iconHtml = '<i class="fa-solid fa-bell"></i>';
        break;
      case 'weather': {
        if (notif.icon) {
          // 👇 icon chuẩn từ OpenWeatherMap
          iconHtml = `<img src="https://openweathermap.org/img/wn/${notif.icon}.png"
                          alt="weather" style="width:20px; height:20px">`;
        } else {
          // fallback dự phòng
          const lower = (notif.message || '').toLowerCase();
          if (lower.includes('mưa')) iconHtml = '<i class="fa-solid fa-cloud-showers-heavy"></i>';
          else if (lower.includes('nắng') || lower.includes('clear')) iconHtml = '<i class="fa-solid fa-sun"></i>';
          else if (lower.includes('mây') || lower.includes('cloud')) iconHtml = '<i class="fa-solid fa-cloud"></i>';
          else if (lower.includes('gió') || lower.includes('wind')) iconHtml = '<i class="fa-solid fa-wind"></i>';
          else if (lower.includes('bão') || lower.includes('storm')) iconHtml = '<i class="fa-solid fa-poo-storm"></i>';
          else iconHtml = '<i class="fa-solid fa-temperature-half"></i>';
        }
        break;
      }
      default:
        iconHtml = '<i class="fa-solid fa-info-circle"></i>';
    }
  
    // message + thời gian
    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = `
      <div class="notification-mess">${iconHtml} ${notif.message}</div>
      <small style="color:#666; font-size:12px">${timeAgo(notif.created_at)}</small>
    `;
  
    // nút xoá
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    delBtn.title = 'Xóa';
    delBtn.style.background = 'transparent';
    delBtn.style.border = 'none';
    delBtn.style.cursor = 'pointer';
    delBtn.style.color = '#999';
    delBtn.style.fontSize = '14px';
    delBtn.addEventListener('mouseenter', () => delBtn.style.color = '#e53935');
    delBtn.addEventListener('mouseleave', () => delBtn.style.color = '#999');
    delBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await deleteNotif(notif.id);
      li.remove();
      const current = Number(badge.textContent) || 0;
      const next = Math.max(0, current - 1);
      badge.textContent = next;
      badge.classList.toggle('hidden', next === 0);
    });
  
    // checkbox read/unread
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = notif.is_read;
    checkbox.className = 'notif-checkbox';
    checkbox.addEventListener('change', async (ev) => {
      if (ev.target.checked) {
        await markRead(notif.id);
        li.classList.remove('notif-unread');
      } else {
        await markUnread(notif.id);
        li.classList.add('notif-unread');
      }
    });
  
    li.appendChild(msgDiv);
    li.appendChild(delBtn);
    li.appendChild(checkbox);
  
    list.prepend(li);
  
    // cập nhật badge
    const current = Number(badge.textContent) || 0;
    badge.textContent = notif.is_read ? current : current + 1;
    badge.classList.toggle('hidden', Number(badge.textContent) === 0);
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
  const pa = document.getElementById('profile-avatar');
  pa.innerHTML = '';
  const im = document.createElement('img');
  im.src = safeImageURL(data.avatar, 'default-avatar.png');
  im.alt = 'avatar';
  pa.appendChild(im);
  
  document.getElementById('profile-username').textContent = data.username;
  document.getElementById('profile-bio').textContent = data.bio || 'Chưa có giới thiệu';
  document.getElementById('profile-email').innerHTML =
  `<i class="fas fa-envelope"></i> |  Email: ${data.email || 'Chưa cập nhật'}`;
  const genderMap = {
    male: "Nam",
    female: "Nữ",
    other: "Khác"
  };
  document.getElementById('profile-gender').innerHTML =
    `<i class="fas fa-venus-mars"></i> | Giới tính: ${genderMap[data.gender] || 'Chưa cập nhật'}`;
  
  document.getElementById('profile-address').innerHTML =
  `<i class="fas fa-map-marker-alt"></i> |  Địa chỉ: ${data.address || 'Chưa cập nhật'}`;
  document.getElementById('profile-phone').innerHTML =
  `<i class="fas fa-phone"></i> |  Số điện thoại: ${data.phone || 'Chưa cập nhật'}`;

  document.getElementById('profile-friends-count').textContent = `Bạn bè: ${data.friends_count}`;
  document.getElementById('edit-username').value = data.username;
  document.getElementById('edit-email').value = data.email || '';
  document.getElementById('edit-gender').value = data.gender || '';
  document.getElementById('edit-address').value = data.address || '';
  document.getElementById('edit-phone').value = data.phone || '';
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
    
    for (const user of users) {
      const status = await getFriendStatus(user.id);
    
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
      img.src = safeImageURL(user.avatar, 'default-avatar.png');
      img.alt = user.username || '';
      img.dataset.userid = String(user.id);
    
      const name = document.createElement('span');
      name.textContent = user.username || '';
    
      info.append(opts, img, name);
    
      const btnWrap = renderActionButtonSafe(status, user.id);
      item.append(info, btnWrap);
    
      opts.addEventListener('click', () => openUserInfoPopup(user.id));
    
      listEl.appendChild(item);
    }
    updateUserListOnlineStatus();
    
}
//popup
let selectedUserId = null;

function openUserInfoPopup(userId) {
  selectedUserId = userId;

  authFetch(`/api/users/${userId}`)
    .then(res => res.json())
    .then(user => {
      const genderMap = {
        male: "Nam",
        female: "Nữ",
        other: "Khác"
      };

      document.querySelector('#user-info-popup .popup-avatar').src = user.avatar || 'default-avatar.png';
      document.querySelector('#user-info-popup .popup-username').textContent = user.username;
      document.querySelector('#user-info-popup .popup-bio').textContent = user.bio || '';

      // thêm thông tin bổ sung
      const infoEl = document.querySelector('#user-info-popup .popup-extra');
      infoEl.innerHTML = `
        <p><i class="fas fa-envelope"></i>| ${user.email || 'Chưa cập nhật'}</p>
        <p><i class="fas fa-venus-mars"></i>| ${genderMap[user.gender] || 'Chưa cập nhật'}</p>
        <p><i class="fas fa-map-marker-alt"></i>| ${user.address || 'Chưa cập nhật'}</p>
        <p><i class="fas fa-phone"></i>| ${user.phone || 'Chưa cập nhật'}</p>
      `;

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
  const email = document.getElementById('edit-email').value;
  const gender = document.getElementById('edit-gender').value;
  const address = document.getElementById('edit-address').value;
  const phone = document.getElementById('edit-phone').value;
  const avatarFile = document.getElementById('edit-avatar').files[0];

  const formData = new FormData();
  formData.append('username', username);
  formData.append('bio', bio);
  formData.append('email', email);
  formData.append('gender', gender);
  formData.append('address', address);
  formData.append('phone', phone);
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


// ---------- Notifications (DB-backed) ----------
const bell = document.getElementById('notification-bell');
const popup = document.getElementById('notification-popup');
const list = document.getElementById('notification-list');
const badge = document.getElementById('notification-badge');

async function fetchNotifications() {
  try {
    const res = await authFetch('/api/notifications');
    if (!res.ok) throw new Error('fetch notifications failed');
    return await res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function markRead(id) {
  try {
    await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  } catch (e) {
    console.error('markRead failed', e);
  }
}
async function markUnread(id) {
  try {
    await authFetch(`/api/notifications/${id}/unread`, { method: 'PATCH' });
  } catch (e) {
    console.error('markUnread failed', e);
  }
}

async function deleteNotif(id) {
  try {
    await authFetch(`/api/notifications/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.error('delete notification failed', e);
  }
}

async function renderNotificationsFromDB() {
  const notifs = await fetchNotifications();

  list.innerHTML = '';
  if (!notifs.length) {
    list.innerHTML = '<li>Không có thông báo</li>';
    badge.classList.add('hidden');
    return;
  }

  const unread = notifs.filter(n => !n.is_read).length;
  badge.textContent = unread;
  badge.classList.toggle('hidden', unread === 0);

  notifs.forEach(n => {
    const li = document.createElement('li');
    li.className = n.is_read ? '' : 'notif-unread';
  
    // checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = n.is_read;
    checkbox.style.marginRight = '8px';
  
    checkbox.addEventListener('change', async (ev) => {
      if (ev.target.checked) {
        await markRead(n.id);
      } else {
        await markUnread(n.id);
      }
    
      // cập nhật badge ngay
      const current = Number(badge.textContent) || 0;
      if (ev.target.checked) {
        const next = Math.max(0, current - 1);
        badge.textContent = next;
        badge.classList.toggle('hidden', next === 0);
      } else {
        const next = current + 1;
        badge.textContent = next;
        badge.classList.remove('hidden');
      }
    
      await renderNotificationsFromDB();
    });
    
    // chọn icon theo type
    // chọn icon theo type
      let iconHtml = '';
      switch (n.type) {
  case 'friend_request':
    iconHtml = '<i class="fa-solid fa-user-plus"></i>';
    break;
  case 'message':
    iconHtml = '<i class="fa-solid fa-envelope"></i>';
    break;
  case 'system':
    iconHtml = '<i class="fa-solid fa-bell"></i>';
    break;
    case 'weather': {
      try {
        if (n.icon) {
          // icon chính thức từ OpenWeatherMap
          iconHtml = `<img src="https://openweathermap.org/img/wn/${n.icon}.png"
                           alt="weather" style="width:20px; height:20px">`;
        } else {
          // fallback nếu không có icon
          const msg = (n.message || '').toLowerCase();
          if (msg.includes('mưa')) {
            iconHtml = '<i class="fa-solid fa-cloud-showers-heavy"></i>';
          } else if (msg.includes('nắng') || msg.includes('clear')) {
            iconHtml = '<i class="fa-solid fa-sun"></i>';
          } else if (msg.includes('mây') || msg.includes('cloud')) {
            iconHtml = '<i class="fa-solid fa-cloud"></i>';
          } else if (msg.includes('gió') || msg.includes('wind')) {
            iconHtml = '<i class="fa-solid fa-wind"></i>';
          } else if (msg.includes('bão') || msg.includes('storm')) {
            iconHtml = '<i class="fa-solid fa-poo-storm"></i>';
          } else {
            iconHtml = '<i class="fa-solid fa-temperature-half"></i>';
          }
        }
      } catch (e) {
        console.error('weather icon render error', e);
        iconHtml = '<i class="fa-solid fa-temperature-half"></i>';
      }
      break;
    }
    
  default:
    iconHtml = '<i class="fa-solid fa-info-circle"></i>';
      }

    
    
  
    // message + thời gian
    const msgDiv = document.createElement('div');
    msgDiv.innerHTML = `
      <div class="notification-mess">${iconHtml} ${n.message}</div>
      <small style="color:#666; font-size:12px">${timeAgo(n.created_at)}</small>
    `;
  
    // nút xoá
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    delBtn.title = 'Xóa';
    delBtn.style.background = 'transparent';
    delBtn.style.border = 'none';
    delBtn.style.cursor = 'pointer';
    delBtn.style.color = '#999';
    delBtn.style.fontSize = '14px';
    delBtn.addEventListener('mouseenter', () => delBtn.style.color = '#e53935');
    delBtn.addEventListener('mouseleave', () => delBtn.style.color = '#999');
    delBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await deleteNotif(n.id);
      await renderNotificationsFromDB();
    });
  
    li.appendChild(checkbox);
    li.appendChild(msgDiv);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
  
}


// Toggle popup: mở là tải + mark all read
bell.addEventListener('click', async () => {
  popup.classList.toggle('show');
  popup.classList.toggle('hidden');

  if (popup.classList.contains('show')) {
    // render lần 1 để thấy danh sách ngay
    await renderNotificationsFromDB();

    // mark tất cả thông báo chưa đọc
    const notifs = await fetchNotifications();
    const unreadIds = notifs.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length) {
      await Promise.all(unreadIds.map(id => markRead(id)));
      await renderNotificationsFromDB();
    }
  }
});

// Click outside để đóng popup
document.addEventListener('mousedown', (e) => {
  if (!popup.contains(e.target) && !bell.contains(e.target)) {
    popup.classList.remove('show');
    popup.classList.add('hidden');
  }
});
// Hàm tính khoảng thời gian so với hiện tại (giờ Việt Nam)
function timeAgo(dateStr) {
  if (!dateStr) return '';
  
  
  // Nếu thiếu Z (UTC marker) thì thêm vào để tránh bị coi là local time
  let parsedDate = dateStr.endsWith('Z') ? new Date(dateStr) : new Date(dateStr + 'Z');
  
  
  if (isNaN(parsedDate.getTime())) {
  // fallback: thử parse bình thường
  parsedDate = new Date(dateStr);
  }
  
  
  const now = new Date();
  const diffMs = now - parsedDate;
  
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  
  if (seconds < 60) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  return `${days} ngày trước`;
  }
  
  
  // Load ban đầu
  document.addEventListener('DOMContentLoaded', () => {
  renderNotificationsFromDB();
  });