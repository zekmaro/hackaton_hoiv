// Persists studentId in localStorage after onboarding
// Use this hook anywhere you need the current student

export function useStudentId() {
  const get = (): string | null => localStorage.getItem('studentId')
  const set = (id: string) => localStorage.setItem('studentId', id)
  const clear = () => localStorage.removeItem('studentId')
  const exists = (): boolean => !!localStorage.getItem('studentId')

  return { getStudentId: get, setStudentId: set, clearStudentId: clear, hasStudent: exists }
}
