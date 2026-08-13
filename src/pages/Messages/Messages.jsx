// Messages between the two managers of a matched pair.
//
// The same page serves a matchmaker, a guardian, and a self-managed bride or
// groom, because they are doing the same thing: speaking for the person whose
// biodata they hold. A candidate whose profile someone else manages has no
// thread of their own — the page says so rather than showing an empty inbox.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Avatar, Badge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import './Messages.css';

const initialsOf = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function Messages() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [canMessage, setCanMessage] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const endRef = useRef(null);
  const say = useCallback((msg) => { clearTimeout(timer.current); setToast(msg); timer.current = setTimeout(() => setToast(null), 5200); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const loadList = useCallback(async () => {
    const data = await api.conversations(token);
    setConversations(data.conversations);
    setCanMessage(data.canMessage !== false);
    return data.conversations;
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    loadList()
      .then((list) => { if (live) setOpenId((cur) => cur ?? list[0]?.id ?? null); })
      .catch((e) => say(e.message || 'Could not load your messages.'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, loadList, say]);

  // Opening a thread marks it read, so the list's unread counts are refreshed
  // from the server rather than guessed at here.
  useEffect(() => {
    if (!token || !openId) { setThread(null); return undefined; }
    let live = true;
    api.conversation(token, openId)
      .then((data) => {
        if (!live) return;
        setThread(data);
        loadList().catch(() => { /* the list keeps its previous counts */ });
      })
      .catch((e) => say(e.message || 'Could not open that conversation.'));
    return () => { live = false; };
  }, [token, openId, loadList, say]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !thread) return;
    setSending(true);
    try {
      const { message } = await api.sendMessage(token, thread.conversation.id, body);
      setThread((t) => ({ ...t, messages: [...t.messages, message] }));
      setDraft('');
      loadList().catch(() => { /* the list refreshes on the next open */ });
    } catch (e) {
      say(e.message || 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="mg"><div className="mg-frame" style={{ padding: 40 }}>Loading…</div></div>;

  if (!canMessage) {
    return (
      <div className="mg">
        <div className="mg-blocked">
          <div className="mg-blocked-t">Your manager holds these conversations</div>
          <div className="mg-blocked-b">
            Messages run between the two people who manage a match — your matchmaker or guardian on one side, the
            other family's manager on the other. Nothing is sent to you directly, and nothing you write would reach
            the other family. This is how the product works, not a limit on your account.
          </div>
          <a className="mg-blocked-link" href="/guardian">Go to your proposals</a>
        </div>
      </div>
    );
  }

  return (
    <div className="mg">
      <div className="mg-frame">
        <div className="mg-topbar">
          <div className="mg-topbar-brand"><div className="mg-logo">স</div><span>SongiSathi</span></div>
          <span className="mg-crumb">/ বার্তা · manager to manager</span>
        </div>

        <div className="mg-grid">
          <div className="mg-list">
            <div className="mg-list-head">
              <div className="mg-h-bn">বার্তা</div>
              <div className="mg-h-sub">{conversations.length} conversation{conversations.length === 1 ? '' : 's'} · opens when an interest is accepted</div>
            </div>
            {conversations.length === 0 && (
              <div className="mg-empty">
                No conversations yet. One opens as soon as an interest between your candidate and another family is
                accepted — until then, the note attached to the interest is the whole of what has been said.
              </div>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`mg-item ${c.id === openId ? 'is-open' : ''}`}
                onClick={() => setOpenId(c.id)}
              >
                <Avatar initials={initialsOf(c.peer.name)} size={34} />
                <div className="mg-item-text">
                  <div className="mg-item-top">
                    <span className="mg-item-name">{c.peer.name}</span>
                    {c.unread > 0 && <span className="mg-unread">{c.unread}</span>}
                  </div>
                  <div className="mg-item-pair">{c.mine.name} ↔ {c.theirs.name}</div>
                  <div className="mg-item-last">
                    {c.last ? `${c.last.fromMe ? 'You: ' : ''}${c.last.body}` : 'No messages yet — say the first thing.'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mg-thread">
            {!thread && <div className="mg-empty" style={{ margin: 24 }}>Pick a conversation to read it.</div>}
            {thread && (
              <>
                <div className="mg-thread-head">
                  <Avatar initials={initialsOf(thread.conversation.peer.name)} size={38} />
                  <div>
                    <div className="mg-thread-name">{thread.conversation.peer.name}</div>
                    <div className="mg-thread-meta">
                      {thread.conversation.peer.role}{thread.conversation.peer.meta ? ` · ${thread.conversation.peer.meta}` : ''}
                    </div>
                  </div>
                  <span className="mg-thread-pair">
                    <Badge tone="neutral">{thread.conversation.mine.name} ↔ {thread.conversation.theirs.name}</Badge>
                  </span>
                </div>

                <div className="mg-messages">
                  {thread.messages.length === 0 && (
                    <div className="mg-empty">Nothing said yet. Both families have agreed to talk — this is where that happens.</div>
                  )}
                  {thread.messages.map((m) => (
                    <div key={m.id} className={`mg-bubble ${m.fromMe ? 'mine' : 'theirs'}`}>
                      <div className="mg-bubble-body">{m.body}</div>
                      <div className="mg-bubble-foot">{m.fromMe ? 'You' : m.senderName} · {m.when}</div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>

                <div className="mg-sealed">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" /></svg>
                  <span>
                    {thread.conversation.contactReleased
                      ? 'Contact has been released for this pair, so numbers may pass here. Everything is still logged.'
                      : 'Phone numbers and email addresses are refused here. Contact moves by a release both managers agree to, and that release is logged.'}
                  </span>
                </div>

                <div className="mg-composer">
                  <textarea
                    className="mg-textarea"
                    value={draft}
                    maxLength={2000}
                    placeholder="Write to the other manager…"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
                  />
                  <div className="mg-composer-foot">
                    <span className="mg-composer-note">{draft.trim().length}/2000 · Ctrl+Enter sends</span>
                    <Button variant="primary" size="sm" disabled={sending || !draft.trim()} onClick={send}>
                      {sending ? 'Sending…' : 'পাঠান · Send'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {toast && (<div className="mg-toast"><span className="mg-toast-check">!</span><span>{toast}</span></div>)}
    </div>
  );
}
