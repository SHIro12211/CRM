function formatPhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')

  // Eliminar el código de país +1
  const number = digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits

  if (number.length !== 10) return phone

  return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`
}
export default formatPhone
