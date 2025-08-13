import { authFetch } from './authFetch.js';

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
      await authFetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, members: selectedUserIds })
      });
      await loadGroups(); // reload danh sách nhóm từ backend
      closePopup();
    } catch (err) {
      console.error('Lỗi tạo nhóm:', err);
    }
  });

  // ====== Render danh sách nhóm ======
  function renderGroups() {
    groupListEl.innerHTML = '';
    groups.forEach(group => {
      const li = document.createElement('li');
      li.classList.add('group-item');
      li.textContent = group.name;
      li.dataset.id = group.id;
      li.addEventListener('click', () => openGroupChat(group.id, group.name));
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
    // join socket room
    socket.emit('join:group', { groupId });
  }

  // ====== Load nhóm khi mở trang ======
  await loadGroups();
});
