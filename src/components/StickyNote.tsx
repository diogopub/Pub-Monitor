import { useState, useRef, useEffect } from "react";
import { X, GripVertical, Square } from "lucide-react";
import { useReminders, POST_IT_COLORS, Reminder } from "@/contexts/RemindersContext";
import { cn } from "@/lib/utils";

export default function StickyNote({ reminder }: { reminder: Reminder }) {
  const { updateReminder, deleteReminder } = useReminders();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [text, setText] = useState(reminder.text);

  // Sync internal text state with external reminder text
  useEffect(() => {
    setText(reminder.text);
  }, [reminder.text]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - reminder.x,
      y: e.clientY - reminder.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      updateReminder(reminder.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, reminder.id, updateReminder]);

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
        isDragging ? "shadow-2xl scale-[1.02] rotate-1 cursor-grabbing" : "cursor-default"
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
        onMouseDown={handleMouseDown}
        className="h-6 flex items-center justify-between px-1 cursor-grab active:cursor-grabbing border-b border-black/5"
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
      <div className="flex-1 p-2 flex">
        <textarea
          value={text}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder="Lembrete..."
          className="w-full h-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-sm font-medium text-black/80 placeholder:text-black/20 font-handwriting leading-tight"
          style={{ fontFamily: "'Sora', sans-serif" }} // Using Sora until we check if a handwriting font exists
        />
      </div>
    </div>
  );
}
