import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface ReportRow {
  id: number;
  employee_id: string;
  employee_name: string;
  form_type: string;
  role: string;
  submitted_at: string;
  date: string;
  day_of_week: string;
  form_data: Record<string, unknown> | null;
}

interface UseReportsOptions {
  dateStart?: string;
  dateEnd?: string;
  employeeName?: string;
  formType?: string;
}

export function useReports({ dateStart, dateEnd, employeeName, formType }: UseReportsOptions = {}) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      let query = supabase.from('eod_all_submissions').select('*').order('submitted_at', { ascending: false }).limit(500);
      if (dateStart) query = query.gte('date', dateStart);
      if (dateEnd) query = query.lte('date', dateEnd);
      if (employeeName && employeeName !== 'all') query = query.eq('employee_name', employeeName);
      if (formType && formType !== 'all') query = query.eq('form_type', formType);
      const { data, error } = await query;
      if (error) setError(error.message);
      else setReports(data ?? []);
      setLoading(false);
    }
    fetchReports();
  }, [dateStart, dateEnd, employeeName, formType]);

  return { reports, loading, error };
}
