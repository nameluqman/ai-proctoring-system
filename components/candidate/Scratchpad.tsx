import React, { useEffect, useState } from "react";

interface ScratchpadProps {
  value?: string;
  onChange?: (value: string) => void;
}

export default function Scratchpad({ value = "", onChange }: ScratchpadProps) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setText(nextValue);
    onChange?.(nextValue);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
      <h2 className="text-md font-semibold text-white">Interview Scratchpad</h2>
      <textarea
        rows={6}
        value={text}
        onChange={handleChange}
        placeholder="Write candidate notes or answer interview questions here..."
        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}