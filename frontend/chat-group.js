import { authFetch } from './authFetch.js';

// === Kết nối socket toàn cục (dùng chung với chat.js) ===
const socket = io('/', {
  auth: { token: localStorage.getItem('accessToken') } // sửa key token cho đồng nhất
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

  let groups = [];
  let friends = [];
  let currentGroupId = null;

  // ====== Load danh sách nhóm từ backend ======
  async function loadGroups() {
    try {
      const res = await authFetch('/api/groups/my');
      groups = await res.json();
      renderGroups();
    } catch (err) {
      console.error('Lỗi load nhóm:', err);
    }
  }

  // ====== Load danh sách bạn bè cho popup tạo nhóm ======
  async function loadFriendsForPopup() {
    try {
      const res = await authFetch('/api/friends');
      friends = await res.json();
      friendListContainer.innerHTML = '';
      friends.forEach(fr => {
        const div = document.createElement('div');
        div.innerHTML = `
          <label style="display:flex;align-items:center;gap:6px;">
            <input type="checkbox" value="${fr.friend_id}">
            <img src="${fr.avatar || 'default-avatar.png'}" style="width:24px;height:24px;border-radius:50%;">
            ${fr.username}
          </label>
        `;
        friendListContainer.appendChild(div);
      });
    } catch (err) {
      console.error('Lỗi load bạn bè cho popup:', err);
    }
  }

  // ====== Mở popup ======
  createGroupBtn.addEventListener('click', async () => {
    groupNameInput.value = '';
    await loadFriendsForPopup();
    popup.style.display = 'block';
    overlay.style.display = 'block';
  });

  // ====== Đóng popup ======
  function closePopup() {
    popup.style.display = 'none';
    overlay.style.display = 'none';
  }
  cancelBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', closePopup);

  // ====== Xác nhận tạo nhóm ======
  confirmBtn.addEventListener('click', async () => {
  const name = groupNameInput.value.trim();
  if (!name) return alert('Vui lòng nhập tên nhóm');

  const selectedUserIds = [...friendListContainer.querySelectorAll('input[type="checkbox"]:checked')]
    .map(cb => cb.value);

  if (selectedUserIds.length === 0) return alert('Vui lòng chọn ít nhất 1 thành viên');

  try {
    const res = await authFetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, members: selectedUserIds })
    });
    const data = await res.json();

    // // 🔹 Tự thêm nhóm vào danh sách cho người tạo
    // const myUserId = JSON.parse(localStorage.getItem('user')).id;
    // const newGroup = { id: data.groupId, name, owner_id: myUserId };
    // groups.push(newGroup);
    // renderGroups();

    closePopup();
  } catch (err) {
    console.error('Lỗi tạo nhóm:', err);
  }
  });

  // show popup
  function showConfirm(message) {
    return new Promise((resolve) => {
      const popup = document.getElementById('confirm-leave-popup');
      const overlay = document.getElementById('popup-overlay');
      const confirmText = document.getElementById('confirm-leave-text');
      const cancelBtn = document.getElementById('cancel-leave-btn');
      const okBtn = document.getElementById('confirm-leave-btn');
  
      confirmText.textContent = message;
      popup.style.display = 'block';
      overlay.style.display = 'block';
  
      function cleanup() {
        popup.style.display = 'none';
        overlay.style.display = 'none';
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
      }
  
      function onCancel() {
        cleanup();
        resolve(false);
      }
  
      function onOk() {
        cleanup();
        resolve(true);
      }
  
      cancelBtn.addEventListener('click', onCancel);
      okBtn.addEventListener('click', onOk);
    });
  }
  
  // ====== Render danh sách nhóm ======
  function renderGroups() {
    groupListEl.innerHTML = '';
    groups.forEach(group => {
      const li = document.createElement('li');
      li.classList.add('group-item');
  
      // Thêm tên nhóm và nút X
      li.innerHTML = `
        <span class="group-name">${group.name}</span>
        <button class="leave-group-btn" title="Thoát nhóm">×</button>
      `;
      li.dataset.id = group.id;
  
      // Click vào tên nhóm thì mở chat
      li.querySelector('.group-name').addEventListener('click', () => {
        openGroupChat(group.id, group.name);
      });
  
      // Click nút X thì thoát nhóm
      li.querySelector('.leave-group-btn').addEventListener('click', async (e) => {
        e.stopPropagation(); // tránh mở chat khi bấm X
        const confirmed = await showConfirm(`Bạn có chắc muốn thoát nhóm "${group.name}"?`);
        if (!confirmed) return;
        try {
          const res = await authFetch(`/api/groups/${group.id}/leave`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
            groups = groups.filter(g => g.id !== group.id);
            renderGroups();
          }
        } catch (err) {
          console.error('Lỗi thoát nhóm:', err);
        }
      });
  
      groupListEl.appendChild(li);
    });
  }
  

  // ====== Mở khung chat nhóm ======
  function openGroupChat(groupId, groupName) {
    currentGroupId = groupId;
    chatHeader.innerHTML = `<strong>${groupName}</strong>`;
    chatMessages.innerHTML = `
      <div class="message other"><p>Xin chào các thành viên trong nhóm "${groupName}"</p></div>
    `;
    socket.emit('join:group', { groupId });
  }

  // ====== Lắng nghe sự kiện nhóm mới ======
  socket.on('group:new', (group) => {
    const myUserId = JSON.parse(localStorage.getItem('user')).id;
    if (group.owner_id === myUserId) return; // đã thêm rồi
    if (!groups.find(g => g.id === group.id)) {
      groups.push(group);
      renderGroups();
    }
  });
  

  // ====== Load nhóm khi mở trang ======
  await loadGroups();
});
