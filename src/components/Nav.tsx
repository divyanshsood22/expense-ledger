import { cn } from "@/lib/utils";

export type View = "dashboard" | "history" | "analytics";

interface NavProps {
  current: View;
  onNavigate: (view: View) => void;
}

const items: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "history", label: "History" },
  { id: "analytics", label: "Analytics" },
];

export default function Nav({ current, onNavigate }: NavProps) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-serif text-lg text-foreground">Ledger</span>
        <nav className="flex items-center gap-5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "border-b-2 pb-1 text-sm transition-colors",
                current === item.id
                  ? "border-foreground text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}