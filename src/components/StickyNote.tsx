import { useState, useRef, useEffect } from "react";
import { X, GripVertical } from "lucide-react";
import { useReminders, POST_IT_COLORS, Reminder } from "@/contexts/RemindersContext";
import { cn } from "@/lib/utils";

export default function StickyNote({ reminder }: { reminder: Reminder }) {
  const { updateReminder, deleteReminder } = useReminders();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<"right" | "bottom" | "both" | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [text, setText] = useState(reminder.text);

  // Sync internal text state with external reminder text
  useEffect(() => {
    setText(reminder.text);
  }, [reminder.text]);

  const handleDragDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).closest(".resize-handle")) return;
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - reminder.x,
      y: e.clientY - reminder.y,
    };
  };

  const handleResizeDown = (direction: "right" | "bottom" | "both") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      w: reminder.width,
      h: reminder.height,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        updateReminder(reminder.id, { x: newX, y: newY });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;
        
        const updates: Partial<Reminder> = {};
        if (isResizing === "right" || isResizing === "both") {
          updates.width = Math.max(100, resizeStartPos.current.w + deltaX);
        }
        if (isResizing === "bottom" || isResizing === "both") {
          updates.height = Math.max(100, resizeStartPos.current.h + deltaY);
        }
        updateReminder(reminder.id, updates);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, reminder.id, reminder.width, reminder.height, updateReminder]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleBlur = () => {
    if (text !== reminder.text) {
      updateReminder(reminder.id, { text });
    }
  };

  const currentColor = POST_IT_COLORS.find(c => c.bg === reminder.color) || POST_IT_COLORS[0];

  return (
    <div
      className={cn(
        "absolute z-[1000] shadow-xl rounded-sm flex flex-col transition-shadow duration-200",
        isDragging ? "shadow-2xl scale-[1.01] rotate-1 cursor-grabbing" : "cursor-default",
        isResizing && "shadow-2xl"
      )}
      style={{
        left: reminder.x,
        top: reminder.y,
        width: reminder.width,
        height: reminder.height,
        backgroundColor: reminder.color,
        border: `1px solid ${currentColor.border}`,
      }}
    >
      {/* Header / Drag Bar */}
      <div 
        onMouseDown={handleDragDown}
        className="h-6 flex items-center justify-between px-1 cursor-grab active:cursor-grabbing border-b border-black/10"
      >
        <GripVertical className="w-3 h-3 text-black/20" />
        <div className="flex items-center gap-1">
          {POST_IT_COLORS.map((c) => (
            <button
              key={c.bg}
              onClick={() => updateReminder(reminder.id, { color: c.bg })}
              className={cn(
                "w-2.5 h-2.5 rounded-full border border-black/10 transition-transform hover:scale-125",
                reminder.color === c.bg && "ring-1 ring-black/40 scale-110"
              )}
              style={{ backgroundColor: c.bg }}
            />
          ))}
          <button
            onClick={() => deleteReminder(reminder.id)}
            className="ml-1 p-0.5 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-3 h-3 text-black/40" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-2 flex overflow-hidden">
        <textarea
          value={text}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder="Lembrete..."
          className="w-full h-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-sm font-medium text-black/80 placeholder:text-black/20 leading-tight"
          style={{ fontFamily: "'Sora', sans-serif" }}
        />
      </div>

      {/* Resize Handles */}
      <div 
        className="resize-handle absolute right-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-black/5" 
        onMouseDown={handleResizeDown("right")}
      />
      <div 
        className="resize-handle absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize hover:bg-black/5" 
        onMouseDown={handleResizeDown("bottom")}
      />
      <div 
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center group" 
        onMouseDown={handleResizeDown("both")}
      >
        <div className="w-1.5 h-1.5 rounded-full border-r border-b border-black/20 group-hover:border-black/40" />
      </div>
    </div>
  );
}

