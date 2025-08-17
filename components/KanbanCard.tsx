
import React from 'react';
import { Customer } from '../types';
import { EditIcon, WhatsAppIcon, NoteIcon, ClockIcon, TagIcon } from './icons';

interface KanbanCardProps {
  card: Customer;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, cardId: string) => void;
  onEdit: (card: Customer) => void;
  onAddNote: (card: Customer) => void;
  onSetReminder: (card: Customer) => void;
  onSendWhatsApp: (card: Customer) => void;
  onEditTags: (card: Customer) => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ card, onDragStart, onEdit, onAddNote, onSetReminder, onSendWhatsApp, onEditTags }) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(e, card.id);
  };

  const reminderDate = card.reminder ? new Date(card.reminder) : null;
  const isReminderPast = reminderDate && reminderDate.getTime() < Date.now();

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="bg-white dark:bg-gray-800 rounded-lg p-3.5 shadow-sm mb-3 cursor-grab active:cursor-grabbing border-r-4 border-transparent hover:border-blue-500"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-gray-800 dark:text-gray-100">{card.name || 'مشتری جدید'}</h4>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
        <span className="font-medium">خیاطی:</span> {card.shopName} ({card.shopType})
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
        <span className="font-medium">شهر:</span> {card.city}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3" dir="ltr">
        {card.phone}
      </p>

      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {card.tags.map(tag => (
            <span key={tag.id} className={`px-2 py-0.5 text-xs font-medium rounded-full ${tag.color}`}>
              {tag.text}
            </span>
          ))}
        </div>
      )}

      {reminderDate && (
        <div className={`flex items-center text-xs p-1 rounded mb-2 ${isReminderPast ? 'text-red-700 bg-red-100' : 'text-yellow-700 bg-yellow-100'}`}>
           <ClockIcon className="w-4 h-4 mr-1"/>
           یادآوری: {reminderDate.toLocaleString('fa-IR')}
        </div>
      )}

      <div className="flex items-center justify-between text-gray-500">
         <div className="flex items-center gap-2">
            <button onClick={() => onEdit(card)} title="ویرایش" className="hover:text-blue-500"><EditIcon /></button>
            <button onClick={() => onAddNote(card)} title="یادداشت" className="hover:text-yellow-500"><NoteIcon /></button>
            <button onClick={() => onSetReminder(card)} title="یادآوری" className="hover:text-purple-500"><ClockIcon /></button>
            <button onClick={() => onEditTags(card)} title="برچسب" className="hover:text-green-500"><TagIcon /></button>
         </div>
         <button onClick={() => onSendWhatsApp(card)} title="ارسال پیام واتساپ" className="text-green-600 hover:text-green-500">
           <WhatsAppIcon className="w-5 h-5"/>
         </button>
      </div>
    </div>
  );
};

export default KanbanCard;
