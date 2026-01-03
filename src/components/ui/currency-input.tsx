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

    useEffect(() => {
        if (value !== undefined && value !== null) {
            // Value comes as string "10.00" or number
            const num = parseFloat(value.toString().replace(',', '.'));
            if (!isNaN(num)) {
                setDisplayValue(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            } else {
                setDisplayValue('');
            }
        } else {
            setDisplayValue('');
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let rawValue = e.target.value.replace(/\D/g, '');

        // Remove leading zeros
        rawValue = rawValue.replace(/^0+/, '');

        if (!rawValue) {
            setDisplayValue('');
            onChange('');
            return;
        }

        const amount = parseInt(rawValue) / 100;
        const formatted = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        setDisplayValue(formatted);
        onChange(amount.toFixed(2));
    };

    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none z-10">
                R$
            </span>
            <Input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={handleChange}
                disabled={disabled}
                placeholder={placeholder}
                className={`pl-10 ${className}`}
            />
        </div>
    );
}
