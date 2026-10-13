export const formatPhone = (text: string): string => {
  let cleaned = text.replace(/\D/g, '');
  
  if (cleaned.length > 11) {
    cleaned = cleaned.slice(0, 11);
  }

  if (cleaned.length === 0) return '';
  if (cleaned.length <= 2) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
};

export const formatDate = (text: string): string => {
  let cleaned = text.replace(/\D/g, '');
  
  if (cleaned.length > 8) {
    cleaned = cleaned.slice(0, 8);
  }

  if (cleaned.length === 0) return '';
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
};

export const isValidPhone = (value: string): boolean => value.replace(/\D/g, '').length >= 10;

export const isValidBirthDate = (value: string): boolean => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  return year >= 1900
    && date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date <= today;
};
