import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Solve from "@/pages/Solve";
import Notebook from "@/pages/Notebook";
import Daily from "@/pages/Daily";
import Profile from "@/pages/Profile";
import Chat from "@/pages/Chat";
import Login from "@/pages/Login";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* 登录/注册页独立全屏,不套 Layout */}
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/solve" element={<Solve />} />
          <Route path="/notebook" element={<Notebook />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/profile" element={<Profile />} />
          {/* AI 聊天页独立全屏(不显示底部导航,自带返回按钮) */}
        </Route>
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Router>
  );
}
