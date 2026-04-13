import { X, Plus, Trash2 } from 'lucide-react';

interface PollCreatorProps {
  visible: boolean;
  pollQuestion: string;
  pollOptions: string[];
  allowMultiple: boolean;
  onQuestionChange: (question: string) => void;
  onOptionChange: (index: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onAllowMultipleChange: (allow: boolean) => void;
  onCreatePoll: () => void;
  onClose: () => void;
}

export function PollCreator({
  visible,
  pollQuestion,
  pollOptions,
  allowMultiple,
  onQuestionChange,
  onOptionChange,
  onAddOption,
  onRemoveOption,
  onAllowMultipleChange,
  onCreatePoll,
  onClose,
}: PollCreatorProps) {
  if (!visible) return null;

  const canCreatePoll = pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2;

  return (
    <div className="p-3 border-t border-surface-700 bg-surface-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-surface-100">Create Poll</span>
        <button
          onClick={onClose}
          className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700"
        >
          <X size={16} />
        </button>
      </div>
      <input
        value={pollQuestion}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="Ask a question..."
        className="w-full bg-surface-700 text-surface-100 text-sm rounded-lg px-3 py-2 mb-3 outline-none border border-surface-600 focus:border-brand-500 placeholder:text-surface-500"
      />
      <div className="space-y-2 mb-3">
        {pollOptions.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={option}
              onChange={(e) => onOptionChange(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 bg-surface-700 text-surface-100 text-sm rounded-lg px-3 py-2 outline-none border border-surface-600 focus:border-brand-500 placeholder:text-surface-500"
            />
            {pollOptions.length > 2 && (
              <button
                onClick={() => onRemoveOption(index)}
                className="p-2 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-surface-700"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onAddOption}
          className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
        >
          <Plus size={14} />
          Add option
        </button>
        <label className="flex items-center gap-2 text-xs text-surface-400">
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => onAllowMultipleChange(e.target.checked)}
            className="rounded border-surface-500 text-brand-500"
          />
          Allow multiple answers
        </label>
      </div>
      <button
        onClick={() => { void onCreatePoll(); }}
        disabled={!canCreatePoll}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm py-2 rounded-lg transition-colors"
      >
        Create Poll
      </button>
    </div>
  );
}
