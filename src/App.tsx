import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Solve from "@/pages/Solve";
import Notebook from "@/pages/Notebook";
import Daily from "@/pages/Daily";
import Profile from "@/pages/Profile";
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
        </Route>
      </Routes>
    </Router>
  );
}
