import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
  onSubmit: (text: string) => void;
  feedback: { type: 'ok' | 'err'; text: string } | null;
  onDismissFeedback: () => void;
};

export function AgentBar({ onSubmit, feedback, onDismissFeedback }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(onDismissFeedback, 4500);
    return () => clearTimeout(t);
  }, [feedback, onDismissFeedback]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      className="relative z-10 overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-ink-900/95 via-[#141722] to-violet-950/45 p-1 shadow-[0_16px_48px_-12px_rgba(109,40,217,0.45)] ring-1 ring-violet-400/25 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[size:24px_24px] bg-grid-pattern opacity-[0.35]" />
      <div className="relative flex flex-col gap-3 rounded-[0.875rem] bg-ink-950/55 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-3.5">
        <div className="flex min-w-0 shrink-0 items-center gap-2.5 text-violet-300/90">
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="shrink-0 text-violet-400"
          >
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </motion.div>
          <p className="text-sm font-medium leading-snug text-ink-100">
            <span className="whitespace-nowrap">Quick add — try </span>
            <span className="text-teal-300">&ldquo;Add 30 rs in Fruits&rdquo;</span>
          </p>
        </div>
        <form
          className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-2 sm:gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = value.trim();
            if (!t) return;
            onSubmit(t);
            setValue('');
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type a command..."
            className="min-w-0 flex-1 rounded-xl border-2 border-violet-500/45 bg-ink-900/90 px-4 py-2.5 text-sm text-ink-50 outline-none transition placeholder:text-ink-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/35"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 sm:min-w-[5.5rem]"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </motion.button>
        </form>
      </div>
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            key={feedback.text}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative border-t border-violet-500/15 bg-black/25 px-4 py-2.5"
          >
            <p
              className={`text-sm font-medium ${
                feedback.type === 'ok' ? 'text-teal-300' : 'text-rose-300'
              }`}
            >
              {feedback.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
