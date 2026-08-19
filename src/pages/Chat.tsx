import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Loader2, ArrowLeft, MessageCircle, Trash2, BookText, History } from "lucide-react";
import { chatWithAIStream, type ChatMessage } from "@/lib/api";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { useSubjectStore } from "@/store/subject";
import { SUBJECT_LABELS } from "@/types";
import type { Subject } from "@/types";
import { cn } from "@/lib/utils";

const QUICK_QUESTIONS = [
  "这道题怎么做？",
  "请帮我分析解题思路",
  "这道题考查什么知识点？",
  "这道题容易在哪里出错？",
];

// localStorage key:按学科分别存对话记录(刷新/返回后能恢复)
const STORAGE_PREFIX = 'ai-teacher-chat-history-';

function loadHistory(subject: Subject): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + subject);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(m => m && m.role && m.content) : [];
  } catch {
    return [];
  }
}

function saveHistory(subject: Subject, messages: ChatMessage[]) {
  try {
    // 最多保留最近 20 条(10 轮对话),避免 localStorage 超限
    const toSave = messages.slice(-20);
    localStorage.setItem(STORAGE_PREFIX + subject, JSON.stringify(toSave));
  } catch {
    // 存储失败(如空间不足)忽略,不影响使用
  }
}

function clearHistory(subject: Subject) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + subject);
  } catch { /* 忽略 */ }
}

export default function Chat() {
  const navigate = useNavigate();
  const { subject, setSubject } = useSubjectStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [streamingText, setStreamingText] = useState(""); // 正在流式输出的文本
  const scrollRef = useRef<HTMLDivElement>(null);
  // 仅挂载时检查 sessionStorage 是否有预设问题(从错题本跳转过来)
  const presetHandled = useRef(false);
  const prevSubjectRef = useRef<Subject>(subject);

  // 挂载/学科切换时加载该学科的历史对话
  useEffect(() => {
    const history = loadHistory(subject);
    setMessages(history);
    setStreamingText("");
    setError("");
    prevSubjectRef.current = subject;
  }, [subject]);

  // 检查 sessionStorage 是否有预设问题(从错题本/Solve页跳转过来)
  useEffect(() => {
    if (presetHandled.current) return;
    presetHandled.current = true;
    try {
      const raw = sessionStorage.getItem('ai-teacher-chat');
      if (raw) {
        sessionStorage.removeItem('ai-teacher-chat');
        const data = JSON.parse(raw);
        if (data.subject && data.subject !== subject) {
          setSubject(data.subject);
        }
        if (data.preset) {
          setInput(data.preset);
        }
      }
    } catch { /* 忽略解析异常 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 滚动到底部(消息变化或流式文本增长时)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, loading]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError("");
    const userMsg: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStreamingText("");

    try {
      // 历史对话传给后端(不含刚加入的 userMsg,后端会拼)
      const history = messages;
      let fullReply = "";

      // 流式接收 AI 回复,逐段更新 UI(打字机效果)
      for await (const delta of chatWithAIStream(content, subject, history)) {
        fullReply += delta;
        setStreamingText(fullReply);
      }

      if (!fullReply.trim()) {
        fullReply = "抱歉，我没有理解你的问题，能再说一遍吗？";
        setStreamingText(fullReply);
      }

      const finalMessages = [...nextMessages, { role: "assistant" as const, content: fullReply }];
      setMessages(finalMessages);
      setStreamingText("");
      // 持久化到 localStorage
      saveHistory(subject, finalMessages);
    } catch (err: any) {
      setError(err.message || "AI 回复失败，请重试");
      // 失败时移除刚发的那条,方便重试
      setMessages(messages);
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  };

  const handleClear = () => {
    setMessages([]);
    setStreamingText("");
    setError("");
    clearHistory(subject);
  };

  // 消息列表 + 正在流式输出的消息
  const displayMessages: ChatMessage[] = streamingText
    ? [...messages, { role: "assistant", content: streamingText }]
    : messages;

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* 顶部栏 */}
      <header className="flex-shrink-0 px-4 pt-10 pb-3 border-b border-ink-100 bg-paper-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 -ml-1 text-ink-400 hover:text-ink-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-serif font-bold text-ink-700 flex items-center gap-1.5">
                <MessageCircle size={18} className="text-amber" />
                AI {SUBJECT_LABELS[subject]}讲解
              </h1>
              <p className="text-xs text-ink-400">直接问答案和详细解题过程</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-pill bg-paper-100 text-ink-500 text-xs hover:bg-ink-50 transition-colors"
            >
              <Trash2 size={13} />
              清空
            </button>
          )}
        </div>
        <SubjectSwitcher />
      </header>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-paper-100">
        {displayMessages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-full bg-amber/15 flex items-center justify-center mb-4">
              <MessageCircle size={28} className="text-amber" />
            </div>
            <h2 className="text-base font-serif font-bold text-ink-700 mb-1.5">
              有不懂的题？直接问 AI
            </h2>
            <p className="text-sm text-ink-400 mb-5 leading-relaxed">
              把题目发给 AI，它会给出答案和详细解题过程。<br />
              也可以问概念、知识点或解题思路。
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-paper-50 border border-ink-100 text-sm text-ink-600 hover:border-amber/40 hover:bg-amber/5 transition-colors text-left"
                >
                  <BookText size={14} className="text-amber flex-shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {displayMessages.map((msg, i) => {
          // 最后一条 assistant 消息且正在流式输出时,显示打字光标
          const isStreamingLast = streamingText && i === displayMessages.length - 1 && msg.role === "assistant";
          return (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-ink-700 text-white rounded-br-sm"
                    : "bg-paper-50 border border-ink-100 text-ink-700 rounded-bl-sm shadow-sm"
                )}
              >
                {msg.content}
                {isStreamingLast && (
                  <span className="inline-block w-1 h-4 ml-0.5 bg-ink-500 animate-pulseSoft align-middle" />
                )}
              </div>
            </div>
          );
        })}

        {/* 加载中(等待首个 chunk 到达) */}
        {loading && !streamingText && (
          <div className="flex justify-start">
            <div className="bg-paper-50 border border-ink-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-ink-400" />
              <span className="text-sm text-ink-400">AI 正在思考...</span>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="rounded-xl bg-pen-50 border border-pen-100 px-4 py-2.5 text-sm text-pen-600">
            {error}
          </div>
        )}

        {/* 历史记录提示(非空且不是流式输出时显示) */}
        {messages.length > 0 && !loading && !streamingText && (
          <div className="text-center text-xs text-ink-300 flex items-center justify-center gap-1 pt-2">
            <History size={11} />
            对话已保存,切换学科或返回后再来仍可继续
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="flex-shrink-0 px-4 pt-3 pb-4 border-t border-ink-100 bg-paper-50">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`把题目或问题发给 AI ${SUBJECT_LABELS[subject]}老师...`}
            rows={1}
            className="flex-1 bg-paper-100 border border-ink-100 rounded-2xl px-4 py-2.5 text-sm text-ink-700 placeholder:text-ink-300 resize-none focus:outline-none focus:border-ink-300 min-h-[44px] max-h-32"
            style={{ height: "auto" }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-ink-700 text-white flex items-center justify-center hover:bg-ink-600 transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
