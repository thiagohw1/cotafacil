import { Button } from "@/components/ui/button";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="h-auto md:h-16 border-b bg-card flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-6 py-4 md:py-0 gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto overflow-x-auto">
        {actions}


      </div>
    </header>
  );
}
