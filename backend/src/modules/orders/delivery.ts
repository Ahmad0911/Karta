/** Delivery pricing in kobo. The browser's copy is for display only; THIS is what customers are charged. CONFIRM with logistics before launch. */
const FEES_NAIRA: Record<string, number> = {
  'FCT (Abuja)': 15000, Nasarawa: 22000, Niger: 25000, Kaduna: 30000, Kogi: 30000, Lagos: 40000,
  Oyo: 40000, Ogun: 40000, Rivers: 45000, Enugu: 45000, Kano: 45000,
}
const DEFAULT_NAIRA = 50000
export const deliveryFeeKobo = (state: string) => (FEES_NAIRA[state] ?? DEFAULT_NAIRA) * 100
