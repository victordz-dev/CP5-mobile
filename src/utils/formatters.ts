export const formatPhone = (text: string): string => {
  let cleaned = text.replace(/\D/g, '');
  
  // Limita a 11 dígitos (tamanho máximo de celular no Brasil)
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
