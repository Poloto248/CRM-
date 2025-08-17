import { BoardData } from './types';

export const COLUMN_IDS = {
  NUMBERS_LIST: 'numbers-list',
  CONTACT_FAILED: 'contact-failed',
  NEEDS_ACTION: 'needs-action',
  NEEDS_FOLLOW_UP: 'needs-follow-up',
  CUSTOMER: 'customer',
};

export const INITIAL_BOARD_DATA: BoardData = {
  cards: {},
  columns: {
    [COLUMN_IDS.NUMBERS_LIST]: {
      id: COLUMN_IDS.NUMBERS_LIST,
      title: 'لیست شماره ها',
      cardIds: [],
    },
    [COLUMN_IDS.CONTACT_FAILED]: {
      id: COLUMN_IDS.CONTACT_FAILED,
      title: 'عدم برقرار تماس',
      cardIds: [],
    },
    [COLUMN_IDS.NEEDS_ACTION]: {
      id: COLUMN_IDS.NEEDS_ACTION,
      title: 'نیاز به اقدام',
      cardIds: [],
    },
    [COLUMN_IDS.NEEDS_FOLLOW_UP]: {
      id: COLUMN_IDS.NEEDS_FOLLOW_UP,
      title: 'نیاز به آموزش و پیگیری',
      cardIds: [],
    },
    [COLUMN_IDS.CUSTOMER]: {
      id: COLUMN_IDS.CUSTOMER,
      title: 'مشتری',
      cardIds: [],
    },
  },
  columnOrder: [
    COLUMN_IDS.NUMBERS_LIST,
    COLUMN_IDS.CONTACT_FAILED,
    COLUMN_IDS.NEEDS_ACTION,
    COLUMN_IDS.NEEDS_FOLLOW_UP,
    COLUMN_IDS.CUSTOMER,
  ],
};

export const WHATSAPP_MESSAGES = [
  "سلام، وقت بخیر. از خیاطی مگزاز تماس میگیرم.",
  "یادآوری جهت پیگیری آموزش.",
  "آیا در استفاده از نرم افزار مشکلی دارید؟",
];

export const TAG_COLORS = [
  "bg-blue-200 text-blue-800",
  "bg-green-200 text-green-800",
  "bg-yellow-200 text-yellow-800",
  "bg-red-200 text-red-800",
  "bg-purple-200 text-purple-800",
  "bg-pink-200 text-pink-800",
  "bg-indigo-200 text-indigo-800",
  "bg-gray-200 text-gray-800",
];