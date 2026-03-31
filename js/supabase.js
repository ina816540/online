// ============================================================
// SUPABASE CONFIGURACIÓN
// ============================================================

const SUPABASE_URL = 'https://rcybdbmdxtmshljxkdid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjeWJkYm1keHRtc2hsanhrZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Nzk1MDgsImV4cCI6MjA4NzU1NTUwOH0.kAe0HhfIwFbB49VP6jd8n7yUqH5Nhem-0OQuEsW-Nc8';

window.sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);