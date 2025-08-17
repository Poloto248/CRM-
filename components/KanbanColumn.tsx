
import React, { useState, useEffect, useRef } from 'react';
import { Customer, Column as ColumnType } from '../types';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  column: ColumnType;
  cards: Customer[];
  bgColor: string;
  headerColor: string;
  onDrop: (e: React.DragEvent<HTMLDivElement>, columnId: string) => void;
  onCardAction: (action: 'edit' | 'viewHistory' | 'reminder' | 'whatsapp' | 'tags' | 'call', card: Customer) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, cardId: string) => void;
  onUpdateTitle: (columnId: string, newTitle: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, cards, bgColor, headerColor, onDrop, onCardAction, onDragStart, onUpdateTitle }) => {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(column.title);
  }, [column.title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggedOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggedOver(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    onDrop(e, column.id);
    setIsDraggedOver(false);
  };
  
  const handleTitleBlur = () => {
    if (title.trim() && title.trim() !== column.title) {
      onUpdateTitle(column.id, title.trim());
    } else {
        setTitle(column.title);
    }
    setIsEditing(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setTitle(column.title);
      setIsEditing(false);
    }
  };

  return (
    <div className={`w-full md:w-80 rounded-lg p-2 flex-shrink-0 ${bgColor}`}>
      <div className={`text-lg font-semibold text-gray-700 dark:text-gray-200 p-2 mb-2 sticky top-0 z-10 ${headerColor}`}>
        {isEditing ? (
            <input
                ref={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="w-full bg-transparent border-b-2 border-blue-500 focus:outline-none"
            />
        ) : (
            <h3 onClick={() => setIsEditing(true)} className="cursor-pointer">
                {column.title} ({cards.length})
            </h3>
        )}
      </div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`min-h-[50px] md:min-h-[70vh] rounded-lg transition-colors duration-300 ${isDraggedOver ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
      >
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onDragStart={onDragStart}
            onEdit={(c) => onCardAction('edit', c)}
            onCall={(c) => onCardAction('call', c)}
            onViewHistory={(c) => onCardAction('viewHistory', c)}
            onSetReminder={(c) => onCardAction('reminder', c)}
            onSendWhatsApp={(c) => onCardAction('whatsapp', c)}
            onEditTags={(c) => onCardAction('tags', c)}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanColumn;