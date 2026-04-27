import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function compactQuestion(content) {
  const text = (content || '').replace(/\s+/g, ' ').trim();
  return text.length > 22 ? `${text.slice(0, 22)}...` : text;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function ContextTimeline({ messages, label, listRef, onJump }) {
  const timelineRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [hovering, setHovering] = useState(false);
  const [mappedNodes, setMappedNodes] = useState([]);
  const nodes = messages.filter((message) => message.role === 'user' && !message.is_hidden);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    const list = listRef?.current;
    if (!timeline || !list || nodes.length === 0) {
      setMappedNodes([]);
      return undefined;
    }

    const updatePositions = () => {
      const timelineRect = timeline.getBoundingClientRect();
      const trackHeight = Math.max(timeline.clientHeight, 1);
      const safeGap = Math.min(18, Math.max(8, (trackHeight - 24) / Math.max(nodes.length - 1, 1)));
      const center = trackHeight / 2;
      const nextNodes = nodes.map((message, index) => {
        const row = list.querySelector(`[data-message-id="${message.id}"]`);
        if (!row) {
          return null;
        }
        const top = clamp(center + (index - (nodes.length - 1) / 2) * safeGap, 10, trackHeight - 10);
        return {
          id: message.id,
          text: compactQuestion(message.content),
          top,
          popoverX: timelineRect.left - 16,
          popoverY: timelineRect.top + center,
        };
      }).filter(Boolean);
      setMappedNodes(nextNodes);
    };

    updatePositions();
    const resizeObserver = new ResizeObserver(updatePositions);
    resizeObserver.observe(list);
    resizeObserver.observe(timeline);
    window.addEventListener('resize', updatePositions);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePositions);
    };
  }, [listRef, messages, nodes.length]);

  if (nodes.length === 0) {
    return null;
  }

  const openPopover = () => {
    window.clearTimeout(closeTimerRef.current);
    setHovering(true);
  };

  const scheduleClose = () => {
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setHovering(false), 120);
  };

  return (
    <>
      <nav
        ref={timelineRef}
        className="context-timeline"
        aria-label={label}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
      >
        <div className="timeline-track" />
        {mappedNodes.map((node) => (
          <button
            aria-label={node.text}
            className={`timeline-node ${activeId === node.id ? 'active' : ''}`}
            key={node.id}
            onMouseEnter={() => setActiveId(node.id)}
            onClick={() => {
              setActiveId(node.id);
              onJump(node.id);
            }}
            style={{ '--node-top': `${node.top}px` }}
            title={node.text}
            type="button"
          />
        ))}
      </nav>
      {hovering && mappedNodes.length > 0 && createPortal(
        <div className="popover-stack timeline-popover-stack">
          <div
            className="timeline-popover-card"
            onMouseEnter={openPopover}
            onMouseLeave={scheduleClose}
            style={{ left: mappedNodes[0].popoverX, top: mappedNodes[0].popoverY }}
          >
            {mappedNodes.map((node) => (
              <button
                className={`timeline-popover-row ${activeId === node.id ? 'active' : ''}`}
                key={node.id}
                type="button"
                onMouseEnter={() => setActiveId(node.id)}
                onClick={() => {
                  setActiveId(node.id);
                  onJump(node.id);
                }}
              >
                <span className="timeline-popover-dot" />
                <span>{node.text}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
