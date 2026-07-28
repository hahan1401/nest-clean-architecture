import { Observable } from 'rxjs';

export interface ApiGenerateUseCase {
  executeSse(prompt: string): Observable<{ data: string }>;
  executeStrictSse(prompt: string): Observable<{ data: string }>;
}
