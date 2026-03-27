import axios from 'axios'
import type {
  OnboardRequest,
  OnboardResponse,
  TutorMessageRequest,
  TutorMessageResponse,
  StudyPathResponse,
  AssessmentStartRequest,
  AssessmentStartResponse,
  AssessmentSubmitRequest,
  AssessmentSubmitResponse,
  StudentMemory,
  TTSRequest,
} from '@shared/types'

// All API calls go through this file — never call fetch/axios directly in components
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
})

export const ApiClient = {
  onboard: (data: OnboardRequest): Promise<OnboardResponse> =>
    api.post('/api/onboard', data).then(r => r.data),

  sendTutorMessage: (data: TutorMessageRequest): Promise<TutorMessageResponse> =>
    api.post('/api/tutor/message', data).then(r => r.data),

  getStudyPath: (studentId: string): Promise<StudyPathResponse> =>
    api.get(`/api/study-path/${studentId}`).then(r => r.data),

  startAssessment: (data: AssessmentStartRequest): Promise<AssessmentStartResponse> =>
    api.post('/api/assessment/start', data).then(r => r.data),

  submitAssessment: (data: AssessmentSubmitRequest): Promise<AssessmentSubmitResponse> =>
    api.post('/api/assessment/submit', data).then(r => r.data),

  getMemory: (studentId: string): Promise<StudentMemory> =>
    api.get(`/api/memory/${studentId}`).then(r => r.data),

  // Returns audio blob — play with: new Audio(URL.createObjectURL(blob)).play()
  tts: async (data: TTSRequest): Promise<Blob> => {
    const res = await api.post('/api/tts', data, { responseType: 'blob' })
    return res.data
  },

  healthCheck: (): Promise<{ status: string }> =>
    api.get('/health').then(r => r.data),
}
