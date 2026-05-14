import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Employee } from '@/types';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchEmployees() {
    setLoading(true);
    const { data, error } = await supabase.from('employees').select('*').order('name');
    if (error) setError(error.message);
    else setEmployees(data ?? []);
    setLoading(false);
  }

  async function createEmployee(values: { name: string; email: string; department: string; role: 'superadmin' | 'employee' }) {
    const { data, error } = await supabase.from('employees').insert({ ...values, user_id: null }).select().single();
    if (error) return { error: error.message };
    setEmployees((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return { error: null };
  }

  async function updateEmployee(id: string, values: Partial<Employee>) {
    const { data, error } = await supabase.from('employees').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) return { error: error.message };
    setEmployees((prev) => prev.map((e) => (e.id === id ? data : e)));
    return { error: null };
  }

  async function deleteEmployee(id: string) {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) return { error: error.message };
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    return { error: null };
  }

  useEffect(() => { fetchEmployees(); }, []);

  return { employees, loading, error, createEmployee, updateEmployee, deleteEmployee, refetch: fetchEmployees };
}
