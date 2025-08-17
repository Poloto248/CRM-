
export interface Tag {
  id: string;
  text: string;
  color: string;
}

export interface CallLog {
  id: string;
  timestamp: number;
  notes: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  shopName: string;
  shopType: string;
  city: string;
  reminder?: number; // timestamp
  tags: Tag[];
  callHistory: CallLog[];
}

export interface Column {
  id: string;
  title: string;
  cardIds: string[];
}

export interface BoardData {
  cards: { [key: string]: Customer };
  columns: { [key: string]: Column };
  columnOrder: string[];
}