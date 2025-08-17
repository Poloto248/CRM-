import React, { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { BoardData, Customer, Tag, Column } from './types';
import { INITIAL_BOARD_DATA, COLUMN_IDS, WHATSAPP_MESSAGES, TAG_COLORS } from './constants';
import { useLocalStorage } from './hooks/useLocalStorage';
import KanbanColumn from './components/KanbanColumn';
import Modal from './components/Modal';
import { PlusIcon, ExportIcon } from './components/icons';

const App: React.FC = () => {
  const [boardData, setBoardData] = useLocalStorage<BoardData>('maghraz-crm-board', INITIAL_BOARD_DATA);
  const [whatsappMessages, setWhatsappMessages] = useLocalStorage<string[]>('maghraz-crm-whatsapp-messages', WHATSAPP_MESSAGES);
  const [activeModal, setActiveModal] = useState< 'add' | 'edit' | 'note' | 'reminder' | 'whatsapp' | 'tags' | 'import' | 'whatsapp-settings' | null >(null);
  const [selectedCard, setSelectedCard] = useState<Customer | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draggedCardId = useRef<string | null>(null);

  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const remindersToExpire = Object.values(boardData.cards).filter(
        card => card.reminder && card.reminder <= now
      );

      if (remindersToExpire.length > 0) {
        remindersToExpire.forEach(card => {
            if (Notification.permission === 'granted') {
              new Notification(`یادآوری پیگیری برای ${card.name}`, {
                body: `وقت پیگیری مشتری ${card.name} (${card.shopName}) فرا رسیده است.`,
                dir: 'rtl'
              });
            } else {
               alert(`یادآوری پیگیری برای ${card.name}`);
            }
        });

        setBoardData(prev => {
          const newCards = { ...prev.cards };
          const newColumns = JSON.parse(JSON.stringify(prev.columns));
          const cardsToMoveIds = remindersToExpire.map(c => c.id);
          const cardsToMoveSet = new Set(cardsToMoveIds);

          // 1. Update cards: remove reminder
          cardsToMoveIds.forEach(cardId => {
            newCards[cardId] = { ...newCards[cardId] };
            delete newCards[cardId].reminder;
          });

          // 2. Update columns: move cards
          // Remove from all source columns
          for (const columnId in newColumns) {
              newColumns[columnId].cardIds = newColumns[columnId].cardIds.filter(id => !cardsToMoveSet.has(id));
          }

          // Add to 'needs-action' column, avoiding duplicates
          const needsActionCol = newColumns[COLUMN_IDS.NEEDS_ACTION];
          if (needsActionCol) {
            const currentIds = new Set(needsActionCol.cardIds);
            cardsToMoveIds.forEach(id => currentIds.add(id));
            needsActionCol.cardIds = Array.from(currentIds);
          }
          
          return { ...prev, cards: newCards, columns: newColumns };
        });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardData, setBoardData]);

  const handleAddCustomer = (customer: Omit<Customer, 'id' | 'tags'>) => {
    const newId = `card-${Date.now()}`;
    const newCard: Customer = { ...customer, id: newId, tags: [] };
    
    setBoardData(prev => {
      const newCards = { ...prev.cards, [newId]: newCard };
      const startColumn = prev.columns[COLUMN_IDS.NUMBERS_LIST];
      const newStartColumn = { ...startColumn, cardIds: [...startColumn.cardIds, newId] };
      const newColumns = { ...prev.columns, [COLUMN_IDS.NUMBERS_LIST]: newStartColumn };
      return { ...prev, cards: newCards, columns: newColumns };
    });
    setActiveModal(null);
  };
  
  const handleUpdateCustomer = (updatedCard: Customer) => {
    setBoardData(prev => ({
      ...prev,
      cards: { ...prev.cards, [updatedCard.id]: updatedCard }
    }));
    setActiveModal(null);
    setSelectedCard(null);
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, cardId: string) => {
    draggedCardId.current = cardId;
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, destColumnId: string) => {
    if (!draggedCardId.current) return;
    
    const cardId = draggedCardId.current;
    draggedCardId.current = null;

    let sourceColumnId: string | null = null;
    for (const colId in boardData.columns) {
      if (boardData.columns[colId].cardIds.includes(cardId)) {
        sourceColumnId = colId;
        break;
      }
    }

    if (!sourceColumnId || sourceColumnId === destColumnId) return;

    setBoardData(prev => {
      const newBoardData = { ...prev };
      const sourceCol = { ...newBoardData.columns[sourceColumnId!] };
      const destCol = { ...newBoardData.columns[destColumnId] };
      
      sourceCol.cardIds = sourceCol.cardIds.filter(id => id !== cardId);
      destCol.cardIds = [...destCol.cardIds, cardId];

      newBoardData.columns[sourceColumnId!] = sourceCol;
      newBoardData.columns[destColumnId] = destCol;
      
      return newBoardData;
    });
  };

  const handleCardAction = (action: 'edit' | 'note' | 'reminder' | 'whatsapp' | 'tags', card: Customer) => {
    setSelectedCard(card);
    setActiveModal(action);
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const newCustomers = results.data.map((row: any, index: number) => {
            let phone = row['phone'] || row['شماره تلفن'] || '';
            if (phone) {
              phone = String(phone).trim();
              if (!phone.startsWith('0')) {
                phone = `0${phone}`;
              }
            }

            return {
              id: `imported-${Date.now()}-${index}`,
              phone,
              name: row['name'] || row['نام'] || '',
              shopName: row['shopName'] || row['نام خیاطی'] || '',
              shopType: row['shopType'] || row['نوع خیاطی'] || '',
              city: row['city'] || row['شهر'] || '',
              tags: [],
            };
          }).filter((c: Customer) => c.phone);

          setBoardData(prev => {
              const newCards = { ...prev.cards };
              const newCardIds = [];
              for(const customer of newCustomers) {
                  newCards[customer.id] = customer;
                  newCardIds.push(customer.id);
              }
              const importColumn = prev.columns[COLUMN_IDS.NUMBERS_LIST];
              const updatedImportColumn = { ...importColumn, cardIds: [...importColumn.cardIds, ...newCardIds] };
              return {
                  ...prev,
                  cards: newCards,
                  columns: {...prev.columns, [COLUMN_IDS.NUMBERS_LIST]: updatedImportColumn}
              }
          });
        },
      });
      event.target.value = ''; // Reset file input
    }
  };

  const handleExportTemplate = () => {
    const headers = ['شماره تلفن', 'نام', 'نام خیاطی', 'نوع خیاطی', 'شهر'];
    const csvContent = headers.join(',') + '\n';
    
    // Use BOM for better Excel compatibility with UTF-8
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'maghraz_crm_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  const renderModalContent = () => {
    if (!activeModal || !selectedCard && ['edit', 'note', 'reminder', 'whatsapp', 'tags'].includes(activeModal)) return null;

    switch(activeModal) {
      case 'add':
      case 'edit':
        return <CustomerForm 
                customer={activeModal === 'edit' ? selectedCard : undefined}
                onSubmit={activeModal === 'add' ? (c) => handleAddCustomer(c) : (c) => handleUpdateCustomer(c as Customer)} 
                onClose={() => setActiveModal(null)}
               />;
      case 'note':
        return <NoteForm customer={selectedCard!} onSubmit={handleUpdateCustomer} />;
      case 'reminder':
        return <ReminderForm customer={selectedCard!} onSubmit={handleUpdateCustomer} />;
      case 'whatsapp':
        return <WhatsAppForm customer={selectedCard!} messages={whatsappMessages} onSubmit={() => setActiveModal(null)} />;
      case 'tags':
        return <TagForm customer={selectedCard!} onSubmit={handleUpdateCustomer} />;
      case 'whatsapp-settings':
        return <WhatsAppSettingsForm
                  initialMessages={whatsappMessages}
                  onSubmit={(newMessages) => {
                    setWhatsappMessages(newMessages);
                    setActiveModal(null);
                  }}
                  onClose={() => setActiveModal(null)}
                />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 flex flex-col font-[Vazirmatn,sans-serif]">
      <header className="p-4 bg-white dark:bg-gray-800 shadow-md flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Maghraz CRM</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveModal('add')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">افزودن مشتری</span>
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <span className="hidden sm:inline">ایمپورت</span>
             <span className="sm:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
             </span>
          </button>
           <button
            onClick={handleExportTemplate}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <ExportIcon className="w-5 h-5" />
            <span className="hidden sm:inline">دانلود نمونه</span>
          </button>
          <button
            onClick={() => setActiveModal('whatsapp-settings')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
             <span className="hidden sm:inline">مدیریت پیام‌ها</span>
             <span className="sm:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </span>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileImport} />
        </div>
      </header>
      <main className="flex-grow p-4 overflow-x-auto">
        <div className="flex flex-col md:flex-row gap-4">
          {boardData.columnOrder.map(columnId => {
            const column = boardData.columns[columnId];
            const cards = column.cardIds.map(cardId => boardData.cards[cardId]).filter(Boolean);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={cards}
                onDrop={handleDrop}
                onCardAction={handleCardAction}
                onDragStart={handleDragStart}
              />
            );
          })}
        </div>
      </main>
      {activeModal && (
        <Modal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={
            {
                add: "افزودن مشتری جدید",
                edit: "ویرایش مشتری",
                note: `یادداشت برای ${selectedCard?.name}`,
                reminder: `تنظیم یادآوری برای ${selectedCard?.name}`,
                whatsapp: `ارسال واتساپ به ${selectedCard?.name}`,
                tags: `برچسب‌ها برای ${selectedCard?.name}`,
                'whatsapp-settings': 'مدیریت پیام‌های آماده واتساپ'
            }[activeModal] || ''
        }>
            {renderModalContent()}
        </Modal>
      )}
    </div>
  );
};

// --- Form Components ---

interface CustomerFormProps {
    customer?: Customer;
    onSubmit: (customer: Omit<Customer, 'id' | 'tags'> | Customer) => void;
    onClose: () => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onSubmit, onClose }) => {
    const [formData, setFormData] = useState({
        phone: customer?.phone || '',
        name: customer?.name || '',
        shopName: customer?.shopName || '',
        shopType: customer?.shopType || '',
        city: customer?.city || ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customer) {
            onSubmit({ ...customer, ...formData });
        } else {
            onSubmit(formData);
        }
    };
    
    const formFields = [
        { name: "phone", label: "شماره تلفن", type: "tel"},
        { name: "name", label: "نام مشتری", type: "text"},
        { name: "shopName", label: "نام خیاطی", type: "text"},
        { name: "shopType", label: "نوع خیاطی", type: "text"},
        { name: "city", label: "شهر", type: "text"},
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {formFields.map(field => (
                <div key={field.name}>
                    <label htmlFor={field.name} className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">{field.label}</label>
                    <input 
                        type={field.type} 
                        id={field.name} 
                        name={field.name} 
                        value={formData[field.name as keyof typeof formData]}
                        onChange={handleChange}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                        required 
                    />
                </div>
            ))}
            <div className="flex justify-end gap-2 pt-4">
                 <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">لغو</button>
                 <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{customer ? 'ذخیره تغییرات' : 'افزودن'}</button>
            </div>
        </form>
    )
}

const NoteForm: React.FC<{ customer: Customer; onSubmit: (customer: Customer) => void; }> = ({ customer, onSubmit }) => {
    const [notes, setNotes] = useState(customer.notes || '');
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...customer, notes }); }}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
          placeholder="یادداشت خود را اینجا بنویسید..."
        />
        <div className="flex justify-end pt-4">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">ذخیره یادداشت</button>
        </div>
      </form>
    );
};
  
const ReminderForm: React.FC<{ customer: Customer; onSubmit: (customer: Customer) => void; }> = ({ customer, onSubmit }) => {
    const [reminder, setReminder] = useState('');
    const [jalaliDate, setJalaliDate] = useState<string | null>(null);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateValue = e.target.value;
        setReminder(dateValue);

        if (dateValue) {
            try {
                const date = new Date(dateValue);
                setJalaliDate(date.toLocaleString('fa-IR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }));
            } catch (error) {
                setJalaliDate('تاریخ نامعتبر');
            }
        } else {
            setJalaliDate(null);
        }
    };
    
    return (
        <form onSubmit={(e) => { e.preventDefault(); if(reminder) onSubmit({ ...customer, reminder: new Date(reminder).getTime() }); }} className="space-y-4">
            <label htmlFor="reminder-time" className="block text-sm font-medium">زمان یادآوری</label>
            <input
                type="datetime-local"
                id="reminder-time"
                value={reminder}
                onChange={handleDateChange}
                className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                required
            />
            {jalaliDate && (
                <p className="text-sm text-center text-gray-600 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                    تاریخ شمسی: <span className="font-semibold">{jalaliDate}</span>
                </p>
            )}
            <div className="flex justify-end pt-4">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" disabled={!reminder}>تنظیم یادآوری</button>
            </div>
        </form>
    );
};

const WhatsAppForm: React.FC<{ customer: Customer; messages: string[]; onSubmit: () => void; }> = ({ customer, messages, onSubmit }) => {
    const sendMessage = (message: string) => {
        let phone = customer.phone.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) {
            phone = phone.substring(1);
        }
        const whatsappPhone = `98${phone}`;
        const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        onSubmit();
    };

    return (
        <div className="space-y-3">
            <p>یک پیام آماده برای ارسال به <span className="font-bold">{customer.name}</span> انتخاب کنید:</p>
            {messages.map((msg, i) => (
                <button
                    key={i}
                    onClick={() => sendMessage(msg)}
                    className="w-full text-right p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                    {msg}
                </button>
            ))}
        </div>
    );
};

const TagForm: React.FC<{ customer: Customer; onSubmit: (customer: Customer) => void; }> = ({ customer, onSubmit }) => {
    const [tags, setTags] = useState<Tag[]>(customer.tags);
    const [newTagText, setNewTagText] = useState('');
    const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  
    const addTag = () => {
      if (newTagText.trim() && !tags.some(t => t.text === newTagText.trim())) {
        setTags([...tags, { id: `tag-${Date.now()}`, text: newTagText.trim(), color: selectedColor }]);
        setNewTagText('');
      }
    };
  
    const removeTag = (tagId: string) => {
      setTags(tags.filter(t => t.id !== tagId));
    };
  
    const handleSubmit = () => {
      onSubmit({ ...customer, tags });
    };
  
    return (
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2">برچسب‌های فعلی</h4>
          <div className="flex flex-wrap gap-2">
            {tags.length > 0 ? tags.map(tag => (
              <span key={tag.id} className={`flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full ${tag.color}`}>
                {tag.text}
                <button onClick={() => removeTag(tag.id)} className="text-sm opacity-70 hover:opacity-100">&times;</button>
              </span>
            )) : <p className="text-sm text-gray-500">هیچ برچسبی وجود ندارد.</p>}
          </div>
        </div>
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">افزودن برچسب جدید</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagText}
              onChange={(e) => setNewTagText(e.target.value)}
              placeholder="متن برچسب..."
              className="flex-grow p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
            <button onClick={addTag} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">افزودن</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
              {TAG_COLORS.map(color => (
                <button key={color} onClick={() => setSelectedColor(color)} className={`w-8 h-8 rounded-full ${color} ${selectedColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}></button>
              ))}
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">ذخیره برچسب‌ها</button>
        </div>
      </div>
    );
};

const WhatsAppSettingsForm: React.FC<{
    initialMessages: string[];
    onSubmit: (messages: string[]) => void;
    onClose: () => void;
}> = ({ initialMessages, onSubmit, onClose }) => {
    const [messages, setMessages] = useState(initialMessages);
    const [newMessage, setNewMessage] = useState('');

    const handleMessageChange = (index: number, value: string) => {
        const updated = [...messages];
        updated[index] = value;
        setMessages(updated);
    };

    const handleDelete = (index: number) => {
        setMessages(messages.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
        if (newMessage.trim()) {
            setMessages([...messages, newMessage.trim()]);
            setNewMessage('');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(messages);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">پیام‌های فعلی</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {messages.map((msg, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={msg}
                                onChange={(e) => handleMessageChange(index, e.target.value)}
                                className="flex-grow bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={() => handleDelete(index)}
                                className="p-2 text-red-500 hover:text-red-700 rounded-full"
                                aria-label="حذف پیام"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="border-t pt-4 dark:border-gray-600">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">افزودن پیام جدید</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="متن پیام جدید..."
                        className="flex-grow bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                    />
                    <button type="button" onClick={handleAdd} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">افزودن</button>
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">لغو</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">ذخیره پیام‌ها</button>
            </div>
        </form>
    );
};

export default App;
