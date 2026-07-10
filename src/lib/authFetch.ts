import { auth } from './firebase';

/**
 * Backend endpoints xác thực bằng Firebase ID token (Authorization: Bearer <token>),
 * KHÔNG còn tin uid do client tự khai trong body — dùng 2 hàm này thay vì gọi fetch/XHR
 * trực tiếp tới server ở mọi nơi cần gửi uid.
 */
export async function getIdToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Chưa đăng nhập');
  return token;
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  return fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}
