// frontend/auth.js
let isLogin = true;

document.getElementById('toggle-auth').addEventListener('click', (e) => {
  e.preventDefault();
  isLogin = !isLogin;
  document.getElementById('form-title').textContent = isLogin ? 'Đăng nhập - PingMe' : 'Đăng ký - PingMe';
  document.getElementById('auth-btn').textContent = isLogin ? 'Đăng nhập' : 'Đăng ký';
  document.getElementById('toggle-auth').innerHTML = isLogin
  ? 'Chưa có tài khoản? <a href="#">Đăng ký</a>'
  : 'Đã có tài khoản? <a href="#">Đăng nhập</a>';
});

  
document.getElementById('auth-btn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const messageEl = document.getElementById('auth-message');

  if (!username || !password) {
    messageEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
    return;
  }

  try {
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      messageEl.textContent = data.message || 'Có lỗi xảy ra';
      return;
    }

    if (isLogin) {
      // Lưu token vào localStorage
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      window.location.href = 'home.html';
    } else {
      messageEl.style.color = 'green';
      messageEl.textContent = 'Đăng ký thành công! Hãy đăng nhập.';
      isLogin = true;
      document.getElementById('form-title').textContent = 'Đăng nhập';
      document.getElementById('auth-btn').textContent = 'Đăng nhập';
    }
  } catch (err) {
    console.error(err);
    messageEl.textContent = 'Lỗi kết nối server';
  }
});
