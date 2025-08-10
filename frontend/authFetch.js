export async function authFetch(url, options = {}) {
  let token = localStorage.getItem('accessToken'); // ✅ sửa lại
  if (!token) {
    window.location.href = 'auth.html';
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
  };

  const mergedOptions = {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  };

  let res = await fetch(url, mergedOptions);

  if (res.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      logout();
      return;
    }

    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      localStorage.setItem('accessToken', data.accessToken); // ✅ sửa lại
      mergedOptions.headers.Authorization = `Bearer ${data.accessToken}`;
      res = await fetch(url, mergedOptions);
    } else {
      logout();
      return;
    }
  }

  return res;
}

function logout() {
  localStorage.removeItem('accessToken'); // ✅ sửa lại
  localStorage.removeItem('refreshToken');
  window.location.href = 'auth.html';
}
