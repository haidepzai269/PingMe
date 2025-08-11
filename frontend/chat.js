// frontend/chat.js
import { authFetch } from './authFetch.js';

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const chatWithUserId = params.get('user') || params.get('userId');

  if (!chatWithUserId) {
    alert('Không tìm thấy người dùng để chat.');
    return;
  }

  // ===== Lấy thông tin người chat cùng =====
  const resUser = await authFetch(`/api/users/${chatWithUserId}`);
  const user = await resUser.json();

  const chatHeader = document.getElementById('chat-header');
  chatHeader.innerHTML = `
    <img id="chat-avatar" src="${user.avatar || 'default-avatar.png'}" alt="" class="avatar-status">
    <div>
      <span>${user.username}</span>
      <div id="user-status-text" class="offline">🔴 Không hoạt động</div>
    </div>
  `;

  const avatarEl = document.getElementById('chat-avatar');
  const statusTextEl = document.getElementById('user-status-text');

  function setOnlineStatus(isOnline) {
    if (isOnline) {
      avatarEl.classList.add('online');
      statusTextEl.textContent = '🟢 Đang hoạt động';
      statusTextEl.classList.add('online');
      statusTextEl.classList.remove('offline');
    } else {
      avatarEl.classList.remove('online');
      statusTextEl.textContent = '🔴 Không hoạt động';
      statusTextEl.classList.add('offline');
      statusTextEl.classList.remove('online');
    }
  }

  const resMe = await authFetch('/api/users/me');
  const me = await resMe.json();

  const socket = io({ auth: { token: localStorage.getItem('accessToken') } });

  socket.on('user:online', ({ userId }) => {
    if (String(userId) === String(chatWithUserId)) setOnlineStatus(true);
    updateFriendOnlineStatus(userId, true);
  });
  socket.on('user:offline', ({ userId }) => {
    if (String(userId) === String(chatWithUserId)) setOnlineStatus(false);
    updateFriendOnlineStatus(userId, false);
  });
  socket.on('users:online_list', ({ online }) => {
    window._lastOnlineList = { online }; // lưu lại
    setOnlineStatus(online.includes(String(chatWithUserId)));
  
    document.querySelectorAll('#user-suggestions .friend-item').forEach(item => {
      const friendId = item.querySelector('.msg-btn').dataset.id;
      updateFriendOnlineStatus(friendId, online.includes(String(friendId)));
    });
  });
  
  

  const messageList = document.getElementById('chat-messages');
  const fileInput = document.getElementById('fileInput');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  async function loadMessages() {
    const res = await authFetch(`/api/messages/${chatWithUserId}`);
    const messages = await res.json();

    document.querySelectorAll('.skeleton-message').forEach(el => el.remove());

    messages.forEach(addMessageToUI);

    // Nếu tin nhắn mới nhất là của đối phương và chưa xem -> markAsSeen
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender_id == chatWithUserId && !lastMsg.seen_at) {
      await authFetch(`/api/messages/${lastMsg.id}/seen`, { method: 'PUT' });
    }
  }

  function addMessageToUI(msg) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.dataset.id = msg.id; // lưu id tin nhắn

    if (msg.sender_id == me.id) {
      msgDiv.classList.add('mine');
    } else {
      msgDiv.classList.add('other');
    }

    if (msg.content) {
      const text = document.createElement('p');
      text.textContent = msg.content;
      msgDiv.appendChild(text);
    }

    if (msg.media_url) {
      if (msg.media_type === 'image') {
        const img = document.createElement('img');
        img.src = msg.media_url;
        img.style.maxWidth = '200px';
        msgDiv.appendChild(img);
      } else {
        const video = document.createElement('video');
        video.src = msg.media_url;
        video.controls = true;
        video.style.maxWidth = '200px';
        msgDiv.appendChild(video);
      }
    }

    // Thêm chỗ hiển thị trạng thái
    const statusEl = document.createElement('div');
    statusEl.classList.add('msg-status');
    statusEl.textContent = msg.seen_at ? '✓ Đã xem' : '✓ Đã gửi';
    statusEl.style.display = 'none';
    msgDiv.appendChild(statusEl);

    // Chỉ cho phép chuột phải vào tin nhắn của mình
    if (msg.sender_id == me.id) {
      // Click chuột trái để xóa
      msgDiv.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Bạn có chắc muốn xóa tin nhắn này không?')) {
      try {
        const res = await authFetch(`/api/messages/${msg.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          msgDiv.remove();
        } else {
          alert(data.message || 'Không thể xóa tin nhắn');
        }
      } catch (err) {
        console.error('Lỗi xóa tin nhắn:', err);
      }
    }
      });
      // xem trạng thái tin nhắn 
      msgDiv.addEventListener('contextmenu', async (e) => {
        e.preventDefault();

        try {
          const res = await authFetch(`/api/messages/${msg.id}/seen`, { method: 'PUT' });
          const data = await res.json();

          if (data.seen_at) {
            statusEl.textContent = '✓ Đã xem';
          } else {
            statusEl.textContent = '✓ Đã gửi';
          }
        } catch (err) {
          console.error('Lỗi khi lấy trạng thái tin nhắn', err);
        }

        statusEl.style.display = statusEl.style.display === 'none' ? 'block' : 'none';
      });
    }

    messageList.appendChild(msgDiv);
    messageList.scrollTop = messageList.scrollHeight;
  }

  sendBtn.addEventListener('click', async () => {
    const formData = new FormData();
    formData.append('receiver_id', chatWithUserId);

    const text = messageInput.value.trim();
    if (text) formData.append('content', text);
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
    if (!text && !fileInput.files[0]) return;

    const res = await authFetch('/api/messages', { method: 'POST', body: formData });
    const message = await res.json();

    addMessageToUI(message);

    messageInput.value = '';
    fileInput.value = '';
  });

  socket.on('message:new', async (msg) => {
    if (msg.sender_id == chatWithUserId || msg.receiver_id == chatWithUserId) {
      addMessageToUI(msg);

      // Nếu tin nhắn là của đối phương thì đánh dấu đã xem ngay
      if (msg.sender_id == chatWithUserId) {
        await authFetch(`/api/messages/${msg.id}/seen`, { method: 'PUT' });
      }
    }
  });

  // Realtime khi tin nhắn được xem
  socket.on('message:seen', ({ messageId }) => {
    const statusEl = document.querySelector(`[data-id="${messageId}"] .msg-status`);
    if (statusEl) {
      statusEl.textContent = '✓ Đã xem';
    }
  });
  // Xóa tin nhắn realtime
  socket.on('message:deleted', ({ messageId }) => {
    const el = document.querySelector(`[data-id="${messageId}"]`);
    if (el) el.remove();
  });
  // ==== Load danh sách bạn bè ====
  async function loadFriends() {
    try {
      const res = await authFetch('/api/friends');
      const friends = await res.json();
      const listEl = document.getElementById('user-suggestions');
      listEl.innerHTML = '';

      friends.forEach(friend => {
        const li = document.createElement('li');
        li.classList.add('friend-item');
      
        li.innerHTML = `
          <div class="avatar-wrapper" style="position: relative;">
            <img src="${friend.avatar || 'default-avatar.png'}" 
                 alt="${friend.username}" 
                 class="avatar offline">
            <span class="online-dot" style="display:none;"></span>
          </div>
          <span class="friend-name">${friend.username}</span>
          <button class="msg-btn" data-id="${friend.friend_id}">💬 Nhắn tin</button>
        `;
      
        listEl.appendChild(li);
      });
      
      //
      // Sau khi load xong danh sách bạn bè -> cập nhật trạng thái online ngay
     const onlineListEvent = window._lastOnlineList; 
     if (onlineListEvent) {
  onlineListEvent.online.forEach(friendId => {
    updateFriendOnlineStatus(friendId, true);
  });
     }

      //

      // Sự kiện bấm nút nhắn tin
      listEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('msg-btn')) {
          const id = e.target.dataset.id;
          window.location.href = `chat.html?user=${id}`;
        }
      });

    } catch (err) {
      console.error('Lỗi load bạn bè:', err);
    }
  }

  function updateFriendOnlineStatus(friendId, isOnline) {
    const item = document.querySelector(`#user-suggestions .msg-btn[data-id="${friendId}"]`)?.closest('.friend-item');
    if (item) {
      const avatar = item.querySelector('.avatar');
      if (isOnline) {
        avatar.classList.add('online');
        avatar.classList.remove('offline');
      } else {
        avatar.classList.add('offline');
        avatar.classList.remove('online');
      }
    }
  }

  // tìm kiếm 
  // === Tìm kiếm bạn bè trong danh sách ===
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
  const keyword = searchInput.value.toLowerCase().trim();
  document.querySelectorAll('#user-suggestions .friend-item').forEach(item => {
    const name = item.querySelector('.friend-name').textContent.toLowerCase();
    if (name.includes(keyword)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
  });


  // Gọi luôn khi load trang
  loadFriends();
  loadMessages();
});
