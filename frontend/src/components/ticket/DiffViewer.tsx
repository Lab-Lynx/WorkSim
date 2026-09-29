import React, { useState } from 'react';
import { cn } from '@/lib/utils'; // adjust import path as appropriate for your project setup

export interface FileDiff {
    filename: string;
    additions: number;
    deletions: number;
    patch?: string;
}

export interface DiffViewerProps {
    diffs?: FileDiff[];
    className?: string;
}

type DiffViewMode = 'unified' | 'split';

interface ParsedLine {
    type: 'add' | 'delete' | 'context' | 'header';
    oldLineNumber?: number;
    newLineNumber?: number;
    content: string;
}

function parsePatch(patch: string): ParsedLine[] {
    const lines = patch.split('\n');
    const parsedLines: ParsedLine[] = [];

    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
        if (line.startsWith('@@')) {
            const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (match) {
                oldLine = parseInt(match[1], 10);
                newLine = parseInt(match[2], 10);
            }
            parsedLines.push({
                type: 'header',
                content: line,
            });
        } else if (line.startsWith('+')) {
            parsedLines.push({
                type: 'add',
                newLineNumber: newLine++,
                content: line.slice(1),
            });
        } else if (line.startsWith('-')) {
            parsedLines.push({
                type: 'delete',
                oldLineNumber: oldLine++,
                content: line.slice(1),
            });
        } else {
            parsedLines.push({
                type: 'context',
                oldLineNumber: oldLine++,
                newLineNumber: newLine++,
                content: line.startsWith(' ') ? line.slice(1) : line,
            });
        }
    }

    return parsedLines;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffs = [], className }) => {
    const [viewMode, setViewMode] = useState<DiffViewMode>('unified');
    const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

    const toggleFile = (filename: string) => {
        setCollapsedFiles((prev) => ({
            ...prev,
            [filename]: !prev[filename],
        }));
    };

    if (!diffs || diffs.length === 0) {
        return (
            <div className={cn('p-6 text-center text-zinc-500 bg-zinc-50 rounded-lg border border-zinc-200', className)}>
                No changes to display.
            </div>
        );
    }

    return (
        <div className={cn('space-y-4 font-mono text-sm', className)}>
            <div className="flex items-center justify-between px-2 py-1 bg-zinc-100 rounded-md border border-zinc-200">
                <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                    {diffs.length} {diffs.length === 1 ? 'file changed' : 'files changed'}
                </span>
                <div className="flex items-center space-x-1 bg-zinc-200 p-0.5 rounded">
                    <button
                        type="button"
                        onClick={() => setViewMode('unified')}
                        className={cn(
                            'px-2 py-1 text-xs rounded transition-colors',
                            viewMode === 'unified' ? 'bg-white font-medium text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                        )}
                    >
                        Unified
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('split')}
                        className={cn(
                            'px-2 py-1 text-xs rounded transition-colors',
                            viewMode === 'split' ? 'bg-white font-medium text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                        )}
                    >
                        Split
                    </button>
                </div>
            </div>

            {diffs.map((file) => {
                const isCollapsed = collapsedFiles[file.filename];
                const parsedLines = file.patch ? parsePatch(file.patch) : [];

                return (
                    <div key={file.filename} className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
                        <div
                            onClick={() => toggleFile(file.filename)}
                            className="flex items-center justify-between px-4 py-2 bg-zinc-50 hover:bg-zinc-100 cursor-pointer border-b border-zinc-200 select-none"
                        >
                            <div className="flex items-center space-x-2">
                                <span className="text-zinc-400 text-xs">{isCollapsed ? '▶' : '▼'}</span>
                                <span className="font-semibold text-zinc-800">{file.filename}</span>
                            </div>
                            <div className="flex items-center space-x-3 text-xs font-medium">
                                <span className="text-emerald-600">+{file.additions}</span>
                                <span className="text-rose-600">-{file.deletions}</span>
                            </div>
                        </div>

                        {!isCollapsed && (
                            <div className="overflow-x-auto">
                                {parsedLines.length === 0 ? (
                                    <div className="p-4 text-zinc-400 italic text-xs">No patch available</div>
                                ) : viewMode === 'unified' ? (
                                    <table className="w-full text-xs font-mono border-collapse">
                                        <tbody>
                                            {parsedLines.map((line, idx) => {
                                                if (line.type === 'header') {
                                                    return (
                                                        <tr key={idx} className="bg-blue-50/50 text-blue-600">
                                                            <td colSpan={3} className="px-4 py-1 italic font-medium border-y border-blue-100">
                                                                {line.content}
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return (
                                                    <tr
                                                        key={idx}
                                                        className={cn(
                                                            line.type === 'add' && 'bg-emerald-50/60 text-emerald-950',
                                                            line.type === 'delete' && 'bg-rose-50/60 text-rose-950',
                                                            line.type === 'context' && 'hover:bg-zinc-50 text-zinc-800'
                                                        )}
                                                    >
                                                        <td className="w-12 select-none text-right pr-2 text-zinc-400 border-r border-zinc-100 py-0.5">
                                                            {line.oldLineNumber || ''}
                                                        </td>
                                                        <td className="w-12 select-none text-right pr-2 text-zinc-400 border-r border-zinc-100 py-0.5">
                                                            {line.newLineNumber || ''}
                                                        </td>
                                                        <td className="px-3 whitespace-pre py-0.5">
                                                            <span className="select-none inline-block w-4">
                                                                {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                                                            </span>
                                                            {line.content}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="w-full text-xs font-mono border-collapse">
                                        <tbody>
                                            {parsedLines.map((line, idx) => {
                                                if (line.type === 'header') {
                                                    return (
                                                        <tr key={idx} className="bg-blue-50/50 text-blue-600">
                                                            <td colSpan={4} className="px-4 py-1 italic font-medium border-y border-blue-100">
                                                                {line.content}
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                if (line.type === 'delete') {
                                                    return (
                                                        <tr key={idx} className="bg-rose-50/40">
                                                            <td className="w-10 select-none text-right pr-2 text-zinc-400 border-r border-zinc-100 py-0.5">
                                                                {line.oldLineNumber}
                                                            </td>
                                                            <td className="w-1/2 px-3 whitespace-pre text-rose-950 border-r border-zinc-200 py-0.5">
                                                                - {line.content}
                                                            </td>
                                                            <td className="w-10 select-none border-r border-zinc-100" />
                                                            <td className="w-1/2 px-3 bg-zinc-50/30" />
                                                        </tr>
                                                    );
                                                }

                                                if (line.type === 'add') {
                                                    return (
                                                        <tr key={idx} className="bg-emerald-50/40">
                                                            <td className="w-10 select-none border-r border-zinc-100" />
                                                            <td className="w-1/2 px-3 border-r border-zinc-200 bg-zinc-50/30" />
                                                            <td className="w-10 select-none text-right pr-2 text-zinc-400 border-r border-zinc-100 py-0.5">
                                                                {line.newLineNumber}
                                                            </td>
                                                            <td className="w-1/2 px-3 whitespace-pre text-emerald-950 py-0.5">
                                                                + {line.content}
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return (
                                                    <tr key={idx} className="hover:bg-zinc-50">
                                                        <td className="w-10 select-none text-right pr-2 text-zinc-400 border-r border-zinc-100 py-0.5">
                                                            {line.oldLineNumber}
                                                        </td>
                                                        <td className="w-1/2 px-3 whitespace-pre text-zinc-800 border-r border-zinc-200 py-0.5">
                                                            {line.content}
                                                        </td>
                                                        <td className="w-10 select-none text-right pr-2 text-zinc-400 border-r border-zinc-100 py-0.5">
                                                            {line.newLineNumber}
                                                        </td>
                                                        <td className="w-1/2 px-3 whitespace-pre text-zinc-800 py-0.5">
                                                            {line.content}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};