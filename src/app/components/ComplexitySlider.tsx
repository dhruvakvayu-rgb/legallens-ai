import * as Slider from '@radix-ui/react-slider';

interface ComplexitySliderProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

const LEVEL_LABELS: Record<number, { label: string; hint: string }> = {
  1:  { label: "ELI5 — Explain Like I'm 5",       hint: 'Simple analogies, 1–2 sentences' },
  2:  { label: "ELI5 — Very Simple",               hint: 'Child-friendly language, short' },
  3:  { label: "Plain English",                    hint: 'No jargon, easy to follow' },
  4:  { label: "Plain English — More Detail",      hint: 'Everyday language, a bit more context' },
  5:  { label: "Balanced Overview",                hint: 'Basic legal terms explained simply' },
  6:  { label: "Balanced — Slightly Technical",    hint: 'Introduces key legal concepts' },
  7:  { label: "Detailed Explanation",             hint: 'Legal terminology with reasoning' },
  8:  { label: "Detailed — In-Depth",              hint: 'Full legal context and implications' },
  9:  { label: "Expert / Legal Level",             hint: 'Technical language, edge cases' },
  10: { label: "Advanced Legal Analysis",          hint: 'Full legal depth, statutes, risks' },
};

export function ComplexitySlider({ value, onChange, className = '' }: ComplexitySliderProps) {
  const { label, hint } = LEVEL_LABELS[value] ?? LEVEL_LABELS[5];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-foreground">Explanation Level</h4>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-muted-foreground">Level</span>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent w-6 text-center">
            {value}
          </span>
        </div>
      </div>

      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        max={10}
        min={1}
        step={1}
      >
        <Slider.Track className="bg-muted relative grow rounded-full h-2">
          <Slider.Range className="absolute bg-gradient-to-r from-blue-500 to-purple-500 rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          className="block w-5 h-5 bg-white dark:bg-card shadow-lg rounded-full border-2 border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors cursor-grab active:cursor-grabbing"
          aria-label="Complexity level"
        />
      </Slider.Root>

      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
        <span>1 · ELI5</span>
        <span>5 · Balanced</span>
        <span>10 · Expert</span>
      </div>
    </div>
  );
}
