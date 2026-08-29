// CSV export — UTF-8 with BOM so Excel opens Thai text correctly (rule from
// the design README). Column headers match the prototype's exportStock /
// exportLots verbatim.

export function toCSV(rows: (string | number)[][]): string {
  const body = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return '﻿' + body;
}

export const STOCK_CSV_HEADER = [
  'สินค้า',
  'ประเภท',
  'คงเหลือ',
  'หน่วย',
  'ใช้/เดือน',
  'อยู่ได้(วัน)',
  'ของจะหมด',
  'ควรสั่งซื้อ',
  'สถานะ',
];

export const LOTS_CSV_HEADER = [
  'สินค้า',
  'วันที่ซื้อ',
  'วันหมดอายุ',
  'จำนวน',
  'ราคา/หน่วยขาย',
  'ยูนิตต่อหน่วย',
  'ราคา/ยูนิตยา',
  'ซัพพลายเออร์',
  'เหลือ',
];
