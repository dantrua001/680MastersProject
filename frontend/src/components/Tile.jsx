import { VALUES } from '../premium.js';

// A birch-wood letter tile. `blank` tiles show their chosen letter dimmed and worth nothing.
export default function Tile({ letter, blank = false, selected = false, pending = false, onClick, className = '', style, title }) {
  const Comp = onClick ? 'button' : 'div';
  const shown = letter === '?' ? '' : letter;
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      style={style}
      className={`tile ${className.includes('absolute') ? '' : 'relative'} flex select-none items-center justify-center rounded-md font-bold transition-transform ${
        selected ? '-translate-y-1 ring-2 ring-white' : ''
      } ${pending ? 'ring-2 ring-coral-500' : ''} ${className}`}
    >
      <span className={blank ? 'opacity-50' : ''}>{shown}</span>
      {!blank && VALUES[letter] !== undefined && (
        <sub className="absolute bottom-[6%] right-[10%] font-semibold" style={{ fontSize: '0.4em' }}>{VALUES[letter]}</sub>
      )}
    </Comp>
  );
}
