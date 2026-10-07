import { useState } from 'react';
import Modal from './Modal.jsx';
import Tile from './Tile.jsx';
import { cellName, parseCell } from '../util.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function BlankModal({ onPick, onClose }) {
  return (
    <Modal title="Which letter is the blank?" onClose={onClose}>
      <div className="grid grid-cols-7 gap-2">
        {LETTERS.map((l) => (
          <button key={l} type="button" onClick={() => onPick(l)} className="tile h-10 rounded-md text-lg font-bold hover:brightness-110">{l}</button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-300">A blank can be any letter but scores 0 points.</p>
    </Modal>
  );
}

export function ExchangeModal({ rack, bagCount, onConfirm, onClose }) {
  const [picked, setPicked] = useState(new Set());
  const toggle = (i) => setPicked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const canExchange = bagCount >= 7;
  return (
    <Modal title="Exchange tiles" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-300">
        {canExchange ? 'Pick the tiles to swap for new ones. This uses your turn.' : `Only ${bagCount} tiles are left in the bag. Exchanges need at least 7.`}
      </p>
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {rack.map((l, i) => <Tile key={i} letter={l} selected={picked.has(i)} onClick={() => toggle(i)} className="h-12 w-12 text-2xl" />)}
      </div>
      <button className="btn btn-primary w-full" disabled={!canExchange || picked.size === 0} onClick={() => onConfirm([...picked].map((i) => rack[i]))}>
        Exchange {picked.size || ''} tile{picked.size === 1 ? '' : 's'}
      </button>
    </Modal>
  );
}

// Assist: the active player answers a suggestion; everyone else can make one.
export function AssistModal({ g, myTurn, onSend, onClose }) {
  const [word, setWord] = useState('');
  const [start, setStart] = useState('H8');
  const [dir, setDir] = useState('across');
  const [err, setErr] = useState('');
  const s = g.suggestion;

  if (myTurn) {
    return (
      <Modal title="Assist" onClose={onClose}>
        {s ? (
          <>
            <p className="mb-1"><b>{s.by_name}</b> suggests</p>
            <p className="mb-1 font-tile text-3xl font-bold tracking-widest text-birch-400">{s.word}</p>
            <p className="mb-4 text-sm text-ink-300">starting at {cellName(s.row, s.col)}, going {s.direction}. Accepting places the tiles from your rack; you still choose whether to submit.</p>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={() => { onSend('assist_respond', { accept: true }); onClose(); }}>Accept</button>
              <button className="btn btn-ghost flex-1" onClick={() => { onSend('assist_respond', { accept: false }); onClose(); }}>Reject</button>
            </div>
          </>
        ) : (
          <p className="text-ink-300">No suggestions yet. Other players can suggest one word per turn.</p>
        )}
      </Modal>
    );
  }

  const submit = () => {
    const cell = parseCell(start);
    if (!cell) return setErr('Enter a starting square like H8 (column A-O, row 1-15).');
    if (word.trim().length < 2) return setErr('Enter a word of two or more letters.');
    onSend('assist_suggest', { word: word.trim(), ...cell, direction: dir });
    onClose();
  };
  return (
    <Modal title="Suggest a move" onClose={onClose}>
      {g.assist_used ? (
        <p className="text-ink-300">A suggestion was already made this turn. You can suggest again on the next one.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-300">You can't see their rack, so the suggestion might not fit. They decide whether to accept.</p>
          <div>
            <label className="label" htmlFor="as-word">Word</label>
            <input id="as-word" className="input uppercase" value={word} onChange={(e) => setWord(e.target.value)} maxLength={15} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="as-start">Starting square</label>
              <input id="as-start" className="input uppercase" value={start} onChange={(e) => setStart(e.target.value)} maxLength={3} />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="as-dir">Direction</label>
              <select id="as-dir" className="input" value={dir} onChange={(e) => setDir(e.target.value)}>
                <option value="across">Across</option>
                <option value="down">Down</option>
              </select>
            </div>
          </div>
          {err && <p className="text-sm text-coral-500">{err}</p>}
          <button className="btn btn-primary w-full" onClick={submit}>Send suggestion</button>
        </div>
      )}
    </Modal>
  );
}

export function BlockModal({ g, onSend, onClose }) {
  const [square, setSquare] = useState('');
  const [err, setErr] = useState('');
  const next = g.players[(g.turn + 1) % g.players.length];
  const submit = () => {
    const cell = parseCell(square);
    if (!cell) return setErr('Enter a square like H8 (column A-O, row 1-15).');
    onSend('block', cell);
    onClose();
  };
  return (
    <Modal title="Block a square" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-300">
        Pick an empty square. If <b>{next.name}</b> plays a tile there on their next turn, every word that uses it scores half. You can block once per round.
      </p>
      <label className="label" htmlFor="bk-sq">Square</label>
      <input id="bk-sq" className="input mb-3 uppercase" value={square} onChange={(e) => setSquare(e.target.value)} placeholder="H8" maxLength={3} />
      {err && <p className="mb-3 text-sm text-coral-500">{err}</p>}
      <button className="btn btn-danger w-full" onClick={submit}>Block square</button>
    </Modal>
  );
}

// Trade: propose (any time), wait/cancel (proposer), or accept with a tile in return (receiver).
export function TradeModal({ g, me, onSend, onClose }) {
  const [to, setTo] = useState('');
  const [give, setGive] = useState(null);
  const [back, setBack] = useState(null);
  const t = g.trade;
  const others = g.players.filter((p) => p.id !== me);

  if (t && t.to === me) {
    return (
      <Modal title="Trade offer" onClose={onClose}>
        <p className="mb-3"><b>{t.from_name}</b> offers you this tile:</p>
        <div className="mb-4 flex justify-center"><Tile letter={t.give} className="h-14 w-14 text-3xl" /></div>
        <p className="mb-2 text-sm text-ink-300">Accepting means giving one of your own tiles back:</p>
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {g.rack.map((l, i) => <Tile key={i} letter={l} selected={back === i} onClick={() => setBack(i)} className="h-11 w-11 text-xl" />)}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" disabled={back === null} onClick={() => { onSend('trade_respond', { accept: true, give: g.rack[back] }); onClose(); }}>Accept trade</button>
          <button className="btn btn-ghost flex-1" onClick={() => { onSend('trade_respond', { accept: false }); onClose(); }}>Decline</button>
        </div>
      </Modal>
    );
  }
  if (t && t.from === me) {
    return (
      <Modal title="Trade offer sent" onClose={onClose}>
        <p className="mb-4 text-ink-300">Waiting for <b>{t.to_name}</b> to answer.</p>
        <button className="btn btn-ghost w-full" onClick={() => { onSend('trade_cancel'); onClose(); }}>Cancel offer</button>
      </Modal>
    );
  }
  if (t) {
    return <Modal title="Trade in progress" onClose={onClose}><p className="text-ink-300">{t.from_name} has offered a tile to {t.to_name}.</p></Modal>;
  }
  return (
    <Modal title="Trade a tile" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-300">Offer one of your tiles. The other player picks one of theirs to swap back, and must accept. One trade per round.</p>
      <label className="label" htmlFor="tr-to">Trade with</label>
      <select id="tr-to" className="input mb-3" value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">Choose a player</option>
        {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <p className="label">Tile to offer</p>
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {g.rack.map((l, i) => <Tile key={i} letter={l} selected={give === i} onClick={() => setGive(i)} className="h-11 w-11 text-xl" />)}
      </div>
      <button className="btn btn-primary w-full" disabled={!to || give === null} onClick={() => { onSend('trade_propose', { to: Number(to), give: g.rack[give] }); onClose(); }}>Offer trade</button>
    </Modal>
  );
}
