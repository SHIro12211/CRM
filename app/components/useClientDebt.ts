export function useClientDebt() {
  function getDebt(user: any): number {
    const client = Array.isArray(user.clients) ? user.clients[0] : user.clients
    const enrollments = client?.enrollments ?? []
    return enrollments
      .filter((e: any) => e.payment_type === 'Parcial')
      .reduce((total: number, e: any) => {
        const paid = (e.payments ?? []).reduce((sum: number, p: any) => sum + Number(p.amount_paid ?? 0), 0)
        const remaining = Number(e.agreed_price ?? 0) - paid
        return total + (remaining > 0 ? remaining : 0)
      }, 0)
  }
  return { getDebt }
}
