import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import useGame from '../useGame.js';
import Board from '../components/Board.jsx';
import Rack from '../components/Rack.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import TurnHistory from '../components/TurnHistory.jsx';
import { AssistModal, BlankModal, BlockModal, ExchangeModal, TradeModal } from '../components/Modals.jsx';
import { cellName } from '../util.js';

function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GameBoard() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { state: g, room, connected, error, clearError, preview, assistPlacements, clearAssist, send } = useGame(code);

  const [pending, setPending] = useState({}); // "row,col" -> { row, col, letter, blank, idx } (idx = rack position)
  const [selected, setSelected] = useState(null); // selected rack position
  const [modal, setModal] = useState(null); // 'assist' | 'block' | 'trade' | 'exchange'
  const [blankAt, setBlankAt] = useState(null); // where a blank tile is waiting for its letter
  const [dismissed, setDismissed] = useState({}); // suggestion / trade ids the player closed without answering
  const [rackOrder, setRackOrder] = useState(null); // display-only order set by the Shuffle button

  const me = user.id;
  const active = g ? g.players[g.turn] : null;
  const myTurn = !!g && g.status === 'active' && active.id === me;
  const placements = Object.values(pending).map(({ row, col, letter, blank }) => ({ row, col, letter, blank }));
  const used = new Set(Object.values(pending).map((p) => p.idx));

  useEffect(() => {
    if (g?.status === 'finished') nav(`/results/${code}`, { replace: true });
    else if (!g && room?.status === 'waiting') nav(`/room/${code}`, { replace: true });
  }, [g?.status, room?.status]);

  useEffect(() => { setPending({}); setSelected(null); setRackOrder(null); }, [g?.turn_no]); // new turn: clear unsent tiles

  useEffect(() => {
    if (myTurn && placements.length) send('preview', { placements }); // live score check from the server
  }, [JSON.stringify(placements), myTurn]);

  useEffect(() => {
    if (!assistPlacements || !g) return;
    const next = {};
    const taken = new Set();
    for (const p of assistPlacements) {
      const need = p.blank ? '?' : p.letter;
      const idx = g.rack.findIndex((l, i) => l === need && !taken.has(i));
      if (idx >= 0) { taken.add(idx); next[`${p.row},${p.col}`] = { ...p, idx }; }
    }
    setPending(next);
    clearAssist();
  }, [assistPlacements]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 6000);
    return () => clearTimeout(t);
  }, [error]);

  if (!g) return <p className="p-8 text-ink-300">{error ? <>{error} <Link to="/lobby" className="underline">Back to the lobby</Link></> : 'Connecting to the game...'}</p>;

  const nextId = g.players[(g.turn + 1) % g.players.length].id;
  const iResigned = !!g.resigned?.includes(me);
  const blockDisabled = g.status !== 'active' || !!g.block || g.block_used[me] === g.round || nextId === me || iResigned;
  const blockHint = g.block ? 'A square is already blocked' : g.block_used[me] === g.round ? 'You already blocked this round' : nextId === me ? "You can't block your own turn" : '';
  const tradeUsed = (g.trade_used[me] === g.round && !g.trade) || iResigned;
  const assistDisabled = iResigned || (myTurn ? !g.suggestion : g.assist_used);

  const onCell = (r, c) => {
    if (!myTurn) return;
    const key = `${r},${c}`;
    if (pending[key]) {
      const { [key]: _removed, ...rest } = pending;
      setPending(rest);
      return;
    }
    if (g.board[r][c] || selected === null) return;
    const letter = g.rack[selected];
    if (letter === '?') return setBlankAt({ row: r, col: c, idx: selected });
    setPending({ ...pending, [key]: { row: r, col: c, letter, blank: false, idx: selected } });
    setSelected(null);
  };
  const undoLast = () => {
    const keys = Object.keys(pending);
    if (!keys.length) return;
    const { [keys[keys.length - 1]]: _removed, ...rest } = pending;
    setPending(rest);
  };
  const confirmResign = () => {
    if (window.confirm('Resign from this game? This ends your part of the game and cannot be undone.')) send('resign');
  };
  const pickBlank = (letter) => {
    setPending({ ...pending, [`${blankAt.row},${blankAt.col}`]: { ...blankAt, letter, blank: true } });
    setBlankAt(null);
    setSelected(null);
  };

  const sugOpen = myTurn && g.suggestion && !dismissed[g.suggestion.id];
  const tradeIn = g.trade && g.trade.to === me && !dismissed[g.trade.id];
  const closeAssist = () => { setModal(null); if (g.suggestion) setDismissed((d) => ({ ...d, [g.suggestion.id]: true })); };
  const closeTrade = () => { setModal(null); if (g.trade) setDismissed((d) => ({ ...d, [g.trade.id]: true })); };

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-5">
      {error && (
        <div role="alert" className="fixed left-1/2 top-4 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-lg bg-coral-600 px-4 py-2 text-white shadow-xl">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss" className="font-bold">✕</button>
        </div>
      )}

      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-4">
          <Link to="/lobby" className="text-ink-300 hover:text-white">Lobby</Link>
          <span className="font-semibold">Game {code}</span>
          <span className={connected ? 'text-birch-400' : 'text-coral-500'}>{connected ? 'Live' : 'Reconnecting...'}</span>
        </div>
        <div className="flex gap-4 text-ink-300">
          <span>Round {g.round}</span>
          <span>{g.bag_count} tiles in the bag ({g.bag_vowels} vowels, {g.bag_consonants} consonants)</span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Board board={g.board} pending={pending} blocked={g.block} lastCells={g.last_move?.cells} onCell={onCell} />

          <section className="panel space-y-3">
            <p className={`text-center font-semibold ${myTurn ? 'text-birch-400' : 'text-ink-300'}`}>
              {myTurn ? 'Your turn' : `${active.name} is playing`}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button className="btn btn-ghost px-3" title="Shuffle rack" aria-label="Shuffle rack" onClick={() => setRackOrder(shuffled(g.rack.length))}>⤨</button>
              <Rack rack={g.rack} used={used} selected={selected} onSelect={(i) => setSelected(selected === i ? null : i)} order={rackOrder} />
            </div>
            <div className="min-h-[1.25rem] text-center text-sm">
              {myTurn && placements.length > 0 && preview &&
                (preview.ok ? (
                  <span>
                    {preview.words.map((w) => `${w.word} ${w.score}${w.blocked ? ' (blocked, halved)' : ''}`).join(', ')}
                    {preview.bingo ? ', plus 50 for using all 7 tiles' : ''}: <b>{preview.score} points</b>
                  </span>
                ) : (
                  <span className="text-coral-500">{preview.error}</span>
                ))}
              {myTurn && placements.length === 0 && <span className="text-ink-500">Pick a tile, then click a square. Click a placed tile to take it back.</span>}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" disabled={!myTurn || placements.length === 0} onClick={() => send('submit', { placements })}>Submit word</button>
              <button className="btn btn-ghost" disabled={placements.length === 0} onClick={undoLast} title="Remove the last tile you placed">Undo</button>
              <button className="btn btn-ghost" disabled={placements.length === 0} onClick={() => { setPending({}); setSelected(null); }}>Take back tiles</button>
              <button className="btn btn-ghost" disabled={!myTurn} onClick={() => setModal('exchange')}>Exchange</button>
              <button className="btn btn-ghost" disabled={!myTurn} onClick={() => send('pass')}>Pass</button>
              <button className="btn btn-danger" disabled={!!g.resigned?.includes(me)} onClick={confirmResign}>Resign</button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 border-t border-felt-700 pt-3">
              <button className="btn btn-ghost" disabled={assistDisabled} onClick={() => setModal('assist')} title={myTurn ? 'Answer a suggestion' : 'Suggest a move to the active player'}>
                {myTurn ? 'Assist' : 'Suggest a move'}{myTurn && g.suggestion ? ' (1 waiting)' : ''}
              </button>
              <button className="btn btn-ghost" disabled={blockDisabled} onClick={() => setModal('block')} title={blockHint}>Block</button>
              <button className="btn btn-ghost" disabled={tradeUsed} onClick={() => setModal('trade')} title={tradeUsed ? 'You already traded this round' : ''}>
                Trade{g.trade ? ' (1 pending)' : ''}
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="panel">
            <h2 className="mb-2 font-semibold">Scores</h2>
            <ul className="space-y-1">
              {g.players.map((p, i) => (
                <li key={p.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${i === g.turn ? 'bg-felt-700 ring-1 ring-birch-400' : ''}`}>
                  <span className="flex items-center gap-2">
                    <span className="tile flex h-6 w-6 items-center justify-center rounded text-xs">{i + 1}</span>
                    {p.name}{p.id === me ? ' (you)' : ''}
                    {g.resigned?.includes(p.id) && <span className="rounded bg-coral-500/20 px-1.5 py-0.5 text-xs text-coral-500">resigned</span>}
                  </span>
                  <span className="text-lg font-bold tabular-nums">{p.score}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 text-xs text-ink-300">
              {g.block && <p>Blocked: <b>{cellName(g.block.row, g.block.col)}</b> for {g.players.find((p) => p.id === g.block.target)?.name}'s turn.</p>}
              {g.trade && <p>Trade offer: {g.trade.from_name} to {g.trade.to_name}.</p>}
              {g.assist_used && <p>An assist was used this turn.</p>}
              <p>{g.round_turns.length} of {g.players.length} players have played this round.</p>
            </div>
          </section>

          <section className="panel">
            <h2 className="mb-2 font-semibold">Turn history</h2>
            <TurnHistory log={g.log} players={g.players} />
          </section>

          <ChatPanel messages={g.chat} me={me} onSend={(text) => send('chat', { text })} />
        </aside>
      </div>

      {blankAt && <BlankModal onPick={pickBlank} onClose={() => setBlankAt(null)} />}
      {modal === 'exchange' && (
        <ExchangeModal rack={g.rack} bagCount={g.bag_count} onClose={() => setModal(null)} onConfirm={(tiles) => { send('exchange', { tiles }); setModal(null); }} />
      )}
      {(modal === 'assist' || sugOpen) && <AssistModal g={g} myTurn={myTurn} onSend={send} onClose={closeAssist} />}
      {modal === 'block' && <BlockModal g={g} onSend={send} onClose={() => setModal(null)} />}
      {(modal === 'trade' || tradeIn) && <TradeModal g={g} me={me} onSend={send} onClose={closeTrade} />}
    </div>
  );
}
