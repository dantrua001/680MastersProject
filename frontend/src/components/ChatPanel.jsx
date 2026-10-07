import { useEffect, useRef, useState } from 'react';

export default function ChatPanel({ messages, me, onSend }) {
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);
  const submit = (e) => {
    e.preventDefault();
    if (text.trim()) onSend(text);
    setText('');
  };
  return (
    <div className="panel flex h-64 flex-col">
      <h3 className="mb-2 font-semibold">Chat</h3>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
        {messages.length === 0 && <p className="text-ink-500">Say hello to your table.</p>}
        {messages.map((m, i) => (
          <p key={i}>
            <span className={`font-semibold ${m.pid === me ? 'text-birch-400' : 'text-ink-300'}`}>{m.name}: </span>
            {m.text}
          </p>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" maxLength={300} aria-label="Chat message" />
        <button className="btn btn-ghost" type="submit">Send</button>
      </form>
    </div>
  );
}
