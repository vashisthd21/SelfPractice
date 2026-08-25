import React, { useRef, useState, useEffect } from 'react';
import { Edit3, FileText, Trash2, X, RotateCcw, Download } from 'lucide-react';

export function ScratchPadModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('canvas'); // 'canvas' or 'notes'
  const [notes, setNotes] = useState(() => localStorage.getItem('examlens_scratchpad_notes') || '');
  const [color, setColor] = useState('#1e293b');
  const [lineWidth, setLineWidth] = useState(3);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    localStorage.setItem('examlens_scratchpad_notes', notes);
  }, [notes]);

  useEffect(() => {
    if (!isOpen || tab !== 'canvas') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set display resolution
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [isOpen, tab]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawing.current = true;
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  if (!isOpen) return null;

  return (
    <div className="scratchpad-overlay" onClick={onClose}>
      <div className="scratchpad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scratchpad-header">
          <div className="scratchpad-tabs">
            <button
              type="button"
              className={`tab-btn ${tab === 'canvas' ? 'active' : ''}`}
              onClick={() => setTab('canvas')}
            >
              <Edit3 size={16} />
              <span>Rough Sheet (Draw)</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${tab === 'notes' ? 'active' : ''}`}
              onClick={() => setTab('notes')}
            >
              <FileText size={16} />
              <span>Quick Notes</span>
            </button>
          </div>
          <button type="button" className="iconbtn close-btn" onClick={onClose} title="Close Rough Sheet">
            <X size={18} />
          </button>
        </div>

        <div className="scratchpad-body">
          {tab === 'canvas' ? (
            <div className="canvas-container">
              <div className="canvas-toolbar">
                <div className="color-palette">
                  {['#1e293b', '#2563eb', '#dc2626', '#16a34a', '#d97706'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-dot ${color === c ? 'active-color' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
                <div className="line-width-selector">
                  {[2, 4, 6].map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={`width-btn ${lineWidth === w ? 'active-width' : ''}`}
                      onClick={() => setLineWidth(w)}
                    >
                      <span style={{ width: w * 2 + 2, height: w * 2 + 2 }} className="width-dot" />
                    </button>
                  ))}
                </div>
                <button type="button" className="secondary-btn clear-btn" onClick={clearCanvas}>
                  <RotateCcw size={14} />
                  <span>Clear Board</span>
                </button>
              </div>

              <canvas
                ref={canvasRef}
                className="scratch-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
          ) : (
            <div className="notes-container">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type your rough calculations, equations, or notes here..."
                className="scratch-textarea"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
