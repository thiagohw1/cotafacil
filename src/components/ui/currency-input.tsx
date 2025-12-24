import React, { useState, useEffect } from 'react';
import { Input } from './input';

interface CurrencyInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function CurrencyInput({ value, onChange, disabled, placeholder = "R$ 0,00", className }: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        // Format the value for display
        if (value) {
            const numValue = parseFloat(value.replace(',', '.'));
            if (!isNaN(numValue)) {
                setDisplayValue(formatCurrency(numValue));
            } else {
                setDisplayValue('');
            }
        } else {
            setDisplayValue('');
        }
    }, [value]);

    const formatCurrency = (num: number): string => {
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputValue = e.target.value;

        // Remove all non-numeric characters except comma and dot
        inputValue = inputValue.replace(/[^\d,]/g, '');

        // Replace comma with dot for parsing
        const numericValue = inputValue.replace(',', '.');

        // Update display
        setDisplayValue(inputValue);

        // Send the numeric value to parent
        onChange(numericValue);
    };

    const handleBlur = () => {
        // Format on blur
        if (displayValue) {
            const numValue = parseFloat(displayValue.replace(',', '.'));
            if (!isNaN(numValue)) {
                setDisplayValue(formatCurrency(numValue));
            }
        }
    };

    const handleFocus = () => {
        // Remove formatting on focus for easier editing
        if (displayValue) {
            const cleaned = displayValue.replace(/\./g, '');
            setDisplayValue(cleaned);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Find the next input element
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
