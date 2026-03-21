import { useState, useRef, useCallback, useEffect } from 'react';

const GREEN = '#4aba4a';
const AMBER = '#EF9F27';
const RED = '#E24B4A';

function valToLeft(val, trackWidth) {
  return ((100 - val) / 100) * trackWidth;
}

function leftToVal(x, trackWidth) {
  return Math.round(100 - Math.max(0, Math.min(100, (x / trackWidth) * 100)));
}

export default function ThresholdLegend({ thresholds, onThresholdsChange }) {
  const [open, setOpen] = useState(false);
  const trackRef = useRef(null);
  const dragging = useRef(null); // 'strong' | 'moderate' | null

  const { strong, moderate } = thresholds;

  const toggle = useCallback(() => setOpen((o) => !o), []);

  // --- drag logic ---
  const getTrackWidth = () => trackRef.current?.getBoundingClientRect().width ?? 1;
  const getTrackLeft = () => trackRef.current?.getBoundingClientRect().left ?? 0;

  const handlePointerDown = useCallback((handle) => (e) => {
    e.preventDefault();
    dragging.current = handle;
  }, []);

  const moveHandle = useCallback(
    (clientX) => {
      if (!dragging.current) return;
      const x = clientX - getTrackLeft();
      const val = leftToVal(x, getTrackWidth());

      if (dragging.current === 'strong') {
        const clamped = Math.max(moderate + 1, Math.min(100, val));
        onThresholdsChange({ strong: clamped, moderate });
      } else {
        const clamped = Math.max(0, Math.min(strong - 1, val));
        onThresholdsChange({ strong, moderate: clamped });
      }
    },
    [strong, moderate, onThresholdsChange]
  );

  const stopDrag = useCallback(() => {
    dragging.current = null;
  }, []);

  // mouse events
  useEffect(() => {
    const onMove = (e) => moveHandle(e.clientX);
    const onUp = () => stopDrag();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [moveHandle, stopDrag]);

  // touch events
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      moveHandle(e.touches[0].clientX);
    };
    const onEnd = () => stopDrag();
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [moveHandle, stopDrag]);

  // slider track rendering
  const renderSlider = () => {
    const tw = getTrackWidth() || 300; // fallback for first render
    const strongLeft = valToLeft(strong, tw);
    const moderateLeft = valToLeft(moderate, tw);

    const strongPct = ((100 - strong) / 100) * 100;
    const moderatePct = ((100 - moderate) / 100) * 100;

    return (
      <div className="px-2 pt-3 pb-2">
        {/* Track */}
        <div ref={trackRef} className="relative h-2 rounded select-none" style={{ touchAction: 'none' }}>
          {/* Green segment: 0% to strongLeft */}
          <div
            className="absolute top-0 h-full rounded-l"
            style={{ left: 0, width: `${strongPct}%`, backgroundColor: GREEN }}
          />
          {/* Amber segment: strongLeft to moderateLeft */}
          <div
            className="absolute top-0 h-full"
            style={{ left: `${strongPct}%`, width: `${moderatePct - strongPct}%`, backgroundColor: AMBER }}
          />
          {/* Red segment: moderateLeft to end */}
          <div
            className="absolute top-0 h-full rounded-r"
            style={{ left: `${moderatePct}%`, width: `${100 - moderatePct}%`, backgroundColor: RED }}
          />

          {/* Strong handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
            style={{ left: `${strongPct}%` }}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[10px] text-gray-500 font-medium whitespace-nowrap select-none">
              {strong}%
            </div>
            <div
              onMouseDown={handlePointerDown('strong')}
              onTouchStart={handlePointerDown('strong')}
              className="w-6 h-6 rounded-full bg-white border-2 border-gray-300 cursor-grab hover:border-gray-500 hover:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] active:cursor-grabbing transition-[border-color,box-shadow]"
            />
          </div>

          {/* Moderate handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
            style={{ left: `${moderatePct}%` }}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[10px] text-gray-500 font-medium whitespace-nowrap select-none">
              {moderate}%
            </div>
            <div
              onMouseDown={handlePointerDown('moderate')}
              onTouchStart={handlePointerDown('moderate')}
              className="w-6 h-6 rounded-full bg-white border-2 border-gray-300 cursor-grab hover:border-gray-500 hover:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] active:cursor-grabbing transition-[border-color,box-shadow]"
            />
          </div>
        </div>

        {/* Scale labels */}
        <div className="flex justify-between mt-1.5 text-[10px] text-gray-400 select-none">
          <span>100%</span>
          <span>0%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-5 mb-2">
      {/* Legend bar */}
      <div
        onClick={toggle}
        className="flex items-center gap-4 cursor-pointer rounded-md px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-colors select-none"
      >
        <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GREEN }} />
          &gt;{strong}%
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AMBER }} />
          {moderate}–{strong}%
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: RED }} />
          ≤{moderate}%
        </div>
        <span className="ml-auto text-[11px] text-gray-400 whitespace-nowrap">
          {open ? 'done ▴' : 'sensitivity threshold adjust ▾'}
        </span>
      </div>

      {/* Slider panel with animation */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-[250ms,200ms] ease-[ease,ease]"
        style={{
          maxHeight: open ? 100 : 0,
          opacity: open ? 1 : 0,
        }}
      >
        {renderSlider()}
      </div>
    </div>
  );
}
