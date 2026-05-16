export type SessionStatus = 'waiting' | 'active' | 'finished'
export interface Session { id:string; code:string; name:string; host_name:string; duration_seconds:number; timer_started_at:string | null; status:SessionStatus; created_at:string }
export interface Track { id:string; session_id:string; title:string; position:number; list:'pool'|'final'; added_by:string; created_at:string }
export interface Player { id:string; session_id:string; pseudo:string; joined_at:string }
