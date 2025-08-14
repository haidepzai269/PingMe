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
  <button id="block-btn" style="margin-left: auto; display : none">Loading...</button>
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
  
    // Reset badge ngay khi load tin nhắn (frontend)
    resetUnread(chatWithUserId);
  
    // Đánh dấu tất cả tin nhắn từ người chat là đã xem (backend)
    await authFetch(`/api/messages/${chatWithUserId}/seen_all`, { method: 'PUT' });
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
  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  sendBtn.addEventListener('click', async () => {
    if (messageInput.disabled) {
      alert('Bạn không thể nhắn tin với người này.');
      return;
    }
    const formData = new FormData();
    formData.append('receiver_id', chatWithUserId);
  
    const text = messageInput.value.trim();
    if (text) formData.append('content', text);
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
    if (!text && !fileInput.files[0]) return;
  
    try {
      const res = await authFetch('/api/messages', { method: 'POST', body: formData });
      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.message || 'Lỗi khi gửi tin nhắn');
        return;
      }
      const message = await res.json();
      addMessageToUI(message);
      messageInput.value = '';
      fileInput.value = '';
    } catch (error) {
      console.error('Lỗi gửi tin nhắn:', error);
      alert('Lỗi khi gửi tin nhắn');
    }
  });

  socket.on('message:new', async (msg) => {
    const isCurrentChat = msg.sender_id == chatWithUserId || msg.receiver_id == chatWithUserId;
  
    if (isCurrentChat) {
      // Thêm tin nhắn vào UI
      addMessageToUI(msg);
  
      // Nếu là tin của đối phương thì đánh dấu đã xem
      if (msg.sender_id == chatWithUserId) {
        await authFetch(`/api/messages/${msg.id}/seen`, { method: 'PUT' });
  
        // Reset badge của cuộc trò chuyện này
        unreadCounts.set(chatWithUserId, 0);
        updateUnreadBadge(chatWithUserId);
      }
    } else {
      // Tin nhắn thuộc chat khác → tăng số tin nhắn chưa đọc
      const senderId = msg.sender_id;
      unreadCounts.set(senderId, (unreadCounts.get(senderId) || 0) + 1);
      updateUnreadBadge(senderId);
  
      // Lấy thông tin người gửi để hiện thông báo
      const senderEl = document.querySelector(`#user-suggestions .msg-btn[data-id="${senderId}"]`)?.closest('.friend-item');
      const senderName = senderEl?.querySelector('.friend-name')?.textContent || 'Người lạ';
      const avatar = senderEl?.querySelector('img')?.src || 'default-avatar.png';
  
      showToastNotification(msg, { username: senderName, avatar });
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
            <img src="${friend.avatar || 'default-avatar.png'}" alt="${friend.username}" class="avatar offline">
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
      // Cập nhật badge từ server
      await loadUnreadCounts();
      //

      // Sự kiện bấm nút nhắn tin
      // Sự kiện bấm nút nhắn tin
      listEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('msg-btn')) {
    const id = e.target.dataset.id;

    // Reset badge trên frontend ngay lập tức
    unreadCounts.set(id, 0);
    updateUnreadBadge(id);

    // Gọi API mark tất cả tin nhắn đã xem
    await authFetch(`/api/messages/${id}/seen_all`, { method: 'PUT' });

    // Chuyển sang trang chat
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
// === Tìm kiếm bạn bè + nhóm ===
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', () => {
  const keyword = searchInput.value.toLowerCase().trim();

  // Lọc danh sách bạn bè
  document.querySelectorAll('#user-suggestions .friend-item').forEach(item => {
    const name = item.querySelector('.friend-name').textContent.toLowerCase();
    item.style.display = name.includes(keyword) ? '' : 'none';
  });

  // Lọc danh sách nhóm
  document.querySelectorAll('#group-list .group-item').forEach(item => {
    const name = item.querySelector('.group-name').textContent.toLowerCase();
    item.style.display = name.includes(keyword) ? '' : 'none';
  });
});

  // hàm block 
  // Gọi cập nhật ngay
  await updateBlockButton();
  async function updateBlockButton() {
    const res = await authFetch(`/api/block/check/${chatWithUserId}`);
    const data = await res.json();
  
    const blockBtn = document.getElementById('block-btn');
  
    if (data.iBlockedThem) {
      blockBtn.textContent = 'Bỏ chặn';
    } else {
      blockBtn.textContent = 'Chặn';
    }

    blockBtn.style.display = 'inline-block';


    // Cập nhật input chat theo trạng thái block
    updateChatInput(!data.iBlockedThem && !data.theyBlockedMe);
  }
  function updateChatInput(enabled) {
    messageInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    if (!enabled) {
      messageInput.placeholder = 'Bạn không thể nhắn tin với người này';
    } else {
      messageInput.placeholder = 'Nhập tin nhắn...';
    }
  }
  const blockBtn = document.getElementById('block-btn');
  blockBtn.addEventListener('click', async () => {
    if (blockBtn.textContent === 'Chặn') {
      // Gọi API block
      const res = await authFetch(`/api/block/${chatWithUserId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        blockBtn.textContent = 'Bỏ chặn';
        socket.emit('block:user', { blockedUserId: chatWithUserId, action: 'block' });
        updateChatInput(false);
      } else {
        alert('Không thể chặn người này');
      }
    } else {
      // Gọi API unblock
      const res = await authFetch(`/api/block/${chatWithUserId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        blockBtn.textContent = 'Chặn';
        socket.emit('block:user', { blockedUserId: chatWithUserId, action: 'unblock' });
        updateBlockButton(); // Kiểm tra lại trạng thái block và cập nhật input
      } else {
        alert('Không thể bỏ chặn');
      }
    }
  });
  socket.on('block:update', ({ blockerId, blockedUserId, action }) => {
    // Nếu chính mình hoặc người chat bị block/unblock
    if (
      (String(blockerId) === String(me.id) && String(blockedUserId) === String(chatWithUserId)) ||
      (String(blockerId) === String(chatWithUserId) && String(blockedUserId) === String(me.id))
    ) {
      if (action === 'block') {
        updateChatInput(false);
        document.getElementById('block-btn').textContent =
          String(blockerId) === String(me.id) ? 'Bỏ chặn' : 'Chặn';
      } else if (action === 'unblock') {
        updateBlockButton();
      }
    }
  });

  // Tạo overlay + ảnh phóng to, ẩn mặc định
  const imgOverlay = document.createElement('div');
  imgOverlay.id = 'img-hover-overlay';
  imgOverlay.style.position = 'fixed';
  imgOverlay.style.top = '0';
  imgOverlay.style.left = '0';
  imgOverlay.style.width = '100vw';
  imgOverlay.style.height = '100vh';
  imgOverlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
  imgOverlay.style.display = 'none';
  imgOverlay.style.justifyContent = 'center';
  imgOverlay.style.alignItems = 'center';
  imgOverlay.style.zIndex = '10000';
  imgOverlay.style.cursor = 'zoom-out';
  imgOverlay.style.transition = 'opacity 0.3s ease';

  const enlargedImg = document.createElement('img');
  enlargedImg.style.maxWidth = '90vw';
  enlargedImg.style.maxHeight = '90vh';
  enlargedImg.style.borderRadius = '8px';
  enlargedImg.style.boxShadow = '0 0 20px rgba(255,255,255,0.8)';
  enlargedImg.style.transform = 'scale(0.8)';
  enlargedImg.style.transition = 'transform 0.3s ease';

  imgOverlay.appendChild(enlargedImg);
  document.body.appendChild(imgOverlay);

  let hideTimeout = null;

  document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('#chat-messages')) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      enlargedImg.src = e.target.src;
      imgOverlay.style.display = 'flex';
      setTimeout(() => {
        imgOverlay.style.opacity = '1';
        enlargedImg.style.transform = 'scale(1)';
      }, 10);
    }
  });
  
  function hideOverlay() {
    imgOverlay.style.opacity = '0';
    enlargedImg.style.transform = 'scale(0.8)';
    hideTimeout = setTimeout(() => {
      imgOverlay.style.display = 'none';
      enlargedImg.src = '';
      hideTimeout = null;
    }, 300);
  }
  
  document.addEventListener('mouseout', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('#chat-messages')) {
      // delay 200ms trước khi ẩn, nếu không di chuột vào overlay thì mới ẩn
      hideTimeout = setTimeout(() => {
        if (!imgOverlay.matches(':hover')) {
          hideOverlay();
        } else {
          // nếu đang hover overlay thì không ẩn
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
      }, 200);
    }
  });
  
  imgOverlay.addEventListener('mouseleave', hideOverlay);
  imgOverlay.addEventListener('click', hideOverlay);
  // thông báo 
  // Map lưu số lượng tin nhắn chưa đọc theo userId
const unreadCounts = new Map();
function updateUnreadBadge(userId) {
  const item = document.querySelector(`#user-suggestions .msg-btn[data-id="${userId}"]`)?.closest('.friend-item');
  if (!item) return;

  let badge = item.querySelector('.badge-unread');
  const count = unreadCounts.get(userId) || 0;

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'badge-unread';
    item.appendChild(badge); // append trực tiếp vào thẻ cha
  }

  badge.textContent = count > 9 ? '9+' : count;
  badge.style.display = count === 0 ? 'none' : 'inline-block';
}

function showToastNotification(msg, sender) {
  const container = document.getElementById('chat-notification-container');
  const toast = document.createElement('div');
  toast.className = 'toast-notification';

  toast.innerHTML = `
    <img src="${sender.avatar || 'default-avatar.png'}" alt="${sender.username}">
    <div><strong>${sender.username}</strong><br>${msg.content || '📎 File'}</div>
  `;

  container.appendChild(toast);

  // Animate vào
  setTimeout(() => toast.classList.add('show'), 10);

  // 3 giây sau ẩn
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
// Khi mở chat với 1 user, reset badge
function resetUnread(userId) {
  unreadCounts.set(userId, 0);
  updateUnreadBadge(userId);
}

// Bấm nhắn tin → reset badge
document.getElementById('user-suggestions').addEventListener('click', (e) => {
  if (e.target.classList.contains('msg-btn')) {
    const id = e.target.dataset.id;
    resetUnread(id);
  }
});

async function loadUnreadCounts() {
  try {
    const res = await authFetch('/api/messages/unread/counts');
    if (!res.ok) return;
    const data = await res.json(); // { "2": 3, "5": 1 }
    Object.entries(data).forEach(([userId, count]) => {
      unreadCounts.set(userId, count);
      updateUnreadBadge(userId);
    });
  } catch (err) {
    console.error('Lỗi load số tin nhắn chưa đọc:', err);
  }
}
 // enter
   // Gửi tin nhắn khi nhấn Enter
   messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Ngăn xuống dòng
      sendBtn.click(); // Giả lập click nút gửi
    }
  });

  

  // Gọi luôn khi load trang
  loadFriends();
  loadMessages();
});