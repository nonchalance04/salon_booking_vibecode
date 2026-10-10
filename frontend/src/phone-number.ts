export function philippinePhoneDigits(value: string) {
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("63") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function philippinePhoneNumber(value: string) {
  return `+63${philippinePhoneDigits(value)}`;
}
