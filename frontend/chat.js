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
  //const mutedUsers = new Set();
// Danh sách user bị tắt thông báo
const mutedUsers = new Set(
  (JSON.parse(localStorage.getItem('mutedUsers') || '[]')).map(String)
);

const isMuted = (id) => mutedUsers.has(String(id));
const saveMuted = () =>
  localStorage.setItem('mutedUsers', JSON.stringify(Array.from(mutedUsers)));

  const chatHeader = document.getElementById('chat-header');
  chatHeader.innerHTML = `
  <img id="chat-avatar" src="${user.avatar || 'default-avatar.png'}" alt="" class="avatar-status">
  <div>
    <span>${user.username}</span>
    <div id="user-status-text" class="offline">🔴 Không hoạt động</div>
  </div>
  <div class="header-actions" style="margin-left:auto; position:relative;">
    <button id="more-options-btn" class="more-options-btn"><i class="fa-solid fa-ellipsis"></i></button>
    <div id="more-options-popup" class="more-options-popup">
      <button id="call-btn"><i class="fa-solid fa-phone"></i> Gọi</button>
      <button id="video-call-btn"><i class="fa-solid fa-video"></i> Gọi video</button>
      <button id="block-btn"><i class="fa-solid fa-user-slash"></i> Chặn</button>
      <button id="toggle-notification-btn"><i class="fa-solid fa-bell-slash"></i> Tắt thông báo</button>
      <button id="delete-chat-btn"><i class="fa-solid fa-trash"></i> Xóa tin nhắn</button>
      <button id="change-bg-btn"><i class="fa-solid fa-image"></i> Đổi nền chat</button>
      <button id="remove-bg-btn"><i class="fa-solid fa-ban"></i> Xóa nền chat</button>
      <input type="file" id="bg-upload" accept="image/*" style="display:none">
    </div>

  </div>
`;
//tạo nút tắt thông báo 
const toggleNotifBtn = document.getElementById('toggle-notification-btn');
if (mutedUsers.has(chatWithUserId)) {
  toggleNotifBtn.innerHTML = '<i class="fa-solid fa-bell"></i> Mở thông báo';
} else {
  toggleNotifBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Tắt thông báo';
}
toggleNotifBtn.addEventListener('click', () => {
  if (isMuted(chatWithUserId)) {
    mutedUsers.delete(String(chatWithUserId));
    toggleNotifBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Tắt thông báo';
  } else {
    mutedUsers.add(String(chatWithUserId));
    toggleNotifBtn.innerHTML = '<i class="fa-solid fa-bell"></i> Mở thông báo';
  }

  saveMuted();

  // ✅ an toàn, không dùng optional chaining
  const morePopupEl = document.getElementById('more-options-popup');
  if (morePopupEl) {
    morePopupEl.style.display = 'none';
  }

  updateFriendNotificationIcon(chatWithUserId);
});



function updateFriendNotificationIcon(userId) {
  const item = document.querySelector(`#user-suggestions .msg-btn[data-id="${userId}"]`)?.closest('.friend-item');
  if (!item) return;

  let bellIcon = item.querySelector('.mute-icon');
  if (!bellIcon) {
    bellIcon = document.createElement('i');
    bellIcon.className = 'fa-solid fa-bell-slash mute-icon';
    bellIcon.style.marginLeft = '6px';
    item.querySelector('.msg-btn').after(bellIcon);
  }

  bellIcon.style.display = isMuted(userId) ? 'inline-block' : 'none';
}

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
  
  // async function loadMessages() {
  //   const res = await authFetch(`/api/messages/${chatWithUserId}`);
  //   const messages = await res.json();
  
  //   document.querySelectorAll('.skeleton-message').forEach(el => el.remove());
  
  //   messages.forEach(addMessageToUI);
  
  //   // Reset badge ngay khi load tin nhắn (frontend)
  //   resetUnread(chatWithUserId);
  
  //   // Đánh dấu tất cả tin nhắn từ người chat là đã xem (backend)
  //   await authFetch(`/api/messages/${chatWithUserId}/seen_all`, { method: 'PUT' });
  // }
  // // load lịch sử cuộc gọi 
  // async function loadCalls() {
  //   const res = await authFetch(`/api/calls?userId=${me.id}&chatWithUserId=${chatWithUserId}`);
  //   const data = await res.json();
  //   if (data.success) {
  //     data.calls.forEach(addCallToUI);
  //   }
  // }

  
  //test
  async function loadConversation() {
    try {
      const [msgRes, callRes] = await Promise.all([
        authFetch(`/api/messages/${chatWithUserId}`),
        authFetch(`/api/calls?userId=${me.id}&chatWithUserId=${chatWithUserId}`)
      ]);
  
      const messages = await msgRes.json();
      const callsData = await callRes.json();
      const calls = callsData.success ? callsData.calls : [];
  
      // Chuẩn hoá dữ liệu
      const msgItems = messages.map(m => ({
        type: 'message',
        createdAt: new Date(m.created_at),
        data: m
      }));
  
      const callItems = calls.map(c => ({
        type: 'call',
        createdAt: new Date(c.started_at),
        data: c
      }));
  
      // Merge + sort theo thời gian
      const allItems = [...msgItems, ...callItems];
      allItems.sort((a, b) => a.createdAt - b.createdAt);
  
      // Clear khung chat
      const chatBox = document.getElementById('chat-messages');
      chatBox.innerHTML = '';
  
      // Render theo timeline
      allItems.forEach(item => {
        if (item.type === 'message') {
          addMessageToUI(item.data);
        } else {
          addCallToUI(item.data);
        }
      });
  
      // Reset badge + mark seen
      resetUnread(chatWithUserId);
      await authFetch(`/api/messages/${chatWithUserId}/seen_all`, { method: 'PUT' });
  
    } catch (err) {
      console.error('loadConversation error:', err);
    }
  }
  
  function addCallToUI(call) {
    if (document.getElementById(`call-${call.id}`)) return;
  
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'call-log');
    msgDiv.id = `call-${call.id}`;
  
    // style success / failed
    if (call.status === 'ended') {
      msgDiv.classList.add('success');
    } else if (call.status === 'missed' || call.status === 'rejected') {
      msgDiv.classList.add('failed');
    }
    msgDiv.classList.add(call.caller_id == me.id ? 'mine' : 'other');
  
    // chọn icon theo type
    const icons = {
      voice: {
        success: '<i class="fa-solid fa-phone" style="color:green"></i>',
        fail: '<i class="fa-solid fa-phone-slash" style="color:red"></i>',
        missed: '<i class="fa-solid fa-phone-missed" style="color:red"></i>',
        default: '<i class="fa-solid fa-phone" style="color:gray"></i>'
      },
      video: {
        success: '<i class="fa-solid fa-video" style="color:green"></i>',
        fail: '<i class="fa-solid fa-video-slash" style="color:red"></i>',
        missed: '<i class="fa-solid fa-video" style="color:red"></i>',
        default: '<i class="fa-solid fa-video" style="color:gray"></i>'
      }
    };
  
    let content = '';
    const isVideo = call.type === 'video';
  
    if (call.status === 'rejected') {
      content = `${isVideo ? icons.video.fail : icons.voice.fail} 
                 Cuộc gọi ${isVideo ? 'video ' : ''}bị từ chối (${new Date(call.started_at).toLocaleTimeString()})`;
    } else if (call.status === 'ended') {
      const minutes = call.duration ? Math.floor(call.duration / 60) : 0;
      const seconds = call.duration ? call.duration % 60 : 0;
      content = `${isVideo ? icons.video.success : icons.voice.success} 
                 Đã gọi ${isVideo ? 'video ' : ''}${minutes} phút ${seconds} giây (${new Date(call.started_at).toLocaleTimeString()})`;
    } else if (call.status === 'missed') {
      content = `${isVideo ? icons.video.missed : icons.voice.missed} 
                 Cuộc gọi ${isVideo ? 'video ' : ''}nhỡ (${new Date(call.started_at).toLocaleTimeString()})`;
    } else {
      content = `${isVideo ? icons.video.default : icons.voice.default} 
                 Cuộc gọi ${isVideo ? 'video ' : ''}(${call.status}) - ${new Date(call.started_at).toLocaleTimeString()}`;
    }
  
    msgDiv.innerHTML = content;
    document.getElementById('chat-messages').appendChild(msgDiv);
  }
  

   socket.on('call:rejected', (call) => {
     addCallToUI(call);
   });
   socket.on('call:ended', (call) => {
     addCallToUI(call);
   });
    

  let lastMessageDate = null; // lưu ngày của tin nhắn trước đó


  function addMessageToUI(msg) {
    const dateObj = new Date(msg.created_at);
  
    // Ép giờ Việt Nam
    const msgDateStr = dateObj.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }); // dd/mm/yyyy
    const msgTimeStr = dateObj.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh'
    }); // HH:MM:SS
  
    // Tạo phần tử tin nhắn
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.dataset.id = msg.id;
    msgDiv.dataset.senderId = String(msg.sender_id);
    if (msg.sender_id == me.id) msgDiv.classList.add('mine');
    else msgDiv.classList.add('other');
  
    // --- Tooltip thời gian ---
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('msg-time-tooltip');
    timeSpan.textContent = msgTimeStr;
    msgDiv.appendChild(timeSpan);
  
    // --- Tin nhắn trả lời ---
    if (msg.reply_message) {
      const replyBlock = document.createElement('div');
      replyBlock.classList.add('reply-block');
      replyBlock.onclick = (e) => {
        e.stopPropagation();
        const targetId = msg.reply_message?.id;
        if (!targetId) return;
        const targetMsg = document.querySelector(`.message[data-id="${targetId}"]`);
        if (targetMsg) {
          targetMsg.scrollIntoView({ behavior: "smooth", block: "center" });
          targetMsg.classList.add("highlight-reply");
          setTimeout(() => targetMsg.classList.remove("highlight-reply"), 1500);
        }
      };
  
      if (msg.reply_message.content) {
        replyBlock.textContent = ` ${msg.reply_message.content}`;
      } else if (msg.reply_message.media_url) {
        replyBlock.textContent = msg.reply_message.media_type === 'image' ? '📷 Ảnh' : '🎥 Video';
      } else {
        replyBlock.textContent = '↩️ Tin nhắn đã xoá';
      }
  
      msgDiv.insertBefore(replyBlock, msgDiv.firstChild);
    }
  
    // --- Nội dung text ---
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
    } else if (msg.media_type === 'video') {
    const video = document.createElement('video');
    video.src = msg.media_url;
    video.controls = true;
    video.style.maxWidth = '260px';
    msgDiv.appendChild(video);
    } else if (msg.media_type === 'audio') {
    // Voice message bubble
    msgDiv.classList.add('voice-message');
  
    // 👇 Thêm class has-text nếu có text kèm voice
    if (msg.content && msg.content.trim() !== '') {
      msgDiv.classList.add('has-text');
    }
  
    const bubble = document.createElement('div');
    bubble.classList.add('voice-bubble');
  
    // Play button
    const playBtn = document.createElement('button');
    playBtn.classList.add('play-btn');
    playBtn.setAttribute('type', 'button');
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  
    // Waveform bars (visual only)
    const wave = document.createElement('div');
    wave.classList.add('voice-wave');
    for (let i = 0; i < 5; i++) {
      const bar = document.createElement('div');
      bar.classList.add('wave-bar');
      wave.appendChild(bar);
    }
  
    // Duration text
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('voice-time');
    timeSpan.textContent = '0:00';
  
    // Hidden audio element
    const audio = document.createElement('audio');
    audio.src = msg.media_url;
    audio.preload = 'metadata';
  
    audio.onloadedmetadata = () => {
      const dur = Math.floor(audio.duration) || 0;
      const min = Math.floor(dur / 60);
      const sec = dur % 60;
      timeSpan.textContent = `${min}:${String(sec).padStart(2, '0')}`;
    };
  
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.voice-bubble audio').forEach(a => {
        if (a !== audio) {
          a.pause();
          const otherBtn = a.closest('.voice-bubble')?.querySelector('.play-btn');
          if (otherBtn) otherBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
      });
      if (audio.paused) {
        audio.play();
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      } else {
        audio.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      }
    });
  
    audio.addEventListener('click', e => e.stopPropagation());
    wave.addEventListener('click', e => e.stopPropagation());
    audio.addEventListener('play', () => playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>');
    audio.addEventListener('pause', () => playBtn.innerHTML = '<i class="fa-solid fa-play"></i>');
    audio.addEventListener('ended', () => playBtn.innerHTML = '<i class="fa-solid fa-play"></i>');
  
    bubble.appendChild(playBtn);
    bubble.appendChild(wave);
    bubble.appendChild(timeSpan);
    bubble.appendChild(audio);
  
    msgDiv.appendChild(bubble);
    } else {
    // fallback
    const fileLink = document.createElement('a');
    fileLink.href = msg.media_url;
    fileLink.target = '_blank';
    fileLink.textContent = 'Tệp đính kèm';
    msgDiv.appendChild(fileLink);
    }
  }

  
    // --- Nút reply ---
    const replyBtn = document.createElement('button');
    replyBtn.classList.add('reply-btn');
    replyBtn.innerHTML = '<i class="fa fa-reply"></i>';
    replyBtn.onclick = (e) => { e.stopPropagation(); showReplyPreview(msg); };
    msgDiv.appendChild(replyBtn);
  
    // --- Trạng thái tin nhắn ---
    const statusEl = document.createElement('div');
    statusEl.classList.add('msg-status');
    statusEl.textContent = msg.seen_at ? '✓ Đã xem' : '✓ Đã gửi';
    statusEl.style.display = 'none';
    msgDiv.appendChild(statusEl);
  
    // --- Xử lý click xóa / context menu ---
    if (msg.sender_id == me.id) {
      msgDiv.addEventListener('click', async (e) => {
        // Nếu bấm vào nút (button, icon, audio, img...) thì không xoá
        if (
          e.target.closest('button') ||
          e.target.tagName === 'AUDIO' ||
          e.target.tagName === 'VIDEO' ||
          e.target.tagName === 'IMG' ||
          e.target.closest('.reply-btn') ||
          e.target.closest('.play-btn')
        ) {
          return; // ❌ không chạy xoá
        }
    
        e.preventDefault();
        if (confirm('Bạn có chắc muốn xóa tin nhắn này không?')) {
          try {
            const res = await authFetch(`/api/messages/${msg.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) msgDiv.remove();
            else alert(data.message || 'Không thể xóa tin nhắn');
          } catch (err) {
            console.error('Lỗi xóa tin nhắn:', err);
          }
        }
      });
    }
    
  
    // --- Divider theo ngày ---
    let divider = document.querySelector(`.date-divider[data-date="${msgDateStr}"]`);
    if (!divider) {
      divider = document.createElement('div');
      divider.classList.add('date-divider');
      divider.dataset.date = msgDateStr;
      divider.textContent = `--- ${msgDateStr} ---`;
      messageList.appendChild(divider);
    }
  
    messageList.appendChild(msgDiv);
    messageList.scrollTop = messageList.scrollHeight;
  }
  
  
  
  
  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  //let replyToMessage = null; // biến toàn cục lưu tin nhắn đang reply

  // sendBtn.addEventListener('click', async () => {
  //   if (messageInput.disabled) {
  //     alert('Bạn không thể nhắn tin với người này.');
  //     return;
  //   }
  
  //   const formData = new FormData();
  //   formData.append('receiver_id', chatWithUserId);
  
  //   const text = messageInput.value.trim();
  //   if (text) formData.append('content', text);
  //   if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
  
  //   // ✅ thêm reply_to nếu có
  //   if (replyToMessage) {
  //     formData.append('reply_to', replyToMessage.id);
  //   }
  
  //   if (!text && !fileInput.files[0]) return;
  
  //   try {
  //     const res = await authFetch('/api/messages', { method: 'POST', body: formData });
  //     if (!res.ok) {
  //       const errorData = await res.json();
  //       alert(errorData.message || 'Lỗi khi gửi tin nhắn');
  //       return;
  //     }
  //     const message = await res.json();
  //     addMessageToUI(message);
  
  //     // Reset input
  //     messageInput.value = '';
  //     fileInput.value = '';
  //     chatInputBox.classList.remove('typing');
  
  //     // ✅ reset trạng thái reply
  //     replyToMessage = null;
  //     document.getElementById('reply-preview').style.display = 'none';
  
  //   } catch (error) {
  //     console.error('Lỗi gửi tin nhắn:', error);
  //     alert('Lỗi khi gửi tin nhắn');
  //   }
  // });
  
  
  sendBtn.addEventListener('click', async () => {
    if (messageInput.disabled) {
      alert('Bạn không thể nhắn tin với người này.');
      return;
    }
  
    // 🔹 Ưu tiên gửi voice nếu có
    if (recordedVoiceFile) {
      const formData = new FormData();
      formData.append('receiver_id', chatWithUserId);
  
      // Nếu bạn muốn cho phép kèm text caption thì giữ đoạn này:
      const text = messageInput.value.trim();
      if (text) formData.append('content', text);
  
      formData.append('file', recordedVoiceFile);
  
      if (replyToMessage) {
        formData.append('reply_to', replyToMessage.id);
      }
  
      try {
        const res = await authFetch('/api/messages', { method: 'POST', body: formData });
        if (!res.ok) {
          const errorData = await res.json();
          alert(errorData.message || 'Lỗi khi gửi ghi âm');
          return;
        }
        const message = await res.json();
        addMessageToUI(message);
  
        // Reset voice state
        recordedVoiceFile = null;
        if (recordedVoiceUrl) {
          URL.revokeObjectURL(recordedVoiceUrl);
          recordedVoiceUrl = null;
        }
        document.getElementById('voice-preview').style.display = 'none';
  
        // Reset input text
        messageInput.value = '';
        fileInput.value = '';
        chatInputBox.classList.remove('typing');
        replyToMessage = null;
        document.getElementById('reply-preview').style.display = 'none';
  
      } catch (error) {
        console.error('Lỗi gửi voice message:', error);
        alert('Lỗi khi gửi ghi âm');
      }
      return; // ⛔ Dừng tại đây, không chạy xuống gửi text/file nữa
    }
  
    // 🔹 Nếu không có voice thì gửi text/file như bình thường
    const formData = new FormData();
    formData.append('receiver_id', chatWithUserId);
  
    const text = messageInput.value.trim();
    if (text) formData.append('content', text);
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);
  
    if (replyToMessage) {
      formData.append('reply_to', replyToMessage.id);
    }
  
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
  
      // Reset input
      messageInput.value = '';
      fileInput.value = '';
      chatInputBox.classList.remove('typing');
      replyToMessage = null;
      document.getElementById('reply-preview').style.display = 'none';
  
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
  
      // 🚫 Chỉ hiện toast nếu người gửi KHÔNG bị mute
      if (!isMuted(senderId)) {
        showToastNotification(msg, { username: senderName, avatar });
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
            <img src="${friend.avatar || 'default-avatar.png'}" alt="${friend.username}" class="avatar offline">
            <span class="online-dot" style="display:none;"></span>
          </div>
          <span class="friend-name">${friend.username}</span>
          <button class="msg-btn" data-id="${friend.friend_id}">💬 Nhắn tin</button>
        `;
        listEl.appendChild(li);
        updateFriendNotificationIcon(friend.friend_id);


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
      
          // Reset badge
          unreadCounts.set(id, 0);
          updateUnreadBadge(id);
          await authFetch(`/api/messages/${id}/seen_all`, { method: 'PUT' });
      
          // Trong handler click của '#user-suggestions' khi bấm .msg-btn
          if (window.innerWidth < 768) {
  // ✅ Mobile: chuyển hẳn sang URL có user để vào đúng khung chat
  window.location.href = `chat.html?user=${id}`;
          } else {
  // Desktop giữ nguyên
  window.location.href = `chat.html?user=${id}`;
          }

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

  // 🚫 Nếu user đã bị mute thì ẩn badge và return luôn
  if (isMuted(userId)) {
    if (badge) badge.style.display = 'none';
    return;
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
// cuộn 
// ====== SCROLL TO BOTTOM ======
const scrollBtn = document.getElementById('scrollToBottomBtn');
const chatMessages = document.getElementById('chat-messages');

// Hàm cuộn xuống cuối
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Bấm nút thì cuộn xuống
if (scrollBtn) {
  scrollBtn.addEventListener('click', scrollToBottom);
}

// Hiện/ẩn nút khi user kéo lên
if (chatMessages) {
  chatMessages.addEventListener('scroll', () => {
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 50;
    scrollBtn.style.display = isAtBottom ? 'none' : 'block';
  });
}


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
function showCallUI(role, userInfo = {}, callType = 'voice') {
  callModal.style.display = 'flex';
  document.getElementById("call-username").textContent = userInfo.username || "Người dùng";
  document.getElementById("call-avatar").src = userInfo.avatar || "default-avatar.png";

  // Hiển thị video nếu là call video
  if (callType === 'video') {
    document.getElementById("local-video").style.display = "block";
    document.getElementById("remote-video").style.display = "block";
    document.getElementById("remote-audio").style.display = "none";
  } else {
    document.getElementById("local-video").style.display = "none";
    document.getElementById("remote-video").style.display = "none";
    document.getElementById("remote-audio").style.display = "block";
  }

  if (role === 'caller') {
    acceptBtn.style.display = 'none';
    rejectBtn.style.display = 'none';
    endBtn.style.display = 'inline-block';
    callStatus.textContent = callType === 'video' ? 'Đang gọi video...' : 'Đang gọi...';
  } else if (role === 'callee') {
    acceptBtn.style.display = 'inline-block';
    rejectBtn.style.display = 'inline-block';
    endBtn.style.display = 'none';
    callStatus.textContent = callType === 'video' ? 'Có cuộc gọi video đến...' : 'Có cuộc gọi đến...';
  }

  // Lưu type để dùng trong initPeer
  callModal.dataset.type = callType;
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
socket.on('call:ring', ({ callId, rtcRoomId, from, type }) => {
  currentCallId = callId;
  currentRoomId = rtcRoomId;
  showCallUI('callee', { username: from.username, avatar: from.avatar }, type);
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
  const callType = callModal.dataset.type || 'voice';
  peerConnection = new RTCPeerConnection();
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("rtc:candidate", { rtcRoomId, candidate: event.candidate });
    }
  };
  peerConnection.ontrack = (event) => {
    if (callType === 'video') {
      const remoteVideo = document.getElementById("remote-video");
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.style.display = "block";
    } else {
      remoteAudio.srcObject = event.streams[0];
    }
    startMeter(event.streams[0], "remote");
  };
  

  try {
    localStream = await navigator.mediaDevices.getUserMedia(
      callType === 'video' ? { audio: true, video: true } : { audio: true }
    );

    if (callType === 'video') {
      document.getElementById("local-video").srcObject = localStream;
    }
    startMeter(localStream, "local");
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  } catch (err) {
    console.error("❌ Error accessing media devices", err);
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

function openCallModal() {
  document.getElementById("call-modal").classList.add("active");
}

function closeCallModal() {
  document.getElementById("call-modal").classList.remove("active");
}


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
// video call 
const videoCallBtn = document.getElementById('video-call-btn');
videoCallBtn.addEventListener('click', () => {
  socket.emit('call:init', { calleeId: chatWithUserId, type: 'video' });
  showCallUI('caller', { username: user.username, avatar: user.avatar }, 'video');
  morePopup.style.display = 'none';
});
//lưu tin nhắn đang reply
let replyToMessage = null;

function showReplyPreview(msg) {
  replyToMessage = msg;
  document.getElementById('reply-preview').style.display = 'block';
  document.getElementById('reply-preview-text').textContent = msg.content || (msg.media_url ? "📎 Tệp tin" : "");
}

document.getElementById('cancel-reply').addEventListener('click', () => {
  replyToMessage = null;
  document.getElementById('reply-preview').style.display = 'none';
});


// // gửi voice 
// // ==== Voice message (recording) ====
// const recordBtn = document.getElementById('recordBtn');
// const recordTimerEl = document.getElementById('record-timer');

// let mediaRecorder = null;
// let audioChunks = [];
// let recordingInterval = null;
// let recordStartTime = null;
// let cancelled = false;


// function formatTime(sec) {
//   const m = String(Math.floor(sec/60)).padStart(2,'0');
//   const s = String(Math.floor(sec%60)).padStart(2,'0');
//   return `${m}:${s}`;
// }

// const recordWaveformEl = document.getElementById('record-waveform');
// const waveCanvas = document.getElementById('wave-canvas');
// const cancelRecordBtn = document.getElementById('cancel-record-btn');
// const msgInput = document.getElementById('message-input');
// let audioCtx, analyser, dataArray, animationId;

// recordBtn.addEventListener('click', async (e) => {
//   e.preventDefault();

//   if (!mediaRecorder || mediaRecorder.state === 'inactive') {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       mediaRecorder = new MediaRecorder(stream);
//       audioChunks = [];

//       mediaRecorder.ondataavailable = (ev) => {
//         if (ev.data.size > 0) audioChunks.push(ev.data);
//       };

//       mediaRecorder.onstop = async () => {
//         cancelRecordBtn.onclick = null; // reset hủy
//         stopWaveform();
//         msgInput.style.display = 'inline';
//         recordWaveformEl.style.display = 'none';

//         if (cancelled) {
//           cancelled = false;
//           return; // không gửi
//         }

//         // gửi file như cũ
//         const blob = new Blob(audioChunks, { type: 'audio/webm' });
//         const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type });
//         const formData = new FormData();
//         formData.append('receiver_id', chatWithUserId);
//         formData.append('file', file);
//         if (replyToMessage) formData.append('reply_to', replyToMessage.id);

//         try {
//           const res = await authFetch('/api/messages', { method: 'POST', body: formData });
//           const message = await res.json();
//           addMessageToUI(message);
//         } catch (err) {
//           console.error('Lỗi gửi voice message:', err);
//         }
//       };

//       mediaRecorder.start();
//       msgInput.style.display = 'none';
//       recordWaveformEl.style.display = 'flex';
//       startWaveform(stream);

//       // nút hủy
//       cancelled = false;
//       cancelRecordBtn.onclick = () => {
//         cancelled = true;
//         mediaRecorder.stop();
//         mediaRecorder.stream.getTracks().forEach(t => t.stop());
//       };

//     } catch (err) {
//       alert('Vui lòng cho phép truy cập micro');
//     }
//   } else if (mediaRecorder.state === 'recording') {
//     mediaRecorder.stop();
//     mediaRecorder.stream.getTracks().forEach(t => t.stop());
//   }
// });

// function startWaveform(stream) {
//   audioCtx = new AudioContext();
//   analyser = audioCtx.createAnalyser();
//   const source = audioCtx.createMediaStreamSource(stream);
//   source.connect(analyser);
//   analyser.fftSize = 256;
//   const bufferLength = analyser.frequencyBinCount;
//   dataArray = new Uint8Array(bufferLength);

//   const ctx = waveCanvas.getContext('2d');
//   function draw() {
//     animationId = requestAnimationFrame(draw);
//     analyser.getByteFrequencyData(dataArray);
//     ctx.fillStyle = '#111';
//     ctx.fillRect(0, 0, waveCanvas.width, waveCanvas.height);

//     const barWidth = (waveCanvas.width / bufferLength) * 2.5;
//     let x = 0;
//     for (let i = 0; i < bufferLength; i++) {
//       const barHeight = dataArray[i] / 2;
//       ctx.fillStyle = '#4cafef';
//       ctx.fillRect(x, waveCanvas.height - barHeight, barWidth, barHeight);
//       x += barWidth + 1;
//     }
//   }
//   draw();
// }

// function stopWaveform() {
//   if (animationId) cancelAnimationFrame(animationId);
//   if (audioCtx) audioCtx.close();
// }
// let recordTimerInterval = null;

// function startRecordTimer() {
//   recordStartTime = Date.now();
//   const timerEl = document.getElementById('record-timer');
//   timerEl.textContent = "00:00";

//   recordTimerInterval = setInterval(() => {
//     const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
//     const min = Math.floor(elapsed / 60);
//     const sec = elapsed % 60;
//     timerEl.textContent = `${min}:${sec.toString().padStart(2, "0")}`;
//   }, 1000);
// }

// function stopRecordTimer() {
//   clearInterval(recordTimerInterval);
//   recordTimerInterval = null;
// }

// ==== Voice message (recording) ====
const recordBtn = document.getElementById('recordBtn');
const recordWaveformEl = document.getElementById('record-waveform');
const waveCanvas = document.getElementById('wave-canvas');
const cancelRecordBtn = document.getElementById('cancel-record-btn');
const msgInput = document.getElementById('message-input');
// lưu bản ghi tạm trước khi gửi
let recordedVoiceFile = null;
let recordedVoiceUrl = null;
let mediaRecorder = null;
let audioChunks = [];
let cancelled = false;

// Biến cho waveform
let audioCtx, analyser, dataArray, animationId;

// Biến cho timer
let recordStartTime = null;
let recordTimerInterval = null;

function startRecordTimer() {
  recordStartTime = Date.now();
  const timerEl = document.getElementById('record-timer'); // lấy trực tiếp trong DOM

  timerEl.textContent = "00:00";
  console.log("⏱ Timer started...");

  recordTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const sec = String(elapsed % 60).padStart(2, "0");
    timerEl.textContent = `${min}:${sec}`;
    console.log("⏱ elapsed:", elapsed); // debug
  }, 1000);
}

function stopRecordTimer() {
  clearInterval(recordTimerInterval);
  recordTimerInterval = null;
  console.log("⏱ Timer stopped.");
}


function stopRecordTimer() {
  clearInterval(recordTimerInterval);
  recordTimerInterval = null;
}

function startWaveform(stream) {
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  const ctx = waveCanvas.getContext('2d');
  function draw() {
    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, waveCanvas.width, waveCanvas.height);

    const barWidth = (waveCanvas.width / bufferLength) * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] / 2;
      ctx.fillStyle = '#4cafef';
      ctx.fillRect(x, waveCanvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }
  draw();
}

function stopWaveform() {
  if (animationId) cancelAnimationFrame(animationId);
  if (audioCtx) audioCtx.close();
}

recordBtn.addEventListener('click', async (e) => {
  e.preventDefault();

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunks.push(ev.data);
      };

      mediaRecorder.onstop = async () => {
        cancelRecordBtn.onclick = null;
        stopWaveform();
        stopRecordTimer();
      
        // hiện input text lại
        msgInput.style.display = 'inline';
        recordWaveformEl.style.display = 'none';
      
        if (cancelled) {
          cancelled = false;
          audioChunks = [];
          return; // nếu user hủy thì không lưu
        }
      
        // tạo blob nhưng KHÔNG gửi ngay
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        recordedVoiceFile = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type });
        if (recordedVoiceUrl) { URL.revokeObjectURL(recordedVoiceUrl); }
        recordedVoiceUrl = URL.createObjectURL(blob);
      
        // show preview UI (tạo động hoặc cập nhật phần tử đã có)
        showVoicePreview(recordedVoiceUrl);
      
        // reset chunks
        audioChunks = [];
      };
      

      // Bắt đầu ghi âm
      mediaRecorder.start();
      msgInput.style.display = 'none';
      recordWaveformEl.style.display = 'flex';
      startWaveform(stream);
      startRecordTimer();

      // Nút hủy
      cancelled = false;
      cancelRecordBtn.onclick = () => {
        cancelled = true;
        stopRecordTimer();
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
      };

    } catch (err) {
      alert('Vui lòng cho phép truy cập micro');
    }
  } else if (mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
});

// chèn preview nhỏ vào .chat-input (chỉ 1 lần)
(function addVoicePreviewUI(){
  const chatInput = document.querySelector('.chat-input');
  const preview = document.createElement('div');
  preview.id = 'voice-preview';
  preview.style.display = 'none';
  preview.style.alignItems = 'center';
  preview.style.gap = '8px';
  preview.innerHTML = `
    <audio id="voice-preview-audio" controls style="height:30px;"></audio>
    <button id="delete-voice-btn" class="cancel-record-btn" title="Xoá bản ghi"><i class="fa fa-trash"></i></button>
  `;
  chatInput.insertBefore(preview, messageInput); // chèn trước input
  document.getElementById('delete-voice-btn').addEventListener('click', () => {
    if (recordedVoiceUrl) { URL.revokeObjectURL(recordedVoiceUrl); recordedVoiceUrl = null; }
    recordedVoiceFile = null;
    preview.style.display = 'none';
  });
})();

function showVoicePreview(url){
  const preview = document.getElementById('voice-preview');
  const audio = document.getElementById('voice-preview-audio');
  if (!preview || !audio) return;
  audio.src = url;
  preview.style.display = 'flex';
}

  // Gọi luôn khi load trang
  loadFriends();
  loadConversation();
});

// Responsive mobile
function checkMobileView() {
  const isMobile = window.innerWidth < 768;
  document.body.classList.toggle('mobile-view', isMobile);

  if (isMobile) {
    const hasUser = new URLSearchParams(location.search).has('user') 
                 || new URLSearchParams(location.search).has('userId');
    if (hasUser) {
      document.body.classList.add('show-chat');
      document.body.classList.remove('show-list');
    } else {
      document.body.classList.add('show-list');
      document.body.classList.remove('show-chat');
    }
  } else {
    document.body.classList.remove('show-list', 'show-chat');
  }
}
window.addEventListener("resize", checkMobileView);
checkMobileView();


// Xử lý nút back
document.addEventListener("click", (e) => {
  if (e.target.closest(".back-btn")) {
    document.body.classList.remove("show-chat");
    document.body.classList.add("show-list");
  }
});

// Khi bấm nút nhắn tin trong chat-list
document.getElementById("user-suggestions").addEventListener("click", (e) => {
  if (e.target.classList.contains("msg-btn")) {
    if (document.body.classList.contains("mobile-view")) {
      document.body.classList.remove("show-list");
      document.body.classList.add("show-chat");
    }
  }
});


// 📱 Mobile: click "fa-comments" để về chat-list (không reload)
const navCommentsBtn = document.getElementById('nav-comments');
if (navCommentsBtn) {
  navCommentsBtn.addEventListener('click', (e) => {
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('show-chat');
      document.body.classList.add('show-list');
    } else {
      // Desktop: tuỳ bạn, có thể giữ nguyên chuyển về trang chat
      window.location.href = 'chat.html';
    }
  });
}




