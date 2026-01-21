"use client";

import React from 'react';
import { Button } from './Button';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirmer",
    cancelText = "Annuler",
    type = 'info'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const baseIcon = type === 'danger' ? '⚠️' : type === 'warning' ? '🔔' : 'ℹ️';
    const accentClass = type === 'danger' ? 'from-red-600 to-rose-700 shadow-red-200' :
        type === 'warning' ? 'from-amber-500 to-orange-600 shadow-amber-200' :
            'from-blue-600 to-indigo-700 shadow-blue-200';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-slide-up border border-white/20">
                {/* Header/Icon Area */}
                <div className={`h-24 bg-gradient-to-br ${type === 'danger' ? 'from-red-50 to-rose-100' : 'from-blue-50 to-indigo-100'} flex items-center justify-center`}>
                    <div className={`w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center text-3xl transform -rotate-6`}>
                        {baseIcon}
                    </div>
                </div>

                <div className="p-8 text-center">
                    <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">
                        {title}
                    </h3>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            onClick={onCancel}
                            variant="ghost"
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                            {cancelText}
                        </Button>
                        <Button
                            onClick={onConfirm}
                            className={`w-full bg-gradient-to-r ${accentClass} text-white shadow-lg border-none`}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
