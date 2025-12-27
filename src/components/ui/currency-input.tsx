import React, { useState, useEffect } from 'react';
import { Input } from './input';

interface CurrencyInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function CurrencyInput({ value, onChange, disabled, placeholder = "0,00", className }: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        // Only update display value from prop if not focused to avoid interrupting typing
        if (!isFocused && value) {
            const numValue = parseFloat(value.replace(',', '.'));
            if (!isNaN(numValue)) {
                setDisplayValue(formatCurrency(numValue));
            } else {
                setDisplayValue('');
            }
        } else if (!value && !isFocused) {
            setDisplayValue('');
        }
    }, [value, isFocused]);

    const formatCurrency = (num: number): string => {
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputValue = e.target.value;

        // Allow digits and one comma
        inputValue = inputValue.replace(/[^\d,]/g, '');

        // Ensure only one comma
        const parts = inputValue.split(',');
        if (parts.length > 2) {
            inputValue = parts[0] + ',' + parts.slice(1).join('');
        }

        setDisplayValue(inputValue);

        // Send normalized value to parent (with dot)
        const numericValue = inputValue.replace(',', '.');
        onChange(numericValue);
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (displayValue) {
            const numValue = parseFloat(displayValue.replace(',', '.'));
            if (!isNaN(numValue)) {
                setDisplayValue(formatCurrency(numValue));
            }
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
        // On focus, passing the raw value is usually better, but keeping what user typed is fine too.
        // If it was formatted (e.g. 1.000,00), we might want to strip thousands separators if we had them.
        // Current formatCurrency uses locale which might add thousands dots.
        // Let's strip dots for editing.
        if (displayValue) {
            // Remove dots (thousands separators) but keep comma
            const rawValue = displayValue.replace(/\./g, '');
            setDisplayValue(rawValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.currentTarget.form;
            if (form) {
                const inputs = Array.from(form.querySelectorAll('input:not([disabled])'));
                const currentIndex = inputs.indexOf(e.currentTarget);
                const nextInput = inputs[currentIndex + 1] as HTMLInputElement;
                if (nextInput) {
                    nextInput.focus();
                }
            }
        }
    };

    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none z-10">
                R$
            </span>
            <Input
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={placeholder}
                className={`pl-10 ${className}`}
            />
        </div>
    );
}
