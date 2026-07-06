import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Send, Loader2, ListChecks, Award, Upload, FolderSearch } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface Channel {
  id: string;
  label: string;
  subtitle: string;
  icon: typeof Sparkles;
  color: string; // avatar background
  autoSend?: string; // câu hỏi tự động gửi khi mở kênh lần đầu (nếu chưa có tin nhắn)
  comingSoon?: boolean;
}

const CHANNELS: Channel[] = [
  {
    id: 'general',
    label: 'Trợ lý AI',
    subtitle: 'Hỏi bất kỳ điều gì',
    icon: Sparkles,
    color: 'bg-indigo-500',
  },
  {
    id: 'tasks',
    label: 'Công việc của tôi',
    subtitle: 'Xem & hỏi việc cần ưu tiên',
    icon: ListChecks,
    color: 'bg-blue-500',
    autoSend: 'Tôi có những công việc gì cần làm?',
  },
  {
    id: 'scores',
    label: 'Điểm của tôi',
    subtitle: 'Xem lịch sử điểm số',
    icon: Award,
    color: 'bg-amber-500',
    autoSend: 'Điểm của tôi thế nào rồi?',
  },
  {
    id: 'submit-doc',
    label: 'Nộp tài liệu',
    subtitle: 'Sắp ra mắt',
    icon: Upload,
    color: 'bg-emerald-500',
    comingSoon: true,
  },
  {
    id: 'find-doc',
    label: 'Tài liệu công khai',
    subtitle: 'Sắp ra mắt',
    icon: FolderSearch,
    color: 'bg-purple-500',
    comingSoon: true,
  },
];

export function ChatScreen() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeChannelId, setActiveChannelId] = useState('general');
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [loadingChannelId, setLoadingChannelId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChannel = CHANNELS.find(c => c.id === activeChannelId)!;
  const activeMessages = messagesByChannel[activeChannelId] || [];
  const isLoading = loadingChannelId === activeChannelId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isLoading]);

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const sendMessage = async (channelId: string, text: string) => {
    const content = text.trim();
    if (!content || loadingChannelId || !user) return;

    const prior = messagesByChannel[channelId] || [];
    const newMessages: ChatMessage[] = [...prior, { role: 'user', content }];
    setMessagesByChannel(prev => ({ ...prev, [channelId]: newMessages }));
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoadingChannelId(channelId);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, displayName: user.displayName, messages: newMessages }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.answer) {
        if (res.status === 429) {
          toast({
            title: data.error === 'quota_rpd'
              ? 'Trợ lý AI đã hết lượt hôm nay, mai dùng lại nhé'
              : 'Nhiều người đang hỏi cùng lúc, thử lại sau vài giây',
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Chưa hỏi được trợ lý AI, thử lại nhé', variant: 'destructive' });
        }
        return;
      }

      setMessagesByChannel(prev => ({
        ...prev,
        [channelId]: [...(prev[channelId] || newMessages), { role: 'model', content: data.answer }],
      }));
    } catch {
      toast({ title: 'Có lỗi xảy ra, thử lại nhé', variant: 'destructive' });
    } finally {
      setLoadingChannelId(current => (current === channelId ? null : current));
    }
  };

  const selectChannel = (channel: Channel) => {
    if (channel.comingSoon) return;
    setActiveChannelId(channel.id);
    const existing = messagesByChannel[channel.id];
    if ((!existing || existing.length === 0) && channel.autoSend) {
      sendMessage(channel.id, channel.autoSend);
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* Cột trái: danh sách kênh, giống danh sách hội thoại Zalo. Ẩn trên màn hình nhỏ (giống Sidebar gốc) */}
      <div className="hidden lg:flex w-72 shrink-0 border-r border-gray-200 flex-col">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">Trợ lý AI</h2>
          <p className="text-xs text-gray-400">Chọn 1 mục để bắt đầu trò chuyện</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {CHANNELS.map(channel => {
            const isActive = channel.id === activeChannelId;
            return (
              <button
                key={channel.id}
                onClick={() => selectChannel(channel)}
                disabled={channel.comingSoon}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors
                  ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                  ${channel.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full ${channel.color} flex items-center justify-center text-white shrink-0`}>
                  <channel.icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {channel.label}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{channel.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cột phải: khung chat của kênh đang chọn */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${activeChannel.color} flex items-center justify-center text-white shrink-0`}>
            <activeChannel.icon size={14} />
          </div>
          <h3 className="font-semibold text-gray-900 flex-1">{activeChannel.label}</h3>

          {/* Chọn kênh dạng dropdown khi màn hình nhỏ (thay cho cột trái đang ẩn) */}
          <select
            className="lg:hidden text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
            value={activeChannelId}
            onChange={e => {
              const channel = CHANNELS.find(c => c.id === e.target.value);
              if (channel) selectChannel(channel);
            }}
          >
            {CHANNELS.map(channel => (
              <option key={channel.id} value={channel.id} disabled={channel.comingSoon}>
                {channel.label}{channel.comingSoon ? ' (sắp ra mắt)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
          {activeMessages.length === 0 && !isLoading && (
            <div className="text-center text-gray-400 text-sm py-10">
              <div className="text-4xl mb-2">🤖</div>
              Gõ câu hỏi bên dưới để bắt đầu.
            </div>
          )}
          {activeMessages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'model' ? 'justify-start' : 'justify-end'}`}>
              {m.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shrink-0 mr-2 mt-auto mb-1">
                  <Sparkles size={14} />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'model'
                    ? 'bg-white text-gray-800 border border-indigo-100 rounded-bl-md shadow-sm'
                    : 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-br-md shadow-md'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shrink-0 mr-2">
                <Sparkles size={14} />
              </div>
              <div className="bg-white border border-indigo-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <Loader2 size={16} className="animate-spin text-indigo-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-200 bg-white px-3 py-3 flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(activeChannelId, input);
              }
            }}
            disabled={isLoading}
            rows={1}
            placeholder={`Nhắn trong "${activeChannel.label}"...`}
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50 resize-none overflow-y-auto leading-snug"
            style={{ maxHeight: 140 }}
          />
          <button
            onClick={() => sendMessage(activeChannelId, input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 shadow-md shrink-0"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
