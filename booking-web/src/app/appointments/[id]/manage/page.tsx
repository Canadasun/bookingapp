'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format, isBefore, subMinutes } from 'date-fns';
import { Calendar, Clock, User, Scissors, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AddToCalendar } from '@/components/AddToCalendar';
import { api, Appointment } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatusBadge } from '@/components/StatusBadge';
import { ClientMessaging } from '@/components/ClientMessaging';
import { toast } from 'sonner';

function formatHHMM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Wrapped in its own component so useSearchParams() is inside a Suspense boundary.
function ManageAppointmentInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? undefined;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

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

    const windowMinutes = appointment.business.cancellationWindowMinutes ?? appointment.business.cancellationWindowHours * 60;
    const cutoff = subMinutes(new Date(appointment.startsAt), windowMinutes);
    const isLate = !isBefore(new Date(), cutoff); // now is inside the window → too late

    // Past the cancellation window: cannot self-cancel online. Tell the client to
    // contact the business, and ping the server so the owner gets notified.
    if (isLate) {
      const biz = appointment.business;
      toast.error(
        `It's past the ${formatHHMM(windowMinutes)} cancellation window — please contact ${biz.name} to cancel. We've let them know.`,
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
  const appointmentStarted = new Date() >= new Date(appointment.startsAt);
  const canManage = ['PENDING', 'CONFIRMED'].includes(appointment.status) && !appointmentStarted;
  const isClosed = !canManage;
  const canCancel = canManage;
  const windowMinutes = appointment.business.cancellationWindowMinutes ?? appointment.business.cancellationWindowHours * 60;
  const changeCutoff = subMinutes(new Date(appointment.startsAt), windowMinutes);
  const canReschedule = canManage && isBefore(new Date(), changeCutoff);

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
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
                    <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Service</p>
                    <p className="text-gray-900 font-semibold">{appointment.service.name}</p>
                    <p className="text-sm text-gray-500">{appointment.service.durationMinutes} minutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Salon</p>
                    <p className="text-gray-900 font-semibold">{appointment.business.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{appointment.staff.user.name}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Date</p>
                    <p className="text-gray-900 font-semibold">{format(new Date(appointment.startsAt), 'EEEE, MMMM do')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Time</p>
                    <p className="text-gray-900 font-semibold">{format(new Date(appointment.startsAt), 'h:mm a')}</p>
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
                    if (!canReschedule) {
                      toast.error(`It's past the ${formatHHMM(windowMinutes)} change window. Please contact ${appointment.business.name} to reschedule.`);
                      return;
                    }
                    router.push(`/book/${appointment.business.slug}?reschedule=${id}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
                  }}
                >
                  Reschedule
                </Button>
              </div>
            )}
            
            {isClosed && (
              <div className="border-t border-gray-100 pt-6 text-center space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Thanks for visiting {appointment.business.name}</h3>
                <p className="text-sm text-gray-500">{appointment.business.postVisitMessage || `We appreciate your business and hope to see you again soon.`}</p>
                <Button
                  variant="primary"
                  className="w-full py-6 text-lg font-semibold"
                  onClick={() => router.push(`/book/${appointment.business.slug}`)}
                >
                  Book New Appointment
                </Button>
                <div className="flex flex-wrap justify-center gap-3 pt-2 text-sm">
                  {([
                    ["Website", appointment.business.websiteUrl],
                    ["Instagram", appointment.business.instagramUrl],
                    ["Facebook", appointment.business.facebookUrl],
                    ["TikTok", appointment.business.tiktokUrl],
                  ] as const).filter(([, url]) => Boolean(url)).map(([label, url]) => (
                    <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">{label}</a>
                  ))}
                </div>
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
          <p className="text-sm text-gray-600">
            Need help? Contact {appointment.business.name}.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function ManageAppointmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
      <ManageAppointmentInner />
    </Suspense>
  );
}
