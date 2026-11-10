// Converts numeric amounts into Indian Currency English Words
// Example: 38940 -> "Rupees Thirty-Eight Thousand Nine Hundred Forty Only"

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertLessThanThousand(n) {
  if (n === 0) return '';
  let str = '';

  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }

  if (n > 0) {
    if (n < 20) {
      str += ONES[n] + ' ';
    } else {
      const ten = Math.floor(n / 10);
      const rem = n % 10;
      if (rem > 0) {
        str += TENS[ten] + '-' + ONES[rem] + ' ';
      } else {
        str += TENS[ten] + ' ';
      }
    }
  }

  return str.trim();
}

export function amountToIndianWords(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  const num = Math.round(Number(amount));
  if (num === 0) return 'Rupees Zero Only';

  let remaining = Math.abs(num);
  let words = '';

  // Crores (>= 1,00,00,000)
  const crores = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  if (crores > 0) {
    words += convertLessThanThousand(crores) + ' Crore ';
  }

  // Lakhs (>= 1,00,000)
  const lakhs = Math.floor(remaining / 100000);
  remaining %= 100000;
  if (lakhs > 0) {
    words += convertLessThanThousand(lakhs) + ' Lakh ';
  }

  // Thousands (>= 1,000)
  const thousands = Math.floor(remaining / 1000);
  remaining %= 1000;
  if (thousands > 0) {
    words += convertLessThanThousand(thousands) + ' Thousand ';
  }

  // Remainder (< 1,000)
  if (remaining > 0) {
    words += convertLessThanThousand(remaining) + ' ';
  }

  words = words.trim();
  return `Rupees ${words} Only`;
}

// Formats number to Indian comma standard (e.g. 38940 -> "38,940")
export function formatIndianCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0';
  const n = Math.round(Number(amount));
  return n.toLocaleString('en-IN');
}
