import { authFetch } from './authFetch.js';

// === Kết nối socket toàn cục ===
const socket = io('/', {
  auth: { token: localStorage.getItem('accessToken') }
});

document.addEventListener('DOMContentLoaded', async () => {
  const createGroupBtn = document.getElementById('create-group-btn');
  const popup = document.getElementById('create-group-popup');
  const overlay = document.getElementById('popup-overlay');
  const cancelBtn = document.getElementById('cancel-create-group');
  const confirmBtn = document.getElementById('confirm-create-group');
  const groupNameInput = document.getElementById('group-name');
  const groupListEl = document.getElementById('group-list');
  const chatHeader = document.getElementById('chat-header');
  const chatMessages = document.getElementById('chat-messages');
  const friendListContainer = document.getElementById('friend-list-for-group');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  // Thay 2 dòng myUser/myId hiện tại bằng:
  let myUser = null;
  let myId = null;
  
  async function fetchMyProfile() {
    try {
      const res = await authFetch('/api/users/me');
      if (res.ok) {
        myUser = await res.json();
        myId = Number(myUser.id);
        console.log('[INIT] myId from API:', myId, myUser);
      } else {
        console.error('Không lấy được profile');
      }
    } catch (err) {
      console.error('Lỗi lấy profile:', err);
    }
  }
  
  await fetchMyProfile();
  // Khử trùng lặp tin nhắn theo id
  const seenMsgIds = new Set();


  
  let groups = [];
  let friends = [];
  let currentGroupId = null;
  let currentGroupName = null;

  // ============ FIX CHÍNH: chặn lẫn với 1-1 ============
  // Khi đang mở nhóm (currentGroupId != null), ta chặn click từ lan xuống handler của chat.js
  // bằng capture-phase + stopImmediatePropagation.
  sendBtn.addEventListener('click', (e) => {
    if (!currentGroupId) return; // không phải chế độ nhóm → để 1-1 xử lý
    e.preventDefault();
    e.stopImmediatePropagation(); // chặn handler của chat.js
    sendGroupMessage();
  }, { capture: true });
  // hàm chuẩn hóa 
  function normalizeMsg(raw) {
    const m = { ...raw };
  
    if (m.groupId != null && m.group_id == null) m.group_id = m.groupId;
  
    // Luôn lấy sender_id ưu tiên id gốc
    m.sender_id =
      m.sender_id ??
      m.senderId ??
      m.user_id ??
      m.userId ??
      (m.sender && (m.sender.id ?? m.sender.userId ?? m.sender.user_id));
  
    // Ép kiểu number để so sánh không bị lệch
    if (m.sender_id != null) {
      m.sender_id = Number(m.sender_id);
    }
  
    if (!m.username && typeof m.sender === 'object') {
      m.username = m.sender.username ?? m.username;
      m.avatar   = m.sender.avatar   ?? m.avatar;
    }
  
    return m;
  }
  
  
  
  


  function addGroupMessageToUI(raw) {
    // Nếu chưa có myId thì không render ngay
    if (myId == null) {
      console.warn('[WARN] myId chưa sẵn sàng, bỏ qua message tạm thời:', raw);
      return;
    }
  
    const msg = normalizeMsg(raw);
  
    if (msg.id != null) {
      const key = String(msg.id);
      if (seenMsgIds.has(key)) return;
      seenMsgIds.add(key);
    }
  
    const isMine = Number(msg.sender_id) === Number(myId);
    console.log('[RENDER]', 'myId:', myId, 'msg.sender_id:', msg.sender_id, 'isMine:', isMine);
  
    const row = document.createElement('div');
    row.className = 'msg-row ' + (isMine ? 'mine' : 'other');
  
    if (isMine) {
      const bubble = document.createElement('div');
      bubble.className = 'message mine';
      bubble.textContent = msg.content;
      row.appendChild(bubble);
    } else {
      const avatar = document.createElement('img');
      avatar.className = 'avatar';
      avatar.src = msg.avatar || '/images/default-avatar.png';
      avatar.alt = 'avatar';
  
      const bubble = document.createElement('div');
      bubble.className = 'message other';
      bubble.innerHTML = `
        <div class="username">${msg.username || 'Người dùng'}</div>
        <div class="text">${msg.content}</div>
      `;
  
      row.appendChild(avatar);
      row.appendChild(bubble);
    }
  
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  
  
  
  

  async function loadGroupMessages(groupId) {
    try {
      chatMessages.innerHTML = `
        <div class="skeleton-message"></div>
        <div class="skeleton-message mine"></div>
        <div class="skeleton-message"></div>
      `;
      const res = await authFetch(`/api/groups/${groupId}/messages`);
      const list = await res.json();
      chatMessages.innerHTML = '';
      list.forEach(m => addGroupMessageToUI(m));
    } catch (err) {
      console.error('Lỗi load tin nhắn nhóm:', err);
    }
  }

  async function openGroupChat(groupId, groupName, membersCount) {
    currentGroupId = groupId;
    currentGroupName = groupName;
  
    const memberLabel = membersCount != null 
      ? `<div class="group-members-count" style="cursor:pointer;color:#28A745;font-size:14px">${Number(membersCount)} thành viên</div>` 
      : '';
  
    chatHeader.innerHTML = `
      <div class="group-header">
        <strong style="font-size:30px;">${groupName}</strong>
        ${memberLabel}
      </div>
    `;
  
    // Gắn sự kiện click xem danh sách thành viên
    const memberCountEl = chatHeader.querySelector('.group-members-count');
    if (memberCountEl) {
      memberCountEl.addEventListener('click', () => openMembersPopup(groupId));
    }
  
    chatMessages.innerHTML = '';
  
    // Clear de-dupe cho phòng mới
    seenMsgIds.clear();
  
    socket.emit('join:group', { groupId });
    await loadGroupMessages(groupId);
  }
  
  
  
  
  

  async function sendGroupMessage() {
    if (!currentGroupId) return;
    const text = messageInput.value.trim();
    if (!text) return;
  
    try {
      const res = await authFetch(`/api/groups/${currentGroupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.message || 'Không gửi được tin nhắn');
        return;
      }
      const saved = await res.json();
  
      // Bổ sung tối thiểu để phân loại đúng
      saved.group_id  = saved.group_id  ?? currentGroupId;
      saved.sender_id = myId; // ép chắc chắn là mình
      saved.username  = saved.username  ?? myUser?.username;
      saved.avatar    = saved.avatar    ?? myUser?.avatar;
  
      // Render ngay; khi socket bắn lại cùng id => seenMsgIds sẽ chặn
      console.log(
        '[SEND]',
        'myId:', myId,
        'saved.sender_id:', saved.sender_id,
        'raw saved:', saved
      );
      
      addGroupMessageToUI(saved);
      messageInput.value = '';
    } catch (err) {
      console.error('Lỗi gửi tin nhắn nhóm:', err);
    }
  }
  
  

  socket.on('group:message', (payload) => {
    if (!currentGroupId || myId == null) return; 
    if (!currentGroupId) return;
    const msg = normalizeMsg(payload);
    console.log(
      '[NORMALIZED]',
      'myId:', myId,
      'msg.sender_id:', msg.sender_id,
      'msg:', msg
    );
    
    const gid = msg.group_id ?? msg.groupId;
    if (String(gid) !== String(currentGroupId)) return;
    console.log(
      '[SOCKET]',
      'myId:', myId,
      'payload:', payload
    );    
    addGroupMessageToUI(msg); // đã có de-dupe & phân loại mine/other
  });
  
  

  socket.on('group:new', (group) => {
    const myUserId = JSON.parse(localStorage.getItem('user')).id;
    if (group.owner_id === myUserId) return;
    if (!groups.find(g => g.id === group.id)) {
      groups.push(group);
      renderGroups();
    }
  });
  socket.on('group:system_message', (msg) => {
    const div = document.createElement('div');
    div.classList.add('system-message');
    div.innerHTML = `<span class="username">${msg.username}</span> <span class="action">${msg.action}</span>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
  
  
  async function loadGroups() {
    const res = await authFetch('/api/groups/my');
    groups = await res.json();
    renderGroups();
  }

  function renderGroups() {
    groupListEl.innerHTML = '';
    groups.forEach(group => {
      const li = document.createElement('li');
      li.className = 'group-item';
      li.innerHTML = `
        <div class="group-name">${group.name}</div>
        <button class="leave-group-btn" data-id="${group.id}">Rời nhóm</button>
      `;
      li.querySelector('.group-name').addEventListener('click', () => {
        openGroupChat(group.id, group.name, group.members_count);
      });      
      li.querySelector('.leave-group-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Bạn chắc chắn muốn rời nhóm này?')) return;
        const res = await authFetch(`/api/groups/${group.id}/leave`, { method: 'DELETE' });
        if (res.ok) {
          // Nếu đang mở nhóm này thì "thoát khỏi chế độ nhóm"
          if (String(currentGroupId) === String(group.id)) {
            currentGroupId = null;
            currentGroupName = null;
            chatHeader.innerHTML = '';
            chatMessages.innerHTML = '';
          }
          groups = groups.filter(g => g.id !== group.id);
          renderGroups();
        }
      });
      groupListEl.appendChild(li);
    });
  }

  createGroupBtn.addEventListener('click', async () => {
    popup.style.display = 'block';
    overlay.style.display = 'block';

    const res = await authFetch('/api/friends');
    friends = await res.json();
    renderFriendListForGroup();
  });

  cancelBtn.addEventListener('click', () => {
    popup.style.display = 'none';
    overlay.style.display = 'none';
  });

  confirmBtn.addEventListener('click', async () => {
    const name = groupNameInput.value.trim();
    if (!name) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }
    const selected = [...document.querySelectorAll('.friend-checkbox:checked')]
    .map(cb => Number(cb.value))
    .filter(id => !isNaN(id));
      if (selected.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên');
      return;
    }

    const res = await authFetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, members: selected })
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.message || 'Không tạo được nhóm');
      return;
    }
    const group = await res.json();
    groups.push(group);
    renderGroups();
    popup.style.display = 'none';
    overlay.style.display = 'none';
    groupNameInput.value = '';
  });

  function renderFriendListForGroup() {
    friendListContainer.innerHTML = '';
    friends.forEach(f => {
      const li = document.createElement('li');
      li.innerHTML = `
        <label>
          <input type="checkbox" class="friend-checkbox" value="${f.friend_id}">
          ${f.username}
        </label>
      `;
      friendListContainer.appendChild(li);
    });
  }
  // xem số lượng thành viên 
  const membersPopup = document.getElementById('group-members-popup');
  const membersListEl = document.getElementById('group-members-list');
  const closeMembersPopup = document.getElementById('close-members-popup');

  async function openMembersPopup(groupId) {
  try {
    const res = await authFetch(`/api/groups/${groupId}/members`);
    const members = await res.json();
    membersListEl.innerHTML = '';
    members.forEach(m => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.marginBottom = '5px';
      li.innerHTML = `
        <img src="${m.avatar || '/images/default-avatar.png'}" style="width:24px;height:24px;border-radius:50%;margin-right:8px;">
        <span>${m.username}</span>
      `;
      membersListEl.appendChild(li);
    });
    membersPopup.style.display = 'block';
  } catch (err) {
    console.error('Lỗi lấy thành viên nhóm:', err);
  }
  }

  closeMembersPopup.addEventListener('click', () => {
    membersPopup.style.display = 'none';
  });
  socket.on('group:membersUpdated', async ({ groupId }) => {
    if (membersPopup.style.display === 'block' && groupId === currentGroupId) {
      await openMembersPopup(groupId);
    }
  });
  socket.on('group:removed', ({ groupId }) => {
    groups = groups.filter(g => Number(g.id) !== Number(groupId));
    renderGroups();
  
    // Nếu đang mở nhóm vừa rời
    if (Number(currentGroupId) === Number(groupId)) {
      currentGroupId = null;
      currentGroupName = null;
      chatHeader.innerHTML = '';
      chatMessages.innerHTML = '';
    }
  });
  
  
  

  await loadGroups();
});
