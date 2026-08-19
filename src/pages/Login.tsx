/**
 * 登录/注册页 - 用户名+密码登录注册
 * 预留:电话注册入口(目前显示"即将开通")
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Tab = 'login' | 'register';

export default function Login() {
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = tab === 'login'
        ? await login({ username, password })
        : await register({ username, password, name: name || username });
      setAuth(result.token, {
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* 标题 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white text-3xl mb-3">
            🎓
          </div>
          <h1 className="text-2xl font-bold text-gray-800">AI 理科教师</h1>
          <p className="text-sm text-gray-500 mt-1">个性化诊断 · 错题本 · 自适应练习</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === 'login' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === 'register' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}
          >
            注册
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">昵称（可选）</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="展示名,不填则用用户名"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="4-20位,字母开头,字母数字下划线"
              required
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6-32位,含字母和数字"
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? '处理中...' : (tab === 'login' ? '登录' : '注册')}
          </button>
        </form>

        {/* 电话注册预留入口 */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-center text-xs text-gray-400 mb-2">其他登录方式</p>
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2"
          >
            📱 手机号注册/登录（即将开通）
          </button>
        </div>

        {/* 游客访问入口 */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="text-sm text-gray-500 hover:text-indigo-600 transition"
          >
            先以游客身份体验 →
          </button>
        </div>
      </div>
    </div>
  );
}
