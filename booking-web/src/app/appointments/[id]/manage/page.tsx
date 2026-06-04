'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format, isBefore, subHours } from 'date-fns';
import Link from 'next/link';
import { Calendar, Clock, User, Scissors, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AddToCalendar } from '@/components/AddToCalendar';
import { api, Appointment } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatusBadge } from '@/components/StatusBadge';
import { ClientMessaging } from '@/components/ClientMessaging';
import { toast } from 'sonner';

export default function ManageAppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? undefined;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showGate, setShowGate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.appointments.get(id, token);
      setAppointment(data);
    } catch {
      toast.error('Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  async function cancel() {
    if (!appointment) return;

    const windowHours = appointment.business.cancellationWindowHours;
    const cutoff = subHours(new Date(appointment.startsAt), windowHours);
    const isLate = !isBefore(new Date(), cutoff); // now is inside the window → too late

    // Past the cancellation window: cannot self-cancel online. Tell the client to
    // contact the business, and ping the server so the owner gets notified.
    if (isLate) {
      const biz = appointment.business;
      const contact = [biz.phone, biz.email].filter(Boolean).join(" · ");
      toast.error(
        `It's past the ${windowHours}-hour cancellation window — please contact ${biz.name}${contact ? ` (${contact})` : ""} to cancel. We've let them know.`,
        { duration: 8000 },
      );
      api.appointments.publicLateCancelRequest(id, "Late cancellation requested by client", token).catch(() => {});
      return;
    }

    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    setCancelling(true);
    try {
      await api.appointments.publicCancel(id, 'Cancelled by client', token);
      toast.success('Appointment cancelled');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!appointment) return <div className="min-h-screen flex items-center justify-center text-gray-500">Appointment not found</div>;

  const isCancelled = appointment.status === 'CANCELLED';
  // Only live bookings can be managed (cancel/reschedule). Completed, no-show and
  // cancelled bookings are closed — the client must book fresh.
  const canManage = ['PENDING', 'CONFIRMED'].includes(appointment.status);
  const isClosed = !canManage;
  const canCancel = canManage;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Appointment</h1>
          <p className="text-gray-500">Appointment ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{id}</code></p>
        </div>

        <Card className="mb-6 overflow-hidden">
          <div className={`h-2 ${isCancelled ? 'bg-red-500' : 'bg-violet-600'}`} />
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${isCancelled ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'} flex items-center justify-center`}>
                  {isCancelled ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {canManage ? 'Upcoming Appointment' : isCancelled ? 'Cancelled' : 'Past appointment'}
                  </h2>
                  <p className="text-sm text-gray-500">{appointment.business.name}</p>
                </div>
              </div>
              <StatusBadge status={appointment.status} />
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Scissors className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Service</p>
                    <p className="text-gray-900 font-semibold">{appointment.service.name}</p>
                    <p className="text-sm text-gray-500">{appointment.service.durationMinutes} minutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Staff</p>
                    <p className="text-gray-900 font-semibold">{appointment.staff.user.name}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Date</p>
                    <p className="text-gray-900 font-semibold">{format(new Date(appointment.startsAt), 'EEEE, MMMM do')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Time</p>
                    <p className="text-gray-900 font-semibold">{format(new Date(appointment.startsAt), 'HH:mm')}</p>
                  </div>
                </div>
              </div>
            </div>

            {canManage && (
              <div className="border-t border-gray-100 pt-6 pb-2 flex justify-center">
                <AddToCalendar
                  appointmentId={appointment.id}
                  title={`${appointment.service.name} at ${appointment.business.name}`}
                  startsAt={appointment.startsAt}
                  endsAt={appointment.endsAt}
                  description={`With ${appointment.staff.user.name}`}
                  location={appointment.business.address}
                />
              </div>
            )}

            {canManage && (
              <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row gap-4">
                {canCancel && (
                  <Button 
                    variant="destructive" 
                    className="flex-1 py-6 text-lg font-semibold"
                    onClick={cancel}
                    loading={cancelling}
                  >
                    Cancel Appointment
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="flex-1 py-6 text-lg font-semibold"
                  onClick={() => {
                    // Cancel stays open to guests (token), but rescheduling requires
                    // a (free) account — prompt guests to sign up / sign in.
                    if (getUser()) {
                      router.push(`/book/${appointment.business.slug}?reschedule=${id}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
                    } else {
                      setShowGate(true);
                    }
                  }}
                >
                  Reschedule
                </Button>
              </div>
            )}
            {showGate && canManage && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
                <p className="font-medium mb-2">Rescheduling needs a free account</p>
                <p className="text-violet-700 mb-3">Create an account (or sign in) to reschedule and manage all your bookings in one place. You can still cancel without an account.</p>
                <div className="flex gap-2">
                  <Link href={`/my/register?next=${encodeURIComponent(`/appointments/${id}/manage${token ? `?token=${token}` : ''}`)}`}
                    className="flex-1 text-center bg-violet-600 text-white font-semibold py-2 rounded-lg hover:bg-violet-700">Create account</Link>
                  <Link href={`/my/login?next=${encodeURIComponent(`/appointments/${id}/manage${token ? `?token=${token}` : ''}`)}`}
                    className="flex-1 text-center border border-violet-300 text-violet-700 font-semibold py-2 rounded-lg hover:bg-violet-100">Sign in</Link>
                </div>
              </div>
            )}
            
            {isClosed && (
              <div className="border-t border-gray-100 pt-6 text-center space-y-3">
                <p className="text-sm text-gray-500">
                  This booking is {appointment.status.toLowerCase().replace('_', '-')} and can no longer be changed. To see {appointment.business.name} again, just book a fresh appointment.
                </p>
                <Button
                  variant="primary"
                  className="w-full py-6 text-lg font-semibold"
                  onClick={() => router.push(`/book/${appointment.business.slug}`)}
                >
                  Book New Appointment
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messaging Section */}
        <div className="mb-8">
          <ClientMessaging 
            businessId={appointment.businessId} 
            clientId={appointment.client.id} 
            businessName={appointment.business.name}
            appointmentId={id}
            token={token}
          />
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-400">
            Need help? Contact {appointment.business.name} at {appointment.business.phone || appointment.business.email}
          </p>
        </div>
      </div>
    </div>
  );
}
