import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Pencil, Trash2, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { Category } from "@/components/modals/CategoryModal";

interface CategoryTreeProps {
    categories: Category[];
    onEdit: (category: Category) => void;
    onDelete: (category: Category) => void;
}

interface TreeNodeProps {
    category: Category;
    level: number;
    children: Category[];
    allCategories: Category[];
    onEdit: (category: Category) => void;
    onDelete: (category: Category) => void;
}

function TreeNode({ category, level, children, allCategories, onEdit, onDelete }: TreeNodeProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = children.length > 0;

    const handleToggle = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-md group transition-colors",
                    level > 0 && "ml-6"
                )}
            >
                <div className="flex items-center gap-2 flex-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-6 w-6 shrink-0", !hasChildren && "opacity-0")}
                        onClick={handleToggle}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>

                    <div className="text-muted-foreground">
                        {isExpanded ? (
                            <FolderOpen className="h-4 w-4" />
                        ) : (
                            <Folder className="h-4 w-4" />
                        )}
                    </div>

                    <span className="font-medium text-sm">{category.name}</span>

                    <div className="ml-2">
                        <StatusBadge status={category.active ? "active" : "inactive"} />
                    </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(category)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onDelete(category)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="border-l border-border ml-[1.1rem]">
                    {children.map((child) => {
                        const grandChildren = allCategories.filter((c) => c.parent_id === child.id);
                        return (
                            <TreeNode
                                key={child.id}
                                category={child}
                                level={level + 1}
                                children={grandChildren}
                                allCategories={allCategories}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function CategoryTree({ categories, onEdit, onDelete }: CategoryTreeProps) {
    // Find top level categories (those without parent or parent is not in the list)
    const rootCategories = categories.filter((c) => !c.parent_id);

    if (categories.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Nenhuma categoria encontrada
            </div>
        );
    }

    return (
        <div className="border rounded-md p-2 bg-card">
            {rootCategories.map((category) => {
                const children = categories.filter((c) => c.parent_id === category.id);
                return (
                    <TreeNode
                        key={category.id}
                        category={category}
                        level={0}
                        children={children}
                        allCategories={categories}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                );
            })}
        </div>
    );
}
