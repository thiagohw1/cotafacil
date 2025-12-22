import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy } from 'lucide-react';

interface DataPoint {
    date: string;
    price: number;
    quoteTitle: string;
    isWinner: boolean;
}

interface Props {
    data: DataPoint[];
}

const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;

    if (payload.isWinner) {
        return (
            <svg x={cx - 10} y={cy - 10} width={20} height={20} viewBox="0 0 24 24" fill="#EAB308" stroke="#EAB308" strokeWidth="2">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
        );
    }

    return (
        <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="white" strokeWidth={2} />
    );
};

export function SupplierPriceHistoryChart({ data }: Props) {
    const formattedData = data.map(d => ({
        ...d,
        formattedDate: format(new Date(d.date), 'dd/MM/yy', { locale: ptBR })
    }));

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                        dataKey="formattedDate"
                        className="text-xs"
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis
                        className="text-xs"
                        tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Preço Ofertado']}
                        labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) {
                                const original = payload[0].payload;
                                return `${label} - ${original.quoteTitle} ${original.isWinner ? '(VENCEDOR)' : ''}`;
                            }
                            return label;
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={<CustomDot />}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
