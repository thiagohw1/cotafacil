import { useState, useRef, useEffect } from "react";
import { Product } from "../../../types/quote";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuoteItemAdderProps {
    products: Product[];
    onAddItem: (item: { product_id: string; package_id: string; requested_qty: string }) => void;
    loading?: boolean;
}

export function QuoteItemAdder({ products, onAddItem, loading }: QuoteItemAdderProps) {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [packageId, setPackageId] = useState("");
    const [quantity, setQuantity] = useState("1");
    const [searchValue, setSearchValue] = useState("");

    const quantityInputRef = useRef<HTMLInputElement>(null);
    const commandInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (selectedProduct && quantityInputRef.current) {
            quantityInputRef.current.focus();
            quantityInputRef.current.select();
        }
    }, [selectedProduct]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        const defaultPackage = product.packages?.find(p => p.is_default);
        setPackageId(defaultPackage ? defaultPackage.id.toString() : "");
        setQuantity("1");
        setSearchValue(product.name); // Keep name in search box to show selection
    };

    const handleAdd = () => {
        if (!selectedProduct || !quantity) return;

        onAddItem({
            product_id: selectedProduct.id.toString(),
            package_id: packageId,
            requested_qty: quantity,
        });

        handleReset();
    };

    const handleReset = () => {
        setSelectedProduct(null);
        setPackageId("");
        setQuantity("1");
        setSearchValue("");
        commandInputRef.current?.focus();
    };

    return (
            <div className="flex flex-col md:flex-row gap-4 items-end w-full">
                <div className="flex-1 space-y-2 w-full min-w-[200px] relative">
                    {/* <label className="text-sm font-medium">Produto</label> */}
                    <div className="relative">
                        <Command className="rounded-sm border shadow-sm relative overflow-visible z-10">
                            <CommandInput
                                ref={commandInputRef}
                                placeholder="Buscar produto..."
                                value={searchValue}
                                onValueChange={(val) => {
                                    setSearchValue(val);
                                    if (selectedProduct && val !== selectedProduct.name) {
                                        setSelectedProduct(null); // Clear selection if typing
                                    }
                                }}
                                className="h-9"
                            />
                            {searchValue.length > 0 && !selectedProduct && (
                                <div className="absolute top-12 w-full bg-popover text-popover-foreground shadow-md rounded-md border z-50">
                                    <CommandList className={cn(products.length === 0 ? "hidden" : "max-h-[200px] overflow-y-auto p-1")}>
                                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {products.map((product) => (
                                                <CommandItem
                                                    key={product.id}
                                                    value={product.name}
                                                    onSelect={() => handleSelectProduct(product)}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4 opacity-0"
                                                        )}
                                                    />
                                                    {product.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </div>
                            )}
                        </Command>
                        {selectedProduct && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 h-8 w-8 z-20"
                                onClick={handleReset}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="w-full md:w-48 space-y-2">
                    {/* <label className="text-sm font-medium">Embalagem</label> */}
                    <Select
                        value={packageId || "standard"}
                        onValueChange={(val) => setPackageId(val === "standard" ? "" : val)}
                        disabled={!selectedProduct}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Padrão" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="standard">Emb. Padrão</SelectItem>
                            {selectedProduct?.packages?.map(pkg => (
                                <SelectItem key={pkg.id} value={pkg.id.toString()}>
                                    {pkg.unit}-{pkg.multiplier}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full md:w-32 space-y-2">
                    {/* <label className="text-sm font-medium">Quantidade</label> */}
                    <Input
                        ref={quantityInputRef}
                        type="number"
                        min="0"
                        step="0.01"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleAdd();
                            }
                        }}
                        disabled={!selectedProduct}
                    />
                </div>

                <Button onClick={handleAdd} disabled={!selectedProduct || loading} className="w-full md:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                </Button>
            </div>
        
    );
}
