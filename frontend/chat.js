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
  <div class="header-actions" style="margin-left:auto; position:relative;">
    <button id="more-options-btn" class="more-options-btn">⋯</button>
    <div id="more-options-popup" class="more-options-popup">
      <button id="call-btn">📞 Gọi</button>
      <button id="block-btn">Loading...</button>
      <button id="delete-chat-btn">Xóa tin nhắn</button>
      <button id="change-bg-btn">Đổi nền chat</button>
      <button id="remove-bg-btn">Xóa nền chat</button>
      <input type="file" id="bg-upload" accept="image/*" style="display:none">
    </div>

  </div>
`;
//
// Sau khi set chatHeader.innerHTML
const moreBtn = document.getElementById('more-options-btn');
const morePopup = document.getElementById('more-options-popup');

// Toggle popup khi bấm 3 chấm
moreBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  morePopup.style.display = morePopup.style.display === 'flex' ? 'none' : 'flex';
});

// Ẩn popup khi bấm ra ngoài
document.addEventListener('click', () => {
  morePopup.style.display = 'none';
});

// Nút chặn (gọi lại logic cũ)
document.getElementById('block-btn').addEventListener('click', () => {
  // Logic chặn đã có sẵn trong code của bạn
  morePopup.style.display = 'none';
});

// Nút xóa toàn bộ tin nhắn
document.getElementById('delete-chat-btn').addEventListener('click', () => {
  deleteMyMessagesInChat();
  morePopup.style.display = 'none';
});




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
  const chatInputBox = document.querySelector('.chat-input');

  messageInput.addEventListener('input', () => {
    if (messageInput.value.trim() !== "") {
      chatInputBox.classList.add('typing');
    } else {
      chatInputBox.classList.remove('typing');
    }
  });
  
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
  

  let lastMessageDate = null; // lưu ngày của tin nhắn trước đó

  function addMessageToUI(msg) {
    const msgDateStr = new Date(msg.created_at).toLocaleDateString(); // dạng dd/mm/yyyy
  
    // Tạo phần tử tin nhắn
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.dataset.id = msg.id;
    msgDiv.dataset.senderId = String(msg.sender_id);
    if (msg.sender_id == me.id) {
      msgDiv.classList.add('mine');
    } else {
      msgDiv.classList.add('other');
    }
  
    // Nội dung text
    if (msg.content) {
      const text = document.createElement('p');
      text.textContent = msg.content;
      msgDiv.appendChild(text);
    }
  
    // Nội dung media
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
  
    // Thêm trạng thái tin nhắn
    const statusEl = document.createElement('div');
    statusEl.classList.add('msg-status');
    statusEl.textContent = msg.seen_at ? '✓ Đã xem' : '✓ Đã gửi';
    statusEl.style.display = 'none';
    msgDiv.appendChild(statusEl);
  
    // Nếu là tin nhắn của mình → cho phép xóa & xem trạng thái
    if (msg.sender_id == me.id) {
      // Click để xóa
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
  
      // Chuột phải → xem trạng thái
      msgDiv.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        try {
          const res = await authFetch(`/api/messages/${msg.id}/seen`, { method: 'PUT' });
          const data = await res.json();
          statusEl.textContent = data.seen_at ? '✓ Đã xem' : '✓ Đã gửi';
        } catch (err) {
          console.error('Lỗi khi lấy trạng thái tin nhắn', err);
        }
        statusEl.style.display = statusEl.style.display === 'none' ? 'block' : 'none';
      });
    }
  
    // Kiểm tra xem đã có divider cho ngày này chưa
    let divider = document.querySelector(`.date-divider[data-date="${msgDateStr}"]`);
    if (divider) {
      // Nếu đã có, di chuyển nó xuống ngay trước tin nhắn mới
      messageList.appendChild(divider);
    } else {
      // Nếu chưa có, tạo mới
      divider = document.createElement('div');
      divider.classList.add('date-divider');
      divider.dataset.date = msgDateStr;
      divider.textContent = `--- ${msgDateStr} ---`;
      messageList.appendChild(divider);
    }
  
    // Thêm tin nhắn ngay sau divider
    messageList.appendChild(msgDiv);
  
    // Cuộn xuống cuối
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
      chatInputBox.classList.remove('typing');
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
  // xóa toàn bộ tin nhắn 
  // Function xóa tin nhắn của mình
  async function deleteMyMessagesInChat() {
  if (confirm('Bạn có chắc muốn xóa tất cả tin nhắn của mình trong cuộc trò chuyện này không?')) {
    try {
      const res = await authFetch(`/api/messages/conversation/${chatWithUserId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        document.querySelectorAll('#chat-messages .message.mine').forEach(el => el.remove());
        alert(`Đã xóa ${data.deletedCount} tin nhắn của bạn`);
      } else {
        alert(data.message || 'Không thể xóa tin nhắn');
      }
    } catch (err) {
      console.error('Lỗi khi xóa trò chuyện:', err);
    }
  }
  }
  // Lắng nghe realtime khi server báo đã xóa tin nhắn của mình
  // Xóa toàn bộ tin nhắn của 1 người (deleter)
  socket.on('conversation:my_messages_deleted', ({ userId: deleterId }) => {
  // Chỉ xử lý khi deleter là mình hoặc là người đang chat
  const inThisChat =
    String(deleterId) === String(me.id) ||
    String(deleterId) === String(chatWithUserId);

  if (!inThisChat) return;

  document
    .querySelectorAll(`#chat-messages .message[data-sender-id="${String(deleterId)}"]`)
    .forEach(el => el.remove());
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
   // Load profile
   // Load profile và set tên vào thanh tìm kiếm
   async function loadProfileSidebar() {
  const res = await authFetch('/api/users/me');
  if (!res) return console.error('Không lấy được profile');
  const data = await res.json();

  // Avatar sidebar + popup
  document.getElementById('sidebar-avatar-img').src = data.avatar || 'default-avatar.png';
  document.getElementById('logout-popup-img').src = data.avatar || 'default-avatar.png';
  document.getElementById('logout-popup-username').textContent = data.username;

  // Set PingMe - username vào input tìm kiếm
// Set PingMe - username ở trên thanh tìm kiếm
const pingmeLabel = document.getElementById('pingme-username');
if (pingmeLabel) {
  pingmeLabel.textContent = `PingMe - ${data.username}`;
}

   }

  
  // Mở popup khi click avatar
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
  // ĐÓNG POPUP KHI CLICK RA NGOÀI (kể cả click overlay)
const popup = document.getElementById('logout-popup');
const popupContent = popup.querySelector('.popup-content');
const avatar = document.getElementById('sidebar-avatar');

// Click avatar để mở (nhớ chặn bubble để không bị đóng ngay)
avatar.addEventListener('click', (e) => {
  e.stopPropagation();
  popup.classList.add('show');
});

// Click bất kỳ chỗ nào: nếu không nằm trong popup-content và không phải avatar → đóng
document.addEventListener('click', (e) => {
  if (!popup.classList.contains('show')) return;
  const clickTrongContent = popupContent.contains(e.target);
  const clickVaoAvatar = avatar.contains(e.target);
  if (!clickTrongContent && !clickVaoAvatar) {
    popup.classList.remove('show');
  }
});

// Click đúng overlay (vùng tối) cũng đóng
popup.addEventListener('click', (e) => {
  if (e.target === popup) {
    popup.classList.remove('show');
  }
});

// Nhấn phím Esc để đóng
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    popup.classList.remove('show');
  }
});
  loadProfileSidebar();
  
  // Emoji
  // Emoji Picker
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const emojis = [
  // Mặt cảm xúc
  "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😇","🙂","🙃","😋","😌","😍","😘","😗","😙","😚",
  "😜","🤪","🤩","😎","🥰","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😭","😤",
  "😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑",
  // Tay & hành động
  "👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👋","🤚","🖐️","✋","🖖","👊","🤛","🤜","👏","🙌","👐","🤲",
  // Trái tim & tình cảm
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝",
  // Vật dụng & kỷ niệm
  "🎉","🥳","🎂","🍰","🍕","🍔","🍟","🍩","☕","🍵","🍺","🍷","🍹","🍸","🏆","⚽","🏀","🎮","🎵","🎶","💡","🔥","💯","✅","❌","🌟","⭐","✨","🌈"
];

function loadEmojis() {
  emojiPicker.innerHTML = '';
  emojis.forEach(e => {
    const span = document.createElement('span');
    span.textContent = e;
    span.addEventListener('click', () => {
      messageInput.value += e;
      emojiPicker.style.display = 'none';
      messageInput.focus();
    });
    emojiPicker.appendChild(span);
  });
}

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.style.display = (emojiPicker.style.display === 'flex') ? 'none' : 'flex';
});

document.addEventListener('click', () => {
  emojiPicker.style.display = 'none';
});

loadEmojis();
  // đổi nền
  // ==========================
// ===== ĐỔI NỀN CHAT (dán thay block cũ) =====
const changeBgBtn = document.getElementById("change-bg-btn");
const bgUploadInput = document.getElementById("bg-upload");
const messagesEl = document.querySelector(".messages");

// Dùng ID người đang chat cùng — đảm bảo không còn null
const partnerId = chatWithUserId;

function setChatBackground(url) {
  if (!messagesEl) return;
  messagesEl.style.backgroundImage = `url(${url})`;
  messagesEl.style.backgroundSize = "cover";
  messagesEl.style.backgroundPosition = "center";
}

async function loadChatBackground() {
  if (!partnerId) return;
  try {
    const res = await authFetch(`/api/messages/background/${partnerId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.background_url) setChatBackground(data.background_url);
    else messagesEl.style.backgroundImage = "";
  } catch (err) {
    console.error("Lỗi load nền chat:", err);
  }
}

if (changeBgBtn) {
  changeBgBtn.addEventListener("click", () => {
    if (bgUploadInput) bgUploadInput.click();
  });
}

if (bgUploadInput) {
  bgUploadInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1) Upload ảnh
      const uploadRes = await authFetch("/api/messages/background/upload", {
        method: "POST",
        body: formData
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      const uploadData = await uploadRes.json();
      if (!uploadData.url) return alert("Lỗi upload ảnh nền");

      // 2) Lưu DB (ghi 2 chiều ở backend)
      const saveRes = await authFetch(`/api/messages/background/${partnerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background_url: uploadData.url })
      });
      if (!saveRes.ok) throw new Error(`Save failed: ${saveRes.status}`);

      // 3) Cập nhật UI ngay
      setChatBackground(uploadData.url);
    } catch (err) {
      console.error("Lỗi đổi nền:", err);
      alert("Không thể đổi nền chat");
    } finally {
      e.target.value = ""; // reset input
    }
  });
}


const removeBgBtn = document.getElementById("remove-bg-btn");

if (removeBgBtn) {
  removeBgBtn.addEventListener("click", async () => {
    if (!partnerId) return;
    try {
      const res = await authFetch(`/api/messages/background/${partnerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background_url: null })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Reset nền về mặc định
      messagesEl.style.backgroundImage = "";
    } catch (err) {
      console.error("Lỗi xóa nền:", err);
    }
  });
}
// Realtime: nhận sự kiện cho cả hai bên
if (typeof socket !== "undefined") {
  socket.on("chat:background_updated", (data) => {
    // backend đã gửi partnerId = "người còn lại" đối với người nhận event
    if (String(data.partnerId) === String(partnerId)) {
      if (data.background_url) {
        setChatBackground(data.background_url);
      } else {
        messagesEl.style.backgroundImage = "";
      }
    }
  });
}
// Load nền khi mở chat
loadChatBackground();


// ==== Voice call ====
let localStream;
let peerConnection;
let currentCallId, currentRoomId;
// ==== Audio meter setup ====
let localAudioCtx, localAnalyser;
let remoteAudioCtx, remoteAnalyser;

function startMeter(stream, type) {
  const audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;

  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const canvas = document.getElementById(type === "local" ? "local-meter" : "remote-meter");
  const ctx = canvas.getContext("2d");

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a,b)=>a+b,0) / dataArray.length;
    const level = avg / 255; // 0–1

    ctx.fillStyle = "#222";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = type === "local" ? "#0f0" : "#0ff";
    ctx.fillRect(0,0,canvas.width*level,canvas.height);
  }
  draw();

  if (type === "local") {
    localAudioCtx = audioCtx;
    localAnalyser = analyser;
  } else {
    remoteAudioCtx = audioCtx;
    remoteAnalyser = analyser;
  }
}

const callModal = document.getElementById('call-modal');
const callStatus = document.getElementById('call-status');
const acceptBtn = document.getElementById('accept-call-btn');
const rejectBtn = document.getElementById('reject-call-btn');
const endBtn = document.getElementById('end-call-btn');
const remoteAudio = document.getElementById('remote-audio');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
let micMuted = false;
const toggleSpeakerBtn = document.getElementById('toggle-speaker-btn');
let speakerMuted = false;
// Nút gọi thử
const callBtn = document.getElementById('call-btn');
callBtn.addEventListener('click', () => {
  console.log("☎️ Caller click Gọi, emit call:init");
  socket.emit('call:init', { calleeId: chatWithUserId });
  showCallUI('caller', { username: user.username, avatar: user.avatar });
  morePopup.style.display = 'none'; // đóng popup sau khi bấm
});
// tắt mic
toggleMicBtn.onclick = () => {
  if (!localStream) return;

  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !micMuted);

  if (micMuted) {
    toggleMicBtn.classList.add("muted");
    toggleMicBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
    showToast("Mic đã tắt", "info");
  } else {
    toggleMicBtn.classList.remove("muted");
    toggleMicBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    showToast("Mic đã bật", "info");
  }
};
// tắt loa 
toggleSpeakerBtn.onclick = () => {
  if (!remoteAudio) return;

  speakerMuted = !speakerMuted;
  remoteAudio.muted = speakerMuted;

  if (speakerMuted) {
    toggleSpeakerBtn.classList.add("muted");
    toggleSpeakerBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    showToast("Loa đã tắt", "info");
  } else {
    toggleSpeakerBtn.classList.remove("muted");
    toggleSpeakerBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    showToast("Loa đã bật", "info");
  }
};


// ====== UI helpers ======
function showCallUI(role, userInfo = {}) {
  callModal.style.display = 'flex';

  // cập nhật avatar + tên
  document.getElementById("call-username").textContent = userInfo.username || "Người dùng";
  document.getElementById("call-avatar").src = userInfo.avatar || "default-avatar.png";

  if (role === 'caller') {
    acceptBtn.style.display = 'none';
    rejectBtn.style.display = 'none';
    endBtn.style.display = 'inline-block';
    callStatus.textContent = 'Đang gọi...';
  } else if (role === 'callee') {
    acceptBtn.style.display = 'inline-block';
    rejectBtn.style.display = 'inline-block';
    endBtn.style.display = 'none';
    callStatus.textContent = 'Có cuộc gọi đến...';
  }
}


function switchToInCallUI() {
  acceptBtn.style.display = 'none';
  rejectBtn.style.display = 'none';
  endBtn.style.display = 'inline-block';
  document.getElementById("call-status").textContent = 'Đang trò chuyện';
  // avatar + username giữ nguyên từ showCallUI()
}


// ====== Caller actions ======
callBtn.addEventListener('click', () => {
  console.log("☎️ Caller click Gọi, emit call:init");
  socket.emit('call:init', { calleeId: chatWithUserId });
  showCallUI('caller', { username: user.username, avatar: user.avatar });});

// Server trả về callId + rtcRoomId cho caller
socket.on('call:created', async ({ callId, rtcRoomId }) => {
  currentCallId = callId;
  currentRoomId = rtcRoomId;
  console.log("📞 call:created", callId, rtcRoomId);

  // Join RTC room trước khi tạo offer
  socket.emit('join:rtc', { rtcRoomId: currentRoomId });
  console.log('Joined rtc room (caller), initPeer as caller');

  await initPeer(true, currentRoomId);
});

// ====== Callee actions ======
socket.on('call:ring', ({ callId, rtcRoomId, from }) => {
  console.log("📞 call:ring from", from, "room", rtcRoomId);
  currentCallId = callId;
  currentRoomId = rtcRoomId;
  showCallUI('callee', { username: from.username, avatar: from.avatar });
});

acceptBtn.onclick = async () => {
  try {
    socket.emit('join:rtc', { rtcRoomId: currentRoomId });
    console.log('✅ Callee joining rtc room, initPeer(false)');

    await initPeer(false, currentRoomId);

    socket.emit('call:accept', { callId: currentCallId });
    switchToInCallUI();
  } catch (err) {
    console.error('❌ Error in accept flow', err);
  }
};

rejectBtn.onclick = () => {
  console.log("❌ Callee reject call", currentCallId);
  socket.emit('call:reject', { callId: currentCallId });
  callModal.style.display = 'none';
};

endBtn.onclick = () => {
  console.log("☎️ End call", currentCallId);
  if (currentCallId) socket.emit('call:end', { callId: currentCallId });
  //cleanupCall();
};

// ====== State update ======
socket.on('call:accepted', async () => {
  console.log('📥 call:accepted received (caller should now send offer)');
  switchToInCallUI();

  // Caller tạo offer ở đây
  if (peerConnection) {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log("📤 Sending offer:", offer.type);
      socket.emit("rtc:offer", { rtcRoomId: currentRoomId, sdp: offer });
    } catch (err) {
      console.error("❌ Error creating offer", err);
    }
  }
});

socket.on('call:rejected', () => {
  console.log("📥 call:rejected");
  showToast("người dùng đã từ chối cuộc gọi ", "success");
  cleanupCall();
});

socket.on('call:ended', () => {
  console.log("📥 call:ended");
  showToast("Cuộc gọi đã kết thúc", "success");
  cleanupCall();
});

// ===== WebRTC setup =====
async function initPeer(isCaller, rtcRoomId) {
  console.log("⚙️ initPeer", isCaller ? "caller" : "callee");

  peerConnection = new RTCPeerConnection();

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("📤 Sending ICE candidate:", event.candidate.candidate);
      socket.emit("rtc:candidate", { rtcRoomId, candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    console.log("📥 Remote track received:", event.streams[0]);
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.play().catch(err => console.error("Remote audio play error:", err));
    startMeter(event.streams[0], "remote");
  };

  // Lấy mic
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startMeter(localStream, "local");
    console.log("🎤 Got localStream tracks:", localStream.getTracks().map(t => t.kind));
    localStream.getTracks().forEach(track => {
      console.log("🔊 Adding local track:", track.kind, track.id);
      peerConnection.addTrack(track, localStream);
    });
  } catch (err) {
    console.error("❌ Error accessing microphone", err);
  }
}

// ===== Handle offer/answer/candidate =====
socket.on('rtc:offer', async ({ sdp }) => {
  console.log('📥 rtc:offer received', sdp.type);
  if (!peerConnection) {
    console.warn('PeerConnection not ready — creating as callee');
    await initPeer(false, currentRoomId);
  }
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  console.log('📤 Sending answer:', answer.type);
  socket.emit('rtc:answer', { rtcRoomId: currentRoomId, sdp: answer });
});

socket.on('rtc:answer', async ({ sdp }) => {
  console.log('📥 rtc:answer received', sdp.type);
  if (!peerConnection) {
    console.error('❌ No peerConnection when receiving answer');
    return;
  }
  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on('rtc:candidate', async ({ candidate }) => {
  console.log('📥 rtc:candidate received', candidate && candidate.candidate);
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('❌ Error adding ICE candidate', e);
    }
  } else {
    console.warn('No peerConnection to add ICE candidate to');
  }
});

function cleanupCall() {
  console.log("🧹 cleanupCall");
  callModal.style.display = 'none';
  if (peerConnection) peerConnection.close();
  peerConnection = null;

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
  localStream = null;

  // ==== Dọn audio meter ====
  if (localAudioCtx) { localAudioCtx.close(); localAudioCtx = null; }
  if (remoteAudioCtx) { remoteAudioCtx.close(); remoteAudioCtx = null; }

  currentCallId = null;
  currentRoomId = null;
}
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Tự remove sau 4 giây
  setTimeout(() => {
    toast.remove();
  }, 4000);
}






  // Gọi luôn khi load trang
  loadFriends();
  loadMessages();
});
