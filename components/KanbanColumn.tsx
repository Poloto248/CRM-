import React, { useState } from 'react';
import { Customer, Column as ColumnType } from '../types';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  column: ColumnType;
  cards: Customer[];
  onDrop: (e: React.DragEvent<HTMLDivElement>, columnId: string) => void;
  onCardAction: (action: 'edit' | 'note' | 'reminder' | 'whatsapp' | 'tags', card: Customer) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, cardId: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, cards, onDrop, onCardAction, onDragStart }) => {
  const [isDraggedOver, setIsDraggedOver] = useState(false);

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

  return (
    <div className="w-full md:w-80 bg-gray-200 dark:bg-gray-800/50 rounded-lg p-2 flex-shrink-0">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 p-2 mb-2 sticky top-0 bg-gray-200 dark:bg-gray-800/50 z-10">
        {column.title} ({cards.length})
      </h3>
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
            onAddNote={(c) => onCardAction('note', c)}
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