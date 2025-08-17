import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { BoardData, Customer, Tag, Column, CallLog } from './types';
import { INITIAL_BOARD_DATA, COLUMN_IDS, WHATSAPP_MESSAGES, TAG_COLORS, COLUMN_COLORS } from './constants';
import { useLocalStorage } from './hooks/useLocalStorage';
import KanbanColumn from './components/KanbanColumn';
import Modal from './components/Modal';
import { PlusIcon, ExportIcon, SettingsIcon, CallIcon, TrashIcon, SearchIcon, FilterIcon, EditIcon } from './components/icons';

const App: React.FC = () => {
  const [boardData, setBoardData] = useLocalStorage<BoardData>('maghraz-crm-board-data', INITIAL_BOARD_DATA);
  const [whatsappMessages, setWhatsappMessages] = useLocalStorage<string[]>('maghraz-crm-whatsapp-messages', WHATSAPP_MESSAGES);
  
  const [activeModal, setActiveModal] = useState< 'add' | 'edit' | 'viewHistory' | 'reminder' | 'whatsapp' | 'tags' | 'import' | 'whatsapp-settings' | null >(null);
  const [selectedCard, setSelectedCard] = useState<Customer | null>(null);
  const [newCallIdToEdit, setNewCallIdToEdit] = useState<string | null>(null);
  
  // UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagTexts, setSelectedTagTexts] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draggedCardId = useRef<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

          cardsToMoveIds.forEach(cardId => {
            newCards[cardId] = { ...newCards[cardId] };
            delete newCards[cardId].reminder;
          });

          for (const columnId in newColumns) {
              newColumns[columnId].cardIds = newColumns[columnId].cardIds.filter(id => !cardsToMoveSet.has(id));
          }

          const needsActionCol = newColumns[COLUMN_IDS.NEEDS_ACTION];
          if (needsActionCol) {
            const currentIds = new Set(needsActionCol.cardIds);
            cardsToMoveIds.forEach(id => currentIds.add(id));
            needsActionCol.cardIds = Array.from(currentIds);
          }
          
          return { ...prev, cards: newCards, columns: newColumns };
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [boardData, setBoardData]);

  const handleAddCustomer = (customerData: Omit<Customer, 'id' | 'callHistory'>) => {
    const newId = `card-${Date.now()}`;
    const newCard: Customer = { ...customerData, id: newId, callHistory: [] };
    
    setBoardData(prev => {
      const newCards = { ...prev.cards, [newId]: newCard };
      const startColumn = prev.columns[COLUMN_IDS.NUMBERS_LIST];
      const newStartColumn = { ...startColumn, cardIds: [newId, ...startColumn.cardIds] };
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
  
  const handleCustomerFormSubmit = (customerData: Omit<Customer, 'id' | 'callHistory'> | Customer) => {
    if ('id' in customerData) {
        handleUpdateCustomer(customerData as Customer);
    } else {
        handleAddCustomer(customerData as Omit<Customer, 'id' | 'callHistory'>);
    }
    setActiveModal(null);
  };

  const handleDeleteCustomer = (customerId: string) => {
    setBoardData(prev => {
        const newCards = { ...prev.cards };
        delete newCards[customerId];

        const newColumns = JSON.parse(JSON.stringify(prev.columns));
        for(const columnId in newColumns) {
            newColumns[columnId].cardIds = newColumns[columnId].cardIds.filter((id: string) => id !== customerId);
        }

        return { ...prev, cards: newCards, columns: newColumns };
    });
    setActiveModal(null);
    setSelectedCard(null);
  };


  const handleUpdateColumnTitle = (columnId: string, newTitle: string) => {
    setBoardData(prev => {
        const newColumns = {
            ...prev.columns,
            [columnId]: {
                ...prev.columns[columnId],
                title: newTitle,
            }
        };
        return {...prev, columns: newColumns};
    })
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
      const newBoardData = JSON.parse(JSON.stringify(prev));
      const sourceCol = newBoardData.columns[sourceColumnId!];
      const destCol = newBoardData.columns[destColumnId];
      
      sourceCol.cardIds = sourceCol.cardIds.filter((id: string) => id !== cardId);
      destCol.cardIds.push(cardId); // simplified drop to end of column

      newBoardData.columns[sourceColumnId!] = sourceCol;
      newBoardData.columns[destColumnId] = destCol;
      
      return newBoardData;
    });
  };

  const handleLogCall = (cardToUpdate: Customer) => {
    const newCall: CallLog = {
      id: `call-${Date.now()}`,
      timestamp: Date.now(),
      notes: '',
    };
    
    const updatedCard: Customer = {
      ...cardToUpdate,
      callHistory: [newCall, ...(cardToUpdate.callHistory || [])],
    };

    setBoardData(prev => ({
      ...prev,
      cards: { ...prev.cards, [updatedCard.id]: updatedCard }
    }));
    
    setSelectedCard(updatedCard);
    setNewCallIdToEdit(newCall.id);
    setActiveModal('viewHistory');
  };

  const handleCardAction = (action: 'edit' | 'viewHistory' | 'reminder' | 'whatsapp' | 'tags' | 'call', card: Customer) => {
    setSelectedCard(card);
    if(action === 'call') {
      handleLogCall(card);
    } else {
      setActiveModal(action);
    }
  };
  
  const handleImportClick = () => {
    setIsSettingsOpen(false);
    fileInputRef.current?.click();
  };
  
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const existingTagsMap = new Map<string, Tag>();
      uniqueTags.forEach(tag => {
          if (!existingTagsMap.has(tag.text)) {
              existingTagsMap.set(tag.text, tag);
          }
      });
      
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
            
            const tagsString = row['tags'] || row['برچسب ها'] || '';
            const tagTexts = tagsString ? tagsString.split(',').map((t:string) => t.trim()).filter(Boolean) : [];
            const customerTags: Tag[] = tagTexts.map((text: string) => {
                if (existingTagsMap.has(text)) {
                    return { ...existingTagsMap.get(text)!, id: `tag-${Date.now()}-${text}` };
                }
                const newColor = TAG_COLORS[existingTagsMap.size % TAG_COLORS.length];
                const newTag: Tag = { id: `tag-${Date.now()}-${text}`, text, color: newColor };
                existingTagsMap.set(text, newTag);
                return newTag;
            });

            return {
              id: `imported-${Date.now()}-${index}`,
              phone,
              name: row['name'] || row['نام'] || '',
              shopName: row['shopName'] || row['نام خیاطی'] || '',
              shopType: row['shopType'] || row['نوع خیاطی'] || '',
              city: row['city'] || row['شهر'] || '',
              tags: customerTags,
              callHistory: [],
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
              const updatedImportColumn = { ...importColumn, cardIds: [...newCardIds, ...importColumn.cardIds] };
              return {
                  ...prev,
                  cards: newCards,
                  columns: {...prev.columns, [COLUMN_IDS.NUMBERS_LIST]: updatedImportColumn}
              }
          });
        },
      });
      event.target.value = '';
    }
  };

  const handleExportTemplate = () => {
    setIsSettingsOpen(false);
    const headers = ['شماره تلفن', 'نام', 'نام خیاطی', 'نوع خیاطی', 'شهر', 'برچسب ها'];
    const csvContent = headers.join(',') + '\n';
    
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

  const uniqueTags = useMemo(() => {
    const allTags = new Map<string, Tag>();
    Object.values(boardData.cards).forEach(card => {
        card.tags.forEach(tag => {
            if (!allTags.has(tag.text)) {
                allTags.set(tag.text, tag);
            }
        });
    });
    return Array.from(allTags.values());
  }, [boardData.cards]);

  const handleTagToggle = (tagText: string) => {
      setSelectedTagTexts(prev => {
          const newSet = new Set(prev);
          if (newSet.has(tagText)) {
              newSet.delete(tagText);
          } else {
              newSet.add(tagText);
          }
          return newSet;
      });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTagTexts(new Set());
  }

  const visibleCardIds = useMemo(() => {
    const allCardIds = Object.keys(boardData.cards);
    const isFiltering = searchTerm || selectedTagTexts.size > 0;

    if (!isFiltering) {
        return new Set(allCardIds);
    }

    return new Set(allCardIds.filter(cardId => {
        const card = boardData.cards[cardId];
        if (!card) return false;

        const searchMatch = !searchTerm ||
            card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            card.phone.includes(searchTerm) ||
            card.shopName.toLowerCase().includes(searchTerm.toLowerCase());

        const tagsMatch = selectedTagTexts.size === 0 ||
            Array.from(selectedTagTexts).every(selectedTag => 
                card.tags.some(cardTag => cardTag.text === selectedTag)
            );

        return searchMatch && tagsMatch;
    }));
  }, [boardData.cards, searchTerm, selectedTagTexts]);

  const renderModalContent = () => {
    if (!activeModal || !selectedCard && ['edit', 'viewHistory', 'reminder', 'whatsapp', 'tags'].includes(activeModal)) return null;

    switch(activeModal) {
      case 'add':
      case 'edit':
        return <CustomerForm 
                customer={activeModal === 'edit' ? selectedCard : undefined}
                onSubmit={handleCustomerFormSubmit}
                onClose={() => setActiveModal(null)}
                onDelete={activeModal === 'edit' ? handleDeleteCustomer : undefined}
               />;
      case 'viewHistory':
        return <CallHistoryForm 
                  customer={selectedCard!} 
                  onSubmit={handleUpdateCustomer} 
                  onClose={() => {
                      setActiveModal(null);
                      setNewCallIdToEdit(null);
                  }} 
                  autoEditCallId={newCallIdToEdit}
               />;
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
      <header className="p-4 bg-white dark:bg-gray-800 shadow-md sticky top-0 z-20">
        <div className="flex justify-between items-center flex-wrap gap-4">
            {/* Right Group */}
            <div className="flex items-center gap-4">
                <button
                onClick={() => setActiveModal('add')}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                <PlusIcon className="w-5 h-5"/>
                <span className="hidden sm:inline">افزودن مشتری</span>
                </button>
                
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 hidden md:block">نرم افزار ارتباط با مشتری مگراز</h1>
                
                <div className="relative max-w-xs hidden sm:block">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="جستجو..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
                
                <div className="relative" ref={filterRef}>
                    <button onClick={() => setIsFilterOpen(p => !p)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <FilterIcon className="w-5 h-5 text-gray-600 dark:text-gray-300"/>
                        <span className="hidden sm:inline">برچسب</span>
                        {selectedTagTexts.size > 0 && <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">{selectedTagTexts.size}</span>}
                    </button>
                    {isFilterOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 rounded-md shadow-lg z-20 border dark:border-gray-600 max-h-60 overflow-y-auto">
                            <ul className="py-1">
                                {uniqueTags.length > 0 ? uniqueTags.map(tag => (
                                    <li key={tag.id}>
                                        <label className="w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedTagTexts.has(tag.text)} onChange={() => handleTagToggle(tag.text)} className="form-checkbox h-4 w-4 text-blue-600 rounded" />
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tag.color}`}>{tag.text}</span>
                                        </label>
                                    </li>
                                )) : (
                                    <li className="px-4 py-2 text-sm text-gray-500">برچسبی یافت نشد.</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Left Group */}
            <div className="flex items-center gap-2">
                 <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileImport} />
                <div className="relative" ref={settingsRef}>
                    <button onClick={() => setIsSettingsOpen(prev => !prev)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <SettingsIcon className="w-6 h-6 text-gray-600 dark:text-gray-300"/>
                    </button>
                    {isSettingsOpen && (
                        <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-700 rounded-md shadow-lg z-20 border dark:border-gray-600">
                            <ul className="py-1">
                                <li>
                                    <button onClick={handleImportClick} className="w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        <span>ایمپورت از CSV</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={handleExportTemplate} className="w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2">
                                        <ExportIcon className="w-5 h-5" />
                                        <span>دانلود نمونه CSV</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => { setActiveModal('whatsapp-settings'); setIsSettingsOpen(false); }} className="w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        <span>مدیریت پیام‌ها</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
        
         {(searchTerm || selectedTagTexts.size > 0) && (
            <div className="w-full flex items-center gap-2 flex-wrap pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-sm">فیلترهای فعال:</span>
                {Array.from(selectedTagTexts).map(text => {
                    const tag = uniqueTags.find(t => t.text === text);
                    return (
                        <span key={text} className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${tag?.color || 'bg-gray-200 text-gray-800'}`}>
                            {text}
                            <button onClick={() => handleTagToggle(text)} className="opacity-70 hover:opacity-100">&times;</button>
                        </span>
                    );
                })}
                <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">پاک کردن همه</button>
            </div>
        )}
      </header>
      <main className="flex-grow p-4 overflow-x-auto">
        <div className="flex flex-col md:flex-row gap-4">
          {boardData.columnOrder.map(columnId => {
            const column = boardData.columns[columnId];
            const cards = column.cardIds
                .filter(cardId => visibleCardIds.has(cardId))
                .map(cardId => boardData.cards[cardId])
                .filter(Boolean);

            const colors = COLUMN_COLORS[columnId] || { bg: 'bg-gray-200 dark:bg-gray-800/50', header: 'bg-gray-200 dark:bg-gray-800/50' };
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={cards}
                bgColor={colors.bg}
                headerColor={colors.header}
                onDrop={handleDrop}
                onCardAction={handleCardAction}
                onDragStart={handleDragStart}
                onUpdateTitle={handleUpdateColumnTitle}
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
                viewHistory: `تاریخچه تماس ${selectedCard?.name}`,
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
    onSubmit: (customer: Omit<Customer, 'id' | 'callHistory'> | Customer) => void;
    onClose: () => void;
    onDelete?: (customerId: string) => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onSubmit, onClose, onDelete }) => {
    const [formData, setFormData] = useState({
        phone: customer?.phone || '',
        name: customer?.name || '',
        shopName: customer?.shopName || '',
        shopType: customer?.shopType || '',
        city: customer?.city || ''
    });
    const [tags, setTags] = useState<Tag[]>(customer?.tags || []);
    const [newTagText, setNewTagText] = useState('');
    const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addTag = () => {
        if (newTagText.trim() && !tags.some(t => t.text === newTagText.trim())) {
            setTags([...tags, { id: `tag-${Date.now()}`, text: newTagText.trim(), color: selectedColor }]);
            setNewTagText('');
        }
    };

    const removeTag = (tagId: string) => {
        setTags(tags.filter(t => t.id !== tagId));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customer) {
            onSubmit({ ...customer, ...formData, tags });
        } else {
            onSubmit({ ...formData, tags });
        }
    };

    const handleDelete = () => {
        if (customer && onDelete) {
            if (window.confirm(`آیا از حذف ${customer.name} مطمئن هستید؟ این عمل قابل بازگشت نیست.`)) {
                onDelete(customer.id);
            }
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

            <div className="space-y-3 pt-3 border-t dark:border-gray-600">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">برچسب‌ها</h4>
                <div className="flex flex-wrap gap-2 min-h-[2.5rem] bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
                    {tags.length > 0 ? tags.map(tag => (
                    <span key={tag.id} className={`flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full ${tag.color}`}>
                        {tag.text}
                        <button type="button" onClick={() => removeTag(tag.id)} className="text-sm opacity-70 hover:opacity-100">&times;</button>
                    </span>
                    )) : <span className="text-sm text-gray-400 px-1">هنوز برچسبی اضافه نشده.</span>}
                </div>
                <div className="pt-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newTagText}
                            onChange={(e) => setNewTagText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                            placeholder="افزودن برچسب جدید..."
                            className="flex-grow p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                        />
                        <button type="button" onClick={addTag} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">افزودن</button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {TAG_COLORS.map(color => (
                            <button type="button" key={color} onClick={() => setSelectedColor(color)} className={`w-8 h-8 rounded-full ${color} ${selectedColor === color ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800' : ''}`}></button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
                 {customer && onDelete && (
                    <button 
                        type="button" 
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        title="حذف مشتری"
                    >
                        <TrashIcon className="w-5 h-5"/>
                        <span>حذف</span>
                    </button>
                 )}
                 <div className="flex justify-end gap-2 flex-grow">
                     <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">لغو</button>
                     <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{customer ? 'ذخیره تغییرات' : 'افزودن'}</button>
                 </div>
            </div>
        </form>
    )
}

interface CallHistoryFormProps {
  customer: Customer;
  onSubmit: (customer: Customer) => void;
  onClose: () => void;
  autoEditCallId?: string | null;
}

const CallHistoryForm: React.FC<CallHistoryFormProps> = ({ customer, onSubmit, onClose, autoEditCallId }) => {
    const [callHistory, setCallHistory] = useState<CallLog[]>(customer.callHistory || []);
    const [editingCallId, setEditingCallId] = useState<string | null>(autoEditCallId || null);
    const editNoteTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (editingCallId && editNoteTextareaRef.current) {
            editNoteTextareaRef.current.focus();
            const val = editNoteTextareaRef.current.value;
            editNoteTextareaRef.current.value = '';
            editNoteTextareaRef.current.value = val;
        }
    }, [editingCallId]);

    const handleNoteChange = (callId: string, newNotes: string) => {
        setCallHistory(prev => prev.map(call => 
            call.id === callId ? { ...call, notes: newNotes } : call
        ));
    };

    const handleDeleteCall = (callId: string) => {
        if (window.confirm("آیا از حذف این تماس مطمئن هستید؟")) {
            setCallHistory(prev => prev.filter(call => call.id !== callId));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ ...customer, callHistory });
    };

    const handleNoteBlur = () => {
        setEditingCallId(null);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1 -mr-2 pr-4">
                {callHistory.length > 0 ? (
                    <div className="relative border-r-2 border-blue-200 dark:border-blue-800 ml-4">
                        {callHistory.map(call => (
                            <div key={call.id} className="mb-8 ml-8">
                                <span className="absolute flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full -right-4 ring-4 ring-white dark:ring-gray-800 dark:bg-blue-900">
                                    <CallIcon className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                                </span>
                                <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-700 dark:border-gray-600">
                                    <div className="flex items-center justify-between mb-3">
                                        <time className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                            {new Date(call.timestamp).toLocaleString('fa-IR', {
                                                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </time>
                                         <button
                                            type="button"
                                            onClick={() => handleDeleteCall(call.id)}
                                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-full"
                                            aria-label="حذف تماس"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {editingCallId === call.id ? (
                                        <textarea
                                            ref={editNoteTextareaRef}
                                            value={call.notes}
                                            onChange={(e) => handleNoteChange(call.id, e.target.value)}
                                            onBlur={handleNoteBlur}
                                            rows={3}
                                            placeholder="یادداشتی برای این تماس بنویسید..."
                                            className="w-full p-2 text-sm rounded-md bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    ) : (
                                        <div className="flex justify-between items-start gap-2 group">
                                            <p className="w-full p-2 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap min-h-[4rem]">
                                                {call.notes || <span className="text-gray-400">یادداشتی ثبت نشده.</span>}
                                            </p>
                                            <button 
                                                type="button" 
                                                onClick={() => setEditingCallId(call.id)}
                                                className="p-1 text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="ویرایش یادداشت"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                     <p className="text-center text-gray-500 dark:text-gray-400 py-4">هنوز تماسی ثبت نشده است.</p>
                )}
            </div>
             <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700 mt-4">
                 <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">لغو</button>
                 <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">ذخیره تاریخچه</button>
            </div>
        </form>
    );
};
  
const ReminderForm: React.FC<{ customer: Customer; onSubmit: (customer: Customer) => void; }> = ({ customer, onSubmit }) => {
    const [reminder, setReminder] = useState('');
    const [jalaliDate, setJaliDate] = useState<string | null>(null);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateValue = e.target.value;
        setReminder(dateValue);

        if (dateValue) {
            try {
                const date = new Date(dateValue);
                setJaliDate(date.toLocaleString('fa-IR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }));
            } catch (error) {
                setJaliDate('تاریخ نامعتبر');
            }
        } else {
            setJaliDate(null);
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